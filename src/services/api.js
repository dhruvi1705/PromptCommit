// API Client Layer with JWT Bearer Token Injection & Central Timeout Policy
export const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';
export const DEFAULT_REQUEST_TIMEOUT_MS = 20000; // 20 seconds for standard API requests

export class ApiError extends Error {
  constructor(message, status = 500, detail = null, data = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail || message;
    this.data = data;
    this.code = data?.code || (status ? `HTTP_${status}` : 'API_ERROR');
  }
}

export class RequestTimeoutError extends Error {
  constructor(timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS) {
    super(`Request timed out after ${timeoutMs / 1000}s. The server is taking longer than expected to respond.`);
    this.name = 'RequestTimeoutError';
    this.status = 408;
    this.code = 'REQUEST_TIMEOUT';
    this.timeoutMs = timeoutMs;
  }
}

export class RequestAbortedError extends Error {
  constructor(message = 'Request was cancelled.') {
    super(message);
    this.name = 'AbortError';
    this.status = 0;
    this.code = 'REQUEST_ABORTED';
  }
}

export const getAuthToken = () => {
  return localStorage.getItem('pc_token');
};

export const setAuthToken = (token) => {
  if (token) {
    localStorage.setItem('pc_token', token);
  } else {
    localStorage.removeItem('pc_token');
  }
};

/**
 * Centralized API request wrapper with JWT injection, timeout handling, and status mapping.
 * Supports both standard JSON payloads and multipart/form-data binary uploads.
 */
export async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const headers = {
    ...(options.headers || {})
  };

  let bodyPayload = options.body;

  if (isFormData) {
    delete headers['Content-Type'];
    delete headers['content-type'];
  } else {
    if (!headers['Content-Type'] && !headers['content-type']) {
      headers['Content-Type'] = 'application/json';
    }
    if (bodyPayload && typeof bodyPayload === 'object' && !(bodyPayload instanceof Blob) && !(bodyPayload instanceof ArrayBuffer)) {
      bodyPayload = JSON.stringify(bodyPayload);
    }
  }

  const token = getAuthToken();
  if (token && !headers['Authorization'] && !headers['authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Timeout control using AbortController
  const timeoutMs = options.timeout !== undefined ? options.timeout : DEFAULT_REQUEST_TIMEOUT_MS;
  const controller = new AbortController();
  let timeoutId = null;

  if (timeoutMs && timeoutMs > 0) {
    timeoutId = setTimeout(() => {
      controller.abort();
    }, timeoutMs);
  }

  const config = {
    ...options,
    body: bodyPayload,
    headers,
    signal: options.signal || controller.signal
  };

  try {
    const response = await fetch(url, config);
    if (timeoutId) clearTimeout(timeoutId);

    // Handle 204 No Content
    if (response.status === 204) {
      return null;
    }

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      // 401 Unauthorized: Session token is missing, expired, or invalid -> clear local auth state
      if (response.status === 401) {
        setAuthToken(null);
      }

      // Format helpful error messages according to HTTP status semantics
      let errorMessage = data?.detail || data?.message;
      if (!errorMessage) {
        switch (response.status) {
          case 400:
            errorMessage = 'Invalid request parameters submitted.';
            break;
          case 401:
            errorMessage = 'Authentication session has expired. Please log in again.';
            break;
          case 403:
            errorMessage = 'Access denied. You do not have sufficient permissions for this operation.';
            break;
          case 404:
            errorMessage = 'The requested resource was not found.';
            break;
          case 409:
            errorMessage = 'A conflict occurred with existing resource state.';
            break;
          case 422:
            errorMessage = 'Request validation failed. Please check your submitted inputs.';
            break;
          case 429:
            errorMessage = 'Rate limit exceeded. Please wait a moment before trying again.';
            break;
          case 500:
          case 502:
          case 503:
          case 504:
            errorMessage = 'Server error encountered. Please try again shortly.';
            break;
          default:
            errorMessage = `HTTP Error ${response.status}`;
        }
      } else if (typeof errorMessage === 'object') {
        errorMessage = Array.isArray(errorMessage)
          ? errorMessage.map(e => e.msg || JSON.stringify(e)).join(', ')
          : JSON.stringify(errorMessage);
      }

      throw new ApiError(errorMessage, response.status, data?.detail || errorMessage, data);
    }

    return data;
  } catch (error) {
    if (timeoutId) clearTimeout(timeoutId);

    // Differentiate caller abort vs timeout vs network error vs ApiError
    if (error instanceof ApiError) {
      throw error;
    }

    if (error.name === 'AbortError') {
      if (options.signal && options.signal.aborted) {
        // Caller explicitly aborted (e.g. user switch, component unmount, or newer request)
        throw new RequestAbortedError();
      }
      throw new RequestTimeoutError(timeoutMs);
    }

    if (error.name === 'TypeError' && (error.message.includes('fetch') || error.message.includes('network'))) {
      throw new ApiError(
        'Network error: Unable to connect to the PromptCommit API server. Please check your network connection.',
        0,
        'Network connection failure',
        null
      );
    }

    throw error;
  }
}
