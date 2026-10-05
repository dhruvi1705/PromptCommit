import { apiRequest } from './api';

export const notificationService = {
  // Get all notifications for current user
  async getNotifications(options = {}) {
    return await apiRequest('/notifications', options);
  },

  // Mark single notification as read
  async markAsRead(notificationId, options = {}) {
    return await apiRequest(`/notifications/${encodeURIComponent(notificationId)}/read`, {
      method: 'PATCH',
      ...options
    });
  },

  // Mark all notifications as read
  async markAllAsRead(options = {}) {
    return await apiRequest('/notifications/mark-all-read', {
      method: 'POST',
      ...options
    });
  },

  // Delete notification
  async deleteNotification(notificationId, options = {}) {
    return await apiRequest(`/notifications/${encodeURIComponent(notificationId)}`, {
      method: 'DELETE',
      ...options
    });
  }
};
