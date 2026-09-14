import { describe, expect, it } from 'vitest';

import { NEXT_PUBLIC_WEBAPP_URL } from '../constants/app';
import { getDataContentImageUrl } from './envelope-download';

const BASE = `${NEXT_PUBLIC_WEBAPP_URL()}/api/files`;

describe('getDataContentImageUrl', () => {
  it('builds the session authenticated url', () => {
    const url = getDataContentImageUrl({
      envelopeId: 'envelope_1',
      dataContentId: 'data_1',
      token: undefined,
    });

    expect(url).toBe(`${BASE}/envelope/envelope_1/dataContent/data_1/image`);
  });

  it('appends the presign token for embedded access', () => {
    const url = getDataContentImageUrl({
      envelopeId: 'envelope_1',
      dataContentId: 'data_1',
      token: undefined,
      presignToken: 'presign_1',
    });

    expect(url).toBe(`${BASE}/envelope/envelope_1/dataContent/data_1/image?presignToken=presign_1`);
  });

  it('builds the recipient token url', () => {
    const url = getDataContentImageUrl({
      envelopeId: 'envelope_1',
      dataContentId: 'data_1',
      token: 'recipient_token',
    });

    expect(url).toBe(`${BASE}/token/recipient_token/envelope/envelope_1/dataContent/data_1/image`);
  });
});
