// API Configuration
export const API_CONFIG = {
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  timeout: 60000, // 60 seconds
  headers: {
    'Content-Type': 'application/json',
  },
};

export const API_ENDPOINTS = {
  health: '/api/health',
  chat: '/api/chat',
  analyzeImage: '/api/analyze-image',
  textToSpeech: '/api/text-to-speech',
  speechToText: '/api/speech-to-text',
} as const;

export type ApiEndpoint = typeof API_ENDPOINTS[keyof typeof API_ENDPOINTS];
