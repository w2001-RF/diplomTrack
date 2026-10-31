// API Client Factory and Configuration

import type { IApiClient } from './interfaces';
import { supabaseClient } from './adapters/supabase.adapter';
import { createRestApiClient, type RestApiConfig } from './adapters/rest.adapter';

export type ApiBackendType = 'supabase' | 'rest';

export interface ApiClientConfig {
  backend: ApiBackendType;
  restConfig?: RestApiConfig;
}

// Default configuration - can be changed via environment variables
const DEFAULT_BACKEND: ApiBackendType = 
  (import.meta.env.VITE_API_BACKEND as ApiBackendType) || 'supabase';

const REST_API_BASE_URL = import.meta.env.VITE_REST_API_URL || '';

let apiClientInstance: IApiClient | null = null;
let currentBackend: ApiBackendType = DEFAULT_BACKEND;

/**
 * Get the API client instance
 * Uses singleton pattern for consistent access
 */
export function getApiClient(): IApiClient {
  if (!apiClientInstance) {
    apiClientInstance = createApiClient({ backend: currentBackend });
  }
  return apiClientInstance;
}

/**
 * Create a new API client based on configuration
 */
export function createApiClient(config: ApiClientConfig): IApiClient {
  switch (config.backend) {
    case 'supabase':
      return supabaseClient;
    
    case 'rest':
      if (!config.restConfig && !REST_API_BASE_URL) {
        throw new Error('REST API configuration is required. Set VITE_REST_API_URL or provide restConfig.');
      }
      return createRestApiClient(config.restConfig || { baseUrl: REST_API_BASE_URL });
    
    default:
      throw new Error(`Unknown API backend: ${config.backend}`);
  }
}

/**
 * Switch the API backend at runtime
 */
export function switchApiBackend(backend: ApiBackendType, restConfig?: RestApiConfig): void {
  currentBackend = backend;
  apiClientInstance = createApiClient({ backend, restConfig });
}

/**
 * Get the current backend type
 */
export function getCurrentBackend(): ApiBackendType {
  return currentBackend;
}

// Export the default API client
export const api = getApiClient();

// Re-export types and interfaces
export * from './types';
export * from './interfaces';
