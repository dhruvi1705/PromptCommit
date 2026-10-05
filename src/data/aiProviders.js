// Standardized AI Providers and Models Configuration
// Supports: Google Gemini, Groq, OpenRouter, and Mistral AI

export const AI_PROVIDERS = [
  {
    id: 'gemini',
    name: 'Google Gemini',
    models: [
      'gemini-3.6-flash',
      'gemini-3.7-flash',
      'gemini-3.8-flash'
    ],
    modelLabels: {
      'gemini-3.6-flash': 'Gemini 3.6 Flash',
      'gemini-3.7-flash': 'Gemini 3.7 Flash',
      'gemini-3.8-flash': 'Gemini 3.8 Flash'
    },
    defaultModel: 'gemini-3.6-flash',
    type: 'Cloud API',
    color: 'cyan',
    latencyRange: '120-220ms',
    isFree: true,
    capabilities: {
      'gemini-3.6-flash': ['text', 'image', 'pdf', 'code'],
      'gemini-3.7-flash': ['text', 'image', 'pdf', 'code'],
      'gemini-3.8-flash': ['text', 'image', 'pdf', 'code']
    }
  },
  {
    id: 'groq',
    name: 'Groq',
    models: ['openai/gpt-oss-20b'],
    modelLabels: {
      'openai/gpt-oss-20b': 'GPT-OSS 20B'
    },
    defaultModel: 'openai/gpt-oss-20b',
    type: 'Cloud API',
    color: 'amber',
    latencyRange: '40-80ms',
    isFree: true,
    capabilities: {
      'openai/gpt-oss-20b': ['text', 'pdf', 'code']
    }
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    models: ['openrouter/free'],
    modelLabels: {
      'openrouter/free': 'OpenRouter Free'
    },
    defaultModel: 'openrouter/free',
    type: 'Cloud API',
    color: 'emerald',
    latencyRange: '200-500ms',
    isFree: true,
    capabilities: {
      'openrouter/free': ['text', 'image', 'pdf', 'code']
    }
  },
  {
    id: 'mistral',
    name: 'Mistral AI',
    models: ['mistral-small-latest'],
    modelLabels: {
      'mistral-small-latest': 'Mistral Small'
    },
    defaultModel: 'mistral-small-latest',
    type: 'Cloud API',
    color: 'orange',
    latencyRange: '140-300ms',
    isFree: true,
    capabilities: {
      'mistral-small-latest': ['text', 'image', 'pdf', 'code']
    }
  }
];

export const ALL_MODELS = AI_PROVIDERS.flatMap(p => p.models);

export const getProviderByModel = (modelName) => {
  return AI_PROVIDERS.find(p => p.models.includes(modelName)) || AI_PROVIDERS[0];
};

export const getProviderByName = (providerName) => {
  const norm = (providerName || '').toLowerCase();
  return AI_PROVIDERS.find(p => p.name.toLowerCase() === norm || p.id === norm || norm.startsWith(p.id)) || AI_PROVIDERS[0];
};

export const isCapabilitySupported = (providerNameOrId, modelName, inputType) => {
  const p = getProviderByName(providerNameOrId);
  if (!p) return false;
  const caps = p.capabilities?.[modelName] || p.capabilities?.[p.defaultModel] || ['text'];
  return caps.includes(inputType);
};

