import { apiRequest } from './api';

export const collaborationService = {
  // Create an email invitation
  async createEmailInvite({
    email,
    name,
    role = 'Reviewer',
    promptId = null,
    scope = 'workspace',
    expiresInDays = 7
  }) {
    return await apiRequest('/collaboration/invitations', {
      method: 'POST',
      body: JSON.stringify({
        email,
        name: name || undefined,
        role,
        scope,
        prompt_id: promptId || null,
        promptId: promptId || null,
        expiration_days: expiresInDays === 'never' || expiresInDays === undefined ? null : (expiresInDays ? Number(expiresInDays) : null),
        expiresInDays: expiresInDays === 'never' || expiresInDays === undefined ? null : (expiresInDays ? Number(expiresInDays) : null)
      })
    });
  },

  // Create a shareable link
  async createShareLink({
    role = 'Reviewer',
    promptId = null,
    scope = 'workspace',
    expiresInDays = 7,
    maxUses = null
  }) {
    const uses = maxUses !== undefined && maxUses !== null && maxUses !== '' ? Number(maxUses) : null;

    return await apiRequest('/collaboration/share-links', {
      method: 'POST',
      body: JSON.stringify({
        role,
        scope,
        prompt_id: promptId || null,
        promptId: promptId || null,
        expiration_days: expiresInDays === 'never' || expiresInDays === undefined ? null : (expiresInDays ? Number(expiresInDays) : null),
        expiresInDays: expiresInDays === 'never' || expiresInDays === undefined ? null : (expiresInDays ? Number(expiresInDays) : null),
        max_uses: uses,
        maxUses: uses
      })
    });
  },

  // List all invitations (email invites and links) created by the user
  async getInvitations() {
    return await apiRequest('/collaboration/invitations');
  },

  // Revoke an invitation or link
  async revokeInvitation(invitationId) {
    return await apiRequest(`/collaboration/invitations/${invitationId}/revoke`, {
      method: 'POST'
    });
  },

  // Resend an email invitation
  async resendInvitation(invitationId) {
    return await apiRequest(`/collaboration/invitations/${invitationId}/resend`, {
      method: 'POST'
    });
  },

  // Get aggregated workspace members
  async getMembers() {
    return await apiRequest('/collaboration/members');
  },

  // Update a collaborator's role across user's prompts
  async updateMemberRole(email, role) {
    return await apiRequest(`/collaboration/members/${encodeURIComponent(email)}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role })
    });
  },

  // Remove a collaborator completely from all owned prompts
  async removeMember(email) {
    return await apiRequest(`/collaboration/members/${encodeURIComponent(email)}`, {
      method: 'DELETE'
    });
  },

  // Remove a collaborator from a specific prompt
  async removeMemberPromptAccess(email, promptId) {
    return await apiRequest(`/collaboration/members/${encodeURIComponent(email)}/prompts/${promptId}`, {
      method: 'DELETE'
    });
  },

  // Update a collaborator's role for a specific prompt
  async updateMemberPromptRole(email, promptId, role) {
    return await apiRequest(`/collaboration/members/${encodeURIComponent(email)}/prompts/${promptId}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role })
    });
  },

  // Get all collaborators on a single prompt
  async getPromptCollaborators(promptId) {
    return await apiRequest(`/collaboration/prompts/${promptId}/collaborators`);
  },

  // Get collaboration activity feed
  async getActivity() {
    return await apiRequest('/collaboration/activity');
  },

  // Get collaboration overview statistics
  async getOverview() {
    return await apiRequest('/collaboration/overview');
  }
};

