import { apiRequest } from './api';

export const testService = {
  async runTest(
    {
      promptId,
      promptContent,
      inputText,
      provider,
      model,
      temperature,
      maxTokens,
      inputType = 'text',
      file = null,
      codeSnippet = null,
      codeLanguage = null,
      filename = null,
      mimeType = null
    },
    options = {}
  ) {
    // Use FormData payload when a File/Blob attachment is present
    if (file && (file instanceof File || file instanceof Blob)) {
      const formData = new FormData();
      if (promptId) formData.append('prompt_id', promptId);
      if (promptContent) formData.append('prompt_content', promptContent);
      formData.append('input_text', inputText !== undefined && inputText !== null ? inputText : '');
      formData.append('provider', provider || 'Google Gemini');
      formData.append('model', model || 'gemini-3.6-flash');
      formData.append('temperature', temperature !== undefined ? temperature : 0.7);
      formData.append('max_tokens', maxTokens !== undefined ? maxTokens : 1024);
      formData.append('input_type', inputType || 'text');
      if (codeLanguage) formData.append('code_language', codeLanguage);
      if (codeSnippet) formData.append('code_snippet', codeSnippet);

      const fileNameToUse = filename || file.name || 'attachment';
      formData.append('file', file, fileNameToUse);

      return await apiRequest('/tests', {
        method: 'POST',
        body: formData,
        timeout: 60000,
        ...options
      });
    }

    // Standard JSON payload for text or code attachments
    return await apiRequest('/tests', {
      method: 'POST',
      body: JSON.stringify({
        prompt_id: promptId || null,
        prompt_content: promptContent || null,
        input_text: inputText !== undefined && inputText !== null ? inputText : '',
        provider: provider || 'Google Gemini',
        model: model || 'gemini-3.6-flash',
        temperature: temperature !== undefined ? temperature : 0.7,
        max_tokens: maxTokens !== undefined ? maxTokens : 1024,
        input_type: inputType || 'text',
        code_snippet: codeSnippet || null,
        code_language: codeLanguage || null,
        filename: filename || null,
        mime_type: mimeType || null
      }),
      timeout: 60000,
      ...options
    });
  },

  async getRecentTests(options = {}) {
    return await apiRequest('/tests', options);
  }
};
