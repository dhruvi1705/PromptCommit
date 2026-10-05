import { apiRequest } from './api';

export const versionService = {
  async getVersions(promptId) {
    return await apiRequest(`/prompts/${promptId}/versions`);
  },

  async createVersion(promptId, { versionTag, commitMessage, description, diffNotes, content, provider, model, targetModel }) {
    const selectedModel = model || targetModel;
    return await apiRequest(`/prompts/${promptId}/versions`, {
      method: 'POST',
      body: JSON.stringify({
        version_tag: versionTag,
        commit_message: commitMessage,
        description,
        diff_notes: diffNotes,
        content,
        provider,
        model: selectedModel,
        target_model: selectedModel
      })
    });
  },

  async restoreVersion(promptId, versionId) {
    return await apiRequest(`/prompts/${promptId}/versions/${versionId}/restore`, {
      method: 'POST'
    });
  }
};
