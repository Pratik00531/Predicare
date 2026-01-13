import { API_CONFIG, API_ENDPOINTS } from './api-config';

export interface HealthCheckResponse {
  status: string;
  components?: Record<string, string>;
  endpoints?: string[];
}

export interface ChatRequest {
  message: string;
  include_voice?: boolean;
}

export interface ChatResponse {
  success: boolean;
  response: string;
  message_received: string;
  audio_file?: string;
}

export interface ImageAnalysisRequest {
  image: File;
  query?: string;
}

export interface ImageAnalysisResponse {
  success: boolean;
  analysis: string;
  query_used: string;
  model: string;
}

export interface TextToSpeechRequest {
  text: string;
  voice_provider?: 'gtts' | 'elevenlabs';
}

export interface SpeechToTextResponse {
  success: boolean;
  transcription: string;
  model: string;
}

class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public data?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

class ApiClient {
  private baseURL: string;
  private timeout: number;

  constructor() {
    this.baseURL = API_CONFIG.baseURL;
    this.timeout = API_CONFIG.timeout;
  }

  private async fetchWithTimeout(
    url: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new ApiError('Request timeout', 408);
      }
      throw error;
    }
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new ApiError(
        errorData.detail || `HTTP ${response.status}: ${response.statusText}`,
        response.status,
        errorData
      );
    }

    return response.json();
  }

  async healthCheck(): Promise<HealthCheckResponse> {
    const response = await this.fetchWithTimeout(
      `${this.baseURL}${API_ENDPOINTS.health}`
    );
    return this.handleResponse<HealthCheckResponse>(response);
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const formData = new FormData();
    formData.append('message', request.message);
    if (request.include_voice !== undefined) {
      formData.append('include_voice', request.include_voice.toString());
    }

    const response = await this.fetchWithTimeout(
      `${this.baseURL}${API_ENDPOINTS.chat}`,
      {
        method: 'POST',
        body: formData,
      }
    );
    return this.handleResponse<ChatResponse>(response);
  }

  async analyzeImage(request: ImageAnalysisRequest): Promise<ImageAnalysisResponse> {
    const formData = new FormData();
    formData.append('image', request.image);
    if (request.query) {
      formData.append('query', request.query);
    }

    const response = await this.fetchWithTimeout(
      `${this.baseURL}${API_ENDPOINTS.analyzeImage}`,
      {
        method: 'POST',
        body: formData,
      }
    );
    return this.handleResponse<ImageAnalysisResponse>(response);
  }

  async textToSpeech(request: TextToSpeechRequest): Promise<Blob> {
    const formData = new FormData();
    formData.append('text', request.text);
    if (request.voice_provider) {
      formData.append('voice_provider', request.voice_provider);
    }

    const response = await this.fetchWithTimeout(
      `${this.baseURL}${API_ENDPOINTS.textToSpeech}`,
      {
        method: 'POST',
        body: formData,
      }
    );

    if (!response.ok) {
      throw new ApiError(
        `HTTP ${response.status}: ${response.statusText}`,
        response.status
      );
    }

    return response.blob();
  }

  async speechToText(audioFile: File): Promise<SpeechToTextResponse> {
    const formData = new FormData();
    formData.append('audio', audioFile);

    const response = await this.fetchWithTimeout(
      `${this.baseURL}${API_ENDPOINTS.speechToText}`,
      {
        method: 'POST',
        body: formData,
      }
    );
    return this.handleResponse<SpeechToTextResponse>(response);
  }
}

// Export singleton instance
export const apiClient = new ApiClient();
export { ApiError };
