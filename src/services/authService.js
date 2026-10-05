import { apiRequest, setAuthToken } from './api';

export const authService = {
  async login(email, password) {
    const res = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    if (res?.access_token) {
      setAuthToken(res.access_token);
    }
    return res;
  },

  async signup({ username, email, password, confirm_password, name }) {
    const res = await apiRequest('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ username, email, password, confirm_password, name })
    });
    if (res?.access_token) {
      setAuthToken(res.access_token);
    }
    return res;
  },

  async getMe() {
    return await apiRequest('/auth/me');
  },

  async logout() {
    let serverRevoked = false;
    let logoutError = null;
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
      serverRevoked = true;
    } catch (err) {
      logoutError = err?.message || 'Server logout request failed';
      // Log clean diagnostic without exposing tokens or sensitive traces
      console.warn('Server logout notification failed or network unreachable; session cleared locally.', logoutError);
    } finally {
      // Local authentication state is always reliably cleared
      setAuthToken(null);
    }
    return {
      success: true,
      serverRevoked,
      error: logoutError
    };
  },

  async updateProfile(fields) {
    return await apiRequest('/users/profile', {
      method: 'PUT',
      body: JSON.stringify(fields)
    });
  },

  async googleAuth(credential) {
    const res = await apiRequest('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ credential })
    });
    if (res?.access_token) {
      setAuthToken(res.access_token);
    }
    return res;
  }
};
