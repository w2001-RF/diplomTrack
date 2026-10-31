// API client configuration

import type { IApiClient } from './interfaces';
import { createRestApiClient, type RestApiConfig } from './adapters/rest.adapter';

/**
 * Base URL of the Flask API. Defaults to the same-origin `/api`, which Nginx
 * proxies in production and the Vite dev server proxies in development.
 * VITE_REST_API_URL is the older name and is still accepted.
 */
export const API_BASE_URL: string =
  import.meta.env.VITE_API_URL || import.meta.env.VITE_REST_API_URL || '/api';

let apiClientInstance: IApiClient | null = null;

/**
 * Create a new API client. Pass a custom config to target another server.
 */
export function createApiClient(config: RestApiConfig = { baseUrl: API_BASE_URL }): IApiClient {
  return createRestApiClient(config);
}

/**
 * Get the shared API client instance
 */
export function getApiClient(): IApiClient {
  if (!apiClientInstance) {
    apiClientInstance = createApiClient();
  }
  return apiClientInstance;
}

// Export the default API client
export const api = getApiClient();

// Re-export types and interfaces
export * from './types';
export * from './interfaces';
export * from './models';
export type { RestApiConfig } from './adapters/rest.adapter';
