import type { Agent } from 'http';
import { HttpsProxyAgent } from 'https-proxy-agent';
import fetch from 'node-fetch';
import { getProxyForUrl } from 'proxy-from-env';

export type TsaFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

const TSA_FETCH_TIMEOUT_MS = 30_000;

const resolveRequestUrl = (input: string | URL | Request): string => {
  if (typeof input === 'string') {
    return input;
  }

  if (input instanceof URL) {
    return input.href;
  }

  return input.url;
};

/**
 * Fetch implementation for TSA requests that respects HTTP_PROXY / HTTPS_PROXY /
 * NO_PROXY. LibPDF's HttpTimestampAuthority defaults to globalThis.fetch, which
 * does not route through a proxy unless NODE_USE_ENV_PROXY is enabled.
 */
export const createTsaFetch = (): TsaFetch => {
  const proxyAgentCache = new Map<string, Agent>();

  const getProxyAgent = (proxyUrl: string): Agent => {
    const cached = proxyAgentCache.get(proxyUrl);

    if (cached) {
      return cached;
    }

    const agent = new HttpsProxyAgent(proxyUrl);

    proxyAgentCache.set(proxyUrl, agent);

    return agent;
  };

  const tsaFetch: TsaFetch = async (input, init) => {
    const url = resolveRequestUrl(input);

    const proxyUrl = getProxyForUrl(url);

    const agent = proxyUrl ? getProxyAgent(proxyUrl) : undefined;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TSA_FETCH_TIMEOUT_MS);

    if (init?.signal) {
      init.signal.addEventListener('abort', () => controller.abort(), { once: true });
    }

    try {
      const response = await fetch(url, {
        ...init,
        agent,
        signal: controller.signal,
      });

      return response as unknown as Response;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`TSA request timed out after ${TSA_FETCH_TIMEOUT_MS}ms (${url})`);
      }

      throw error;
    } finally {
      clearTimeout(timeout);
    }
  };

  return tsaFetch;
};
