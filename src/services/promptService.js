import { apiRequest } from './api';

export const promptService = {
  async getPrompts(params = {}, options = {}) {
    const query = new URLSearchParams();
    if (params.search) query.append('search', params.search);
    if (params.category && params.category !== 'All') query.append('category', params.category);
    if (params.collectionId && params.collectionId !== 'All') query.append('collectionId', params.collectionId);
    else if (params.collection && params.collection !== 'All') query.append('collection', params.collection);

    const qs = query.toString();
    return await apiRequest(`/prompts${qs ? `?${qs}` : ''}`, options);
  },

  async getPromptById(id, options = {}) {
    return await apiRequest(`/prompts/${id}`, options);
  },

  async createPrompt(promptData, options = {}) {
    return await apiRequest('/prompts', {
      method: 'POST',
      body: JSON.stringify(promptData),
      ...options
    });
  },

  async updatePrompt(id, updatedFields, options = {}) {
    return await apiRequest(`/prompts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updatedFields),
      ...options
    });
  },

  async deletePrompt(id, options = {}) {
    return await apiRequest(`/prompts/${id}`, {
      method: 'DELETE',
      ...options
    });
  },

  async ratePrompt(id, rating, options = {}) {
    return await apiRequest(`/prompts/${id}/rate?rating=${encodeURIComponent(rating)}`, {
      method: 'POST',
      ...options
    });
  },

  async sharePrompt(id, { email, role, name }, options = {}) {
    return await apiRequest(`/prompts/${id}/share`, {
      method: 'POST',
      body: JSON.stringify({ email, role, name }),
      ...options
    });
  },

  async generatePrompt({ title, description, category, provider, model, temperature, maxTokens }, options = {}) {
    return await apiRequest('/prompts/generate', {
      method: 'POST',
      body: JSON.stringify({
        title: title || '',
        description: description || '',
        category: category || 'General',
        provider: provider || 'Google Gemini',
        model: model || 'gemini-3.6-flash',
        temperature: temperature !== undefined ? temperature : 0.7,
        max_tokens: maxTokens || 1024
      }),
      timeout: 60000,
      ...options
    });
  },

  async comparePrompts({ promptAContent, promptBContent, promptATitle, promptBTitle, provider, model }, options = {}) {
    return await apiRequest('/prompts/compare', {
      method: 'POST',
      body: JSON.stringify({
        promptAContent: promptAContent || '',
        promptBContent: promptBContent || '',
        promptATitle: promptATitle || 'Variant A',
        promptBTitle: promptBTitle || 'Variant B',
        provider: provider || 'Google Gemini',
        model: model || 'gemini-3.6-flash'
      }),
      timeout: 60000,
      ...options
    });
  },

  async removeSharedUser(id, shareId, options = {}) {
    return await apiRequest(`/prompts/${id}/share/${shareId}`, {
      method: 'DELETE',
      ...options
    });
  }
};


