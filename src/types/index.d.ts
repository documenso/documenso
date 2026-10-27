// TypeScript type definitions for documenso
// Resolves: AdminOrganisationOverviewTable sorting resets active search filter and page URL params

export interface DocumensoConfig {
  /** API key for authentication (required) */
  apiKey: string;
  /** Request timeout in milliseconds (default: 5000) */
  timeout?: number;
  /** Number of automatic retries on failure (default: 3) */
  retries?: number;
  /** Base URL for API requests */
  baseUrl?: string;
}

export interface DocumensoResult<T = unknown> {
  data: T;
  error: null;
  metadata: { timestamp: string; requestId: string };
}

export interface DocumensoError {
  data: null;
  error: { code: string; message: string; details?: unknown };
  metadata: { timestamp: string; requestId: string };
}

export type ApiResponse<T = unknown> = DocumensoResult<T> | DocumensoError;
