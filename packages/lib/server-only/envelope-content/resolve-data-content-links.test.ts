import { describe, expect, it } from 'vitest';

import { AppErrorCode } from '../../errors/app-error';
import { DataContentType } from '../../types/data-content-meta';
import { EnvelopeContentType } from '../../types/envelope-content-meta';
import { resolveDataContentLinks } from './resolve-data-content-links';

const ENVELOPE_ID = 'envelope_1';

const imageDataContent = (id: string, envelopeContent: { id: string; envelopeId: string } | null = null) => ({
  id,
  metadata: {
    type: DataContentType.IMAGE,
    width: 10,
    height: 10,
    mimeType: 'image/png' as const,
    fileName: 'image.png',
    fileSize: 100,
  },
  envelopeContent,
});

describe('resolveDataContentLinks', () => {
  it('returns no link for contents without a data content', () => {
    const links = resolveDataContentLinks({
      envelopeId: ENVELOPE_ID,
      contents: [
        { persistedId: null, contentType: EnvelopeContentType.TEXT, dataContentId: null },
        { persistedId: 'envelope_content_1', contentType: EnvelopeContentType.IMAGE, dataContentId: undefined },
      ],
      dataContents: [],
    });

    expect(links).toEqual([{ action: 'none' }, { action: 'none' }]);
  });

  it('links an unlinked data content', () => {
    const links = resolveDataContentLinks({
      envelopeId: ENVELOPE_ID,
      contents: [{ persistedId: null, contentType: EnvelopeContentType.IMAGE, dataContentId: 'data_1' }],
      dataContents: [imageDataContent('data_1')],
    });

    expect(links).toEqual([{ action: 'link', dataContentId: 'data_1' }]);
  });

  it('keeps a data content already linked to the same content', () => {
    const links = resolveDataContentLinks({
      envelopeId: ENVELOPE_ID,
      contents: [
        { persistedId: 'envelope_content_1', contentType: EnvelopeContentType.IMAGE, dataContentId: 'data_1' },
      ],
      dataContents: [imageDataContent('data_1', { id: 'envelope_content_1', envelopeId: ENVELOPE_ID })],
    });

    expect(links).toEqual([{ action: 'keep', dataContentId: 'data_1' }]);
  });

  it('clones a data content linked to a different content of the same envelope', () => {
    // A duplicated content initially references the original's data content.
    const links = resolveDataContentLinks({
      envelopeId: ENVELOPE_ID,
      contents: [
        { persistedId: 'envelope_content_1', contentType: EnvelopeContentType.IMAGE, dataContentId: 'data_1' },
        { persistedId: null, contentType: EnvelopeContentType.IMAGE, dataContentId: 'data_1' },
      ],
      dataContents: [imageDataContent('data_1', { id: 'envelope_content_1', envelopeId: ENVELOPE_ID })],
    });

    expect(links).toEqual([
      { action: 'keep', dataContentId: 'data_1' },
      { action: 'clone', sourceDataContentId: 'data_1' },
    ]);
  });

  it('clones when the same unlinked data content is claimed by multiple contents', () => {
    const links = resolveDataContentLinks({
      envelopeId: ENVELOPE_ID,
      contents: [
        { persistedId: null, contentType: EnvelopeContentType.IMAGE, dataContentId: 'data_1' },
        { persistedId: null, contentType: EnvelopeContentType.IMAGE, dataContentId: 'data_1' },
      ],
      dataContents: [imageDataContent('data_1')],
    });

    expect(links).toEqual([
      { action: 'link', dataContentId: 'data_1' },
      { action: 'clone', sourceDataContentId: 'data_1' },
    ]);
  });

  it('rejects a data content linked to a content of another envelope', () => {
    expect(() =>
      resolveDataContentLinks({
        envelopeId: ENVELOPE_ID,
        contents: [{ persistedId: null, contentType: EnvelopeContentType.IMAGE, dataContentId: 'data_1' }],
        dataContents: [imageDataContent('data_1', { id: 'envelope_content_other', envelopeId: 'envelope_other' })],
      }),
    ).toThrowError(expect.objectContaining({ code: AppErrorCode.NOT_FOUND }));
  });

  it('rejects an unknown data content', () => {
    expect(() =>
      resolveDataContentLinks({
        envelopeId: ENVELOPE_ID,
        contents: [{ persistedId: null, contentType: EnvelopeContentType.IMAGE, dataContentId: 'data_missing' }],
        dataContents: [],
      }),
    ).toThrowError(expect.objectContaining({ code: AppErrorCode.NOT_FOUND }));
  });

  it('rejects a data content on a content type which cannot hold data', () => {
    expect(() =>
      resolveDataContentLinks({
        envelopeId: ENVELOPE_ID,
        contents: [{ persistedId: null, contentType: EnvelopeContentType.TEXT, dataContentId: 'data_1' }],
        dataContents: [imageDataContent('data_1')],
      }),
    ).toThrowError(expect.objectContaining({ code: AppErrorCode.INVALID_REQUEST }));
  });
});
