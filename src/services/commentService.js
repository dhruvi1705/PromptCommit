import { apiRequest } from './api';

export const commentService = {
  // Get all comments for a prompt
  async getComments(promptId) {
    return await apiRequest(`/prompts/${promptId}/comments`);
  },

  // Add a new comment
  async addComment(promptId, { content, versionTag = null, parentCommentId = null }) {
    return await apiRequest(`/prompts/${promptId}/comments`, {
      method: 'POST',
      body: JSON.stringify({
        content,
        version_tag: versionTag || undefined,
        parent_comment_id: parentCommentId || undefined
      })
    });
  },

  // Like a comment
  async likeComment(promptId, commentId) {
    return await apiRequest(`/prompts/${promptId}/comments/${commentId}/like`, {
      method: 'POST'
    });
  },

  // Delete a comment
  async deleteComment(promptId, commentId) {
    return await apiRequest(`/prompts/${promptId}/comments/${commentId}`, {
      method: 'DELETE'
    });
  }
};
