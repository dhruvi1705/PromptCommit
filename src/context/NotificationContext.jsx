import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { notificationService } from '../services/notificationService';

const NOTIFICATION_POLL_INTERVAL = 5000;
const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
  const { isAuthenticated, currentUser } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  // References for cleanup and stale response prevention
  const activeControllerRef = React.useRef(null);
  const pollTimerRef = React.useRef(null);
  const isFetchingRef = React.useRef(false);
  const currentUserIdRef = React.useRef(currentUser?.id);

  // Keep currentUserId in sync
  useEffect(() => {
    currentUserIdRef.current = currentUser?.id;
  }, [currentUser?.id]);

  const fetchNotifications = useCallback(async (isManual = false) => {
    const activeUserId = currentUserIdRef.current;
    if (!isAuthenticated || !activeUserId) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    if (isFetchingRef.current && !isManual) {
      // Prevent overlapping polls
      return;
    }

    // Abort previous in-flight request if this is a manual trigger
    if (activeControllerRef.current) {
      activeControllerRef.current.abort();
    }

    const controller = new AbortController();
    activeControllerRef.current = controller;
    isFetchingRef.current = true;

    if (isManual) setLoading(true);

    try {
      const data = await notificationService.getNotifications({ signal: controller.signal });
      
      // Ensure the request still belongs to the currently active user
      if (currentUserIdRef.current === activeUserId && !controller.signal.aborted) {
        if (data && Array.isArray(data.items)) {
          setNotifications(data.items);
          setUnreadCount(data.unreadCount || 0);
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.warn('Notification fetch error:', err.message);
      }
    } finally {
      if (activeControllerRef.current === controller) {
        isFetchingRef.current = false;
        activeControllerRef.current = null;
      }
      if (isManual) setLoading(false);
    }
  }, [isAuthenticated]);

  // Robust polling lifecycle: starts on login, stops on logout/user-switch
  useEffect(() => {
    const activeUserId = currentUser?.id;

    // 1. Clean up previous state on user change or logout
    setNotifications([]);
    setUnreadCount(0);
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    if (activeControllerRef.current) {
      activeControllerRef.current.abort();
      activeControllerRef.current = null;
    }
    isFetchingRef.current = false;

    if (!isAuthenticated || !activeUserId) {
      return;
    }

    let isMounted = true;

    const schedulePoll = async () => {
      if (!isMounted || !currentUserIdRef.current) return;
      await fetchNotifications(false);
      if (isMounted && currentUserIdRef.current === activeUserId) {
        pollTimerRef.current = setTimeout(schedulePoll, NOTIFICATION_POLL_INTERVAL);
      }
    };

    // Initial fetch + start recursive loop
    schedulePoll();

    return () => {
      isMounted = false;
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      if (activeControllerRef.current) {
        activeControllerRef.current.abort();
        activeControllerRef.current = null;
      }
    };
  }, [isAuthenticated, currentUser?.id, fetchNotifications]);

  const markAsRead = async (id) => {
    try {
      await notificationService.markAsRead(id);
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const markAllAsRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
    }
  };

  const deleteNotification = async (id) => {
    try {
      await notificationService.deleteNotification(id);
      const target = notifications.find(n => n.id === id);
      if (target && !target.isRead) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch (err) {
      console.error('Failed to delete notification:', err);
    }
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        fetchNotifications: () => fetchNotifications(true),
        markAsRead,
        markAllAsRead,
        deleteNotification
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
