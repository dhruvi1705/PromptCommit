import { apiRequest } from './api';

export const reviewService = {
  // Request a review for a prompt version
  async requestReview(promptId, versionTag, { reviewerEmail, message = '' }) {
    return await apiRequest(`/prompts/${promptId}/versions/${versionTag}/request-review`, {
      method: 'POST',
      body: JSON.stringify({
        reviewer_email: reviewerEmail,
        message: message || undefined
      })
    });
  },

  // Submit review action: 'approve' or 'request_changes'
  async submitReviewAction(promptId, versionTag, { action, feedback = '' }) {
    return await apiRequest(`/prompts/${promptId}/versions/${versionTag}/review-action`, {
      method: 'POST',
      body: JSON.stringify({
        action,
        feedback: feedback || undefined
      })
    });
  },

  // Get review status for a version
  async getReviewStatus(promptId, versionTag) {
    return await apiRequest(`/prompts/${promptId}/versions/${versionTag}/review-status`);
  }
};
