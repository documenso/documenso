import crypto from 'crypto';

import { env } from '@documenso/lib/utils/env';

import { addSigningPlaceholder } from '../helpers/add-signing-placeholder';
import { updateSigningPlaceholder } from '../helpers/update-signing-placeholder';

export type SignWithTrustedSignaturesOptions = {
  pdf: Buffer;
};

export const signWithTrustedSignatures = async ({ pdf }: SignWithTrustedSignaturesOptions) => {
  const apiKeyId = env('NEXT_PRIVATE_SIGNING_TS_API_KEY_ID');

  if (!apiKeyId) {
    throw new Error('No API Key ID found for Trusted Signatures Signing');
  }
  const apiKeyHex = env('NEXT_PRIVATE_SIGNING_TS_API_KEY');

  if (!apiKeyHex) {
    throw new Error('No API Key found for Trusted Signatures Signing');
  }

  const tsaTimestamp = env('NEXT_PRIVATE_SIGNING_TS_TIMESTAMP') === 'true';

  const apiKey = Buffer.from(apiKeyHex, 'hex');

  const { pdf: pdfWithPlaceholder, byteRange } = updateSigningPlaceholder({
    pdf: await addSigningPlaceholder({ pdf }),
  });

  const pdfWithoutSignature = Buffer.concat([
    new Uint8Array(pdfWithPlaceholder.subarray(0, byteRange[1])),
    new Uint8Array(pdfWithPlaceholder.subarray(byteRange[2])),
  ]);

  const signatureLength = byteRange[2] - byteRange[1];

  const signature = await getPdfDigest({
    apiKeyId,
    apiKey,
    content: pdfWithoutSignature,
    tsaTimestamp,
  });

  const signatureAsHex = signature.toString('hex');

  const signedPdf = Buffer.concat([
    new Uint8Array(pdfWithPlaceholder.subarray(0, byteRange[1])),
    new Uint8Array(Buffer.from(`<${signatureAsHex.padEnd(signatureLength - 2, '0')}>`)),
    new Uint8Array(pdfWithPlaceholder.subarray(byteRange[2])),
  ]);

  return signedPdf;
};

const calculateSHA256Digest = (pdfBuffer: Buffer) => {
  return crypto.createHash('sha256').update(Uint8Array.from(pdfBuffer)).digest();
};

/**
 * Use the API Key to generate an HMAC-SHA256 digest that is used to authenticate the caller.
 * This authenticates the message and the sender. This must generate exactly the same bits
 * on the server.
 *
 * @param {*} message The message we want to sign
 * @returns the HMAC-SHA256(api-key, (request body + time)) where `request body` and `time`
 *    are the UTF-8 bytes of the body of the HTTP request and the time in the `X-Authorization-Time` header
 */
export const calculateAuthorizationToken = ({
  apiKey,
  message,
  timeAsIso8601String,
}: {
  apiKey: Buffer;
  message: string;
  timeAsIso8601String: string;
}) => {
  // convert apiKey to Uint8Array

  const hash = crypto.createHmac('sha256', Uint8Array.from(apiKey));
  hash.update(message);
  hash.update(timeAsIso8601String);
  return hash.digest();
};

/**
 * Send a signing request to the endpoint.
 *
 * @param {*} apiKeyId The UUID API Key ID
 * @param {*} message The message bytes we're sending
 * @param {*} hmac The HMAC-SHA256 authorization header
 * @param {*} timeAsIso8601String The current time used in calculating the hmac
 * @returns The response from the server (should be JSON)
 */
const sendMessageForSignature = async ({
  apiKeyId,
  message,
  hmac,
  timeAsIso8601String,
}: {
  apiKeyId: string;
  message: string;
  hmac: Buffer;
  timeAsIso8601String: string;
}) => {
  const url = 'https://api.trusted-signatures.com/v1/sign';
  const headers = {
    'User-Agent': 'Documenso',
    'Content-Type': 'application/json',
    'X-Authorization': hmac.toString('base64'),
    'X-Authorization-Time': timeAsIso8601String,
    'X-Authorization-Key': apiKeyId,
    'X-Authorization-Algorithm': 'HmacSHA256',
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: message,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    return await response.json();
  } catch (e) {
    console.error('Response:', e);
    throw e;
  }
};

// invoke our remote signing API, which uses an HSM to sign the digest and returns a DER of the
// signature, including the certificate chain, to be inserted back into the PDF

// Request MUST include the following headers to authenticate:
// 1. X-Authorization-Time: the current ISO-8601 time
// 2. X-Authorization-Key: the ID of the api key
// 3. X-Authorization: the authorization HMAC
export const requestSignatureFromAPI = async ({
  apiKeyId,
  apiKey,
  digest,
  tsaTimestamp,
}: {
  apiKeyId: string;
  apiKey: Buffer;
  digest: Buffer;
  tsaTimestamp: boolean;
}) => {
  const base64Digest = digest.toString('base64');
  const timeAsIso8601String = new Date().toISOString();
  const message = JSON.stringify({
    digestAlgorithm: 'SHA256',
    digest: base64Digest,
    tsaTimestamp,
  });
  const hmac = calculateAuthorizationToken({ apiKey, message, timeAsIso8601String });

  const response = await sendMessageForSignature({ message, hmac, timeAsIso8601String, apiKeyId });

  const base64Signature = response.signature;
  const bytes = Buffer.from(base64Signature, 'base64');
  return bytes;
};

const getPdfDigest = async ({
  apiKeyId,
  apiKey,
  content,
  tsaTimestamp,
}: {
  apiKeyId: string;
  apiKey: Buffer;
  content: Buffer;
  tsaTimestamp: boolean;
}) => {
  const digest = calculateSHA256Digest(content);
  const signature = await requestSignatureFromAPI({ apiKeyId, apiKey, digest, tsaTimestamp });

  return signature;
};
