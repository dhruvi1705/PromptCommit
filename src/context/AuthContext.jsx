import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authService } from '../services/authService';
import { getAuthToken, setAuthToken } from '../services/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(() => {
    const token = getAuthToken();
    if (!token) return null;
    const saved = localStorage.getItem('pc_current_user_v3');
    return saved ? JSON.parse(saved) : null;
  });

  const [isLoading, setIsLoading] = useState(() => {
    // If a token exists, stay in loading state until the server validates it
    return !!getAuthToken();
  });

  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('pc_theme') || 'light';
  });

  // Verify active JWT token on load
  useEffect(() => {
    const initAuth = async () => {
      const token = getAuthToken();
      if (token) {
        try {
          const res = await authService.getMe();
          if (res?.user) {
            setCurrentUser(res.user);
            localStorage.setItem('pc_current_user_v3', JSON.stringify(res.user));
          } else {
            setCurrentUser(null);
            localStorage.removeItem('pc_current_user_v3');
            setAuthToken(null);
          }
        } catch {
          // Token expired, invalid, or server unreachable
          setCurrentUser(null);
          localStorage.removeItem('pc_current_user_v3');
          setAuthToken(null);
        }
      } else {
        setCurrentUser(null);
        localStorage.removeItem('pc_current_user_v3');
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  // Sync theme
  useEffect(() => {
    localStorage.setItem('pc_theme', theme);
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  const login = async (email, password) => {
    try {
      const res = await authService.login(email, password);
      if (res?.user) {
        setCurrentUser(res.user);
        localStorage.setItem('pc_current_user_v3', JSON.stringify(res.user));
        return { success: true, user: res.user };
      }
      return { success: false, message: 'Authentication failed.' };
    } catch (err) {
      return { success: false, message: err.message || 'Login failed.' };
    }
  };

  const demoLogin = async (userId) => {
    if (!import.meta.env.DEV) {
      return { success: false, message: 'Demo login is only available in development mode.' };
    }
    const email = userId === 'user2' ? 'dhruvi@promptcommit.dev' : 'aanshi@promptcommit.dev';
    return await login(email, 'password123');
  };

  const signup = async (signupData) => {
    try {
      const res = await authService.signup(signupData);
      if (res?.user) {
        setCurrentUser(res.user);
        localStorage.setItem('pc_current_user_v3', JSON.stringify(res.user));
        return { success: true, user: res.user };
      }
      return { success: false, message: 'Registration failed.' };
    } catch (err) {
      return { success: false, message: err.message || 'Registration failed.' };
    }
  };

  const logout = async () => {
    await authService.logout();
    setCurrentUser(null);
    localStorage.removeItem('pc_current_user_v3');
    setTheme('light');
  };

  const updateProfile = async (fields) => {
    try {
      const res = await authService.updateProfile(fields);
      if (res?.user) {
        setCurrentUser(res.user);
        localStorage.setItem('pc_current_user_v3', JSON.stringify(res.user));
        if (fields.theme) setTheme(fields.theme);
        return { success: true, user: res.user };
      }
      return { success: false };
    } catch (err) {
      return { success: false, message: err.message };
    }
  };

  const googleLogin = async (credential) => {
    try {
      const res = await authService.googleAuth(credential);
      if (res?.user) {
        setCurrentUser(res.user);
        localStorage.setItem('pc_current_user_v3', JSON.stringify(res.user));
        return { success: true, user: res.user };
      }
      return { success: false, message: 'Google authentication failed.' };
    } catch (err) {
      return { success: false, message: err.message || 'Google authentication failed.' };
    }
  };

  return (
    <AuthContext.Provider value={{
      currentUser,
      isLoading,
      theme,
      setTheme,
      toggleTheme,
      login,
      demoLogin,
      signup,
      googleLogin,
      logout,
      updateProfile,
      updateUser: updateProfile,
      isAuthenticated: !!currentUser
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
