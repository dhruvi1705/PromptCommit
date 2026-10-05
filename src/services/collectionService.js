import { apiRequest } from './api';

export const collectionService = {
  async getCollections() {
    return await apiRequest('/collections');
  },

  async getCollection(id) {
    return await apiRequest(`/collections/${id}`);
  },

  async getCollectionPrompts(collectionId) {
    return await apiRequest(`/collections/${collectionId}/prompts`);
  },

  async createCollection({ name, description, icon, color }) {
    return await apiRequest('/collections', {
      method: 'POST',
      body: JSON.stringify({ name, description, icon, color })
    });
  },

  async updateCollection(id, data) {
    return await apiRequest(`/collections/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  async deleteCollection(id) {
    return await apiRequest(`/collections/${id}`, {
      method: 'DELETE'
    });
  },

  async addPromptToCollection(collectionId, promptId) {
    return await apiRequest(`/collections/${collectionId}/prompts/${promptId}`, {
      method: 'POST'
    });
  },

  async removePromptFromCollection(collectionId, promptId) {
    return await apiRequest(`/collections/${collectionId}/prompts/${promptId}`, {
      method: 'DELETE'
    });
  }
};
