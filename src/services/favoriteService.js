import { apiRequest } from './api';

export const favoriteService = {
  async getFavorites() {
    return await apiRequest('/favorites');
  },

  async toggleFavorite(promptId) {
    return await apiRequest(`/prompts/${promptId}/favorite`, {
      method: 'POST'
    });
  },

  async removeFavorite(promptId) {
    return await apiRequest(`/prompts/${promptId}/favorite`, {
      method: 'DELETE'
    });
  }
};
