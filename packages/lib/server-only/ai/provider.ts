import { createAnthropic } from '@ai-sdk/anthropic';
import { createVertex } from '@ai-sdk/google-vertex';
import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModel } from 'ai';

import { env } from '../../utils/env';

export type AIProviderType = 'google-vertex' | 'anthropic' | 'openai-compatible';

/**
 * Returns the configured AI language model based on environment variables.
 *
 * Provider is selected via NEXT_PRIVATE_AI_PROVIDER (default: 'google-vertex').
 *
 * google-vertex:
 *   - GOOGLE_VERTEX_PROJECT_ID (required)
 *   - GOOGLE_VERTEX_API_KEY (required)
 *   - GOOGLE_VERTEX_LOCATION (optional, default: 'global')
 *   - NEXT_PRIVATE_AI_MODEL (optional, default: 'gemini-2.0-flash')
 *
 * anthropic:
 *   - NEXT_PRIVATE_ANTHROPIC_API_KEY (required)
 *   - NEXT_PRIVATE_AI_MODEL (optional, default: 'claude-opus-4-5')
 *
 * openai-compatible (OpenRouter, Ollama, etc.):
 *   - NEXT_PRIVATE_AI_BASE_URL (required)
 *   - NEXT_PRIVATE_AI_API_KEY (required)
 *   - NEXT_PRIVATE_AI_MODEL (required)
 */
export const getAIModel = (): LanguageModel => {
  const provider = (env('NEXT_PRIVATE_AI_PROVIDER') ?? 'google-vertex') as AIProviderType;

  switch (provider) {
    case 'google-vertex': {
      const vertex = createVertex({
        project: env('GOOGLE_VERTEX_PROJECT_ID'),
        location: env('GOOGLE_VERTEX_LOCATION') ?? 'global',
        apiKey: env('GOOGLE_VERTEX_API_KEY'),
      });

      return vertex(env('NEXT_PRIVATE_AI_MODEL') ?? 'gemini-2.0-flash');
    }

    case 'anthropic': {
      const anthropic = createAnthropic({
        apiKey: env('NEXT_PRIVATE_ANTHROPIC_API_KEY') ?? '',
      });

      return anthropic(env('NEXT_PRIVATE_AI_MODEL') ?? 'claude-opus-4-5');
    }

    case 'openai-compatible': {
      const openai = createOpenAI({
        baseURL: env('NEXT_PRIVATE_AI_BASE_URL') ?? '',
        apiKey: env('NEXT_PRIVATE_AI_API_KEY') ?? '',
      });

      const model = env('NEXT_PRIVATE_AI_MODEL');

      if (!model) {
        throw new Error(
          'NEXT_PRIVATE_AI_MODEL is required when using the openai-compatible provider',
        );
      }

      return openai(model);
    }

    default:
      throw new Error(
        `Unknown AI provider: "${provider}". Valid options: google-vertex, anthropic, openai-compatible`,
      );
  }
};

/**
 * Returns provider-specific options to pass to generateObject/generateText.
 * Non-applicable options are omitted so other providers ignore them cleanly.
 */
export const getAIProviderOptions = (): Record<string, unknown> => {
  const provider = (env('NEXT_PRIVATE_AI_PROVIDER') ?? 'google-vertex') as AIProviderType;

  if (provider === 'google-vertex') {
    return {
      google: {
        thinkingConfig: {
          thinkingLevel: 'low',
        },
      },
    };
  }

  return {};
};

export const isAIConfigured = (): boolean => {
  const provider = (env('NEXT_PRIVATE_AI_PROVIDER') ?? 'google-vertex') as AIProviderType;

  switch (provider) {
    case 'google-vertex':
      return !!env('GOOGLE_VERTEX_PROJECT_ID') && !!env('GOOGLE_VERTEX_API_KEY');

    case 'anthropic':
      return !!env('NEXT_PRIVATE_ANTHROPIC_API_KEY');

    case 'openai-compatible':
      return (
        !!env('NEXT_PRIVATE_AI_BASE_URL') &&
        !!env('NEXT_PRIVATE_AI_API_KEY') &&
        !!env('NEXT_PRIVATE_AI_MODEL')
      );

    default:
      return false;
  }
};
