import { describe, expect, it } from 'vitest';

import { parseGoogleServiceAccountKey } from './google';

describe('parseGoogleServiceAccountKey', () => {
  it('parses valid JSON string with service account credentials', () => {
    const jsonKey = JSON.stringify({
      type: 'service_account',
      project_id: 'my-gcp-project',
      private_key: '-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n',
      client_email: 'sa-crove-sign@my-gcp-project.iam.gserviceaccount.com',
    });

    const parsed = parseGoogleServiceAccountKey(jsonKey);

    expect(parsed).toEqual({
      project_id: 'my-gcp-project',
      private_key: '-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n',
      client_email: 'sa-crove-sign@my-gcp-project.iam.gserviceaccount.com',
    });
  });

  it('parses base64-encoded JSON string', () => {
    const rawObj = {
      project_id: 'base64-project',
      private_key: 'secret-private-key',
      client_email: 'service-account@base64-project.iam.gserviceaccount.com',
    };

    const b64Key = Buffer.from(JSON.stringify(rawObj)).toString('base64');
    const parsed = parseGoogleServiceAccountKey(b64Key);

    expect(parsed).toEqual({
      project_id: 'base64-project',
      private_key: 'secret-private-key',
      client_email: 'service-account@base64-project.iam.gserviceaccount.com',
    });
  });

  it('returns undefined for empty, null, or undefined input', () => {
    expect(parseGoogleServiceAccountKey(undefined)).toBeUndefined();
    expect(parseGoogleServiceAccountKey(null)).toBeUndefined();
    expect(parseGoogleServiceAccountKey('')).toBeUndefined();
    expect(parseGoogleServiceAccountKey('   ')).toBeUndefined();
  });

  it('returns undefined when JSON is invalid or missing required keys', () => {
    expect(parseGoogleServiceAccountKey('invalid-json{')).toBeUndefined();
    expect(
      parseGoogleServiceAccountKey(
        JSON.stringify({
          project_id: 'incomplete',
          // missing private_key and client_email
        }),
      ),
    ).toBeUndefined();
  });
});
