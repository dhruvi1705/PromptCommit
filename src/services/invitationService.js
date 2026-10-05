import { apiRequest } from './api';

export const invitationService = {
  // Public/unauthenticated inspect invitation details
  async getInvitation(token) {
    return await apiRequest(`/invitations/${encodeURIComponent(token)}`);
  },

  // Authenticated accept invitation
  async acceptInvitation(token) {
    return await apiRequest(`/invitations/${encodeURIComponent(token)}/accept`, {
      method: 'POST'
    });
  },

  // Decline invitation
  async declineInvitation(token) {
    return await apiRequest(`/invitations/${encodeURIComponent(token)}/decline`, {
      method: 'POST'
    });
  }
};
