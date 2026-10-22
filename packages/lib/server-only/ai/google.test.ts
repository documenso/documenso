import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import { DEFAULT_VERTEX_MODEL, getVertexModel } from './google';

describe('Vertex AI Model Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('defaults to gemini-3-flash-preview when GOOGLE_VERTEX_MODEL is unset', () => {
    delete process.env.GOOGLE_VERTEX_MODEL;
    expect(DEFAULT_VERTEX_MODEL).toBe('gemini-3-flash-preview');
    const model = getVertexModel();
    expect(model.modelId).toBe('gemini-3-flash-preview');
  });

  it('uses GOOGLE_VERTEX_MODEL when specified in environment variables', () => {
    process.env.GOOGLE_VERTEX_MODEL = 'gemini-2.5-flash';
    const model = getVertexModel();
    expect(model.modelId).toBe('gemini-2.5-flash');
  });

  it('allows explicit model override passed to getVertexModel', () => {
    process.env.GOOGLE_VERTEX_MODEL = 'gemini-2.5-flash';
    const model = getVertexModel('gemini-2.5-pro');
    expect(model.modelId).toBe('gemini-2.5-pro');
  });
});
