import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';

/**
 * Length-prefixed X.509 chain for `CscCredential.certCache`. Schema column is
 * `Bytes`; this gives a self-describing binary that round-trips without
 * base64 inflation. Format: u32 BE cert count, then per-cert u32 BE byte
 * length + raw DER bytes.
 *
 * Encoding inputs come from `cscCredentialsInfo.cert.certificates`, which the
 * CSC §11.5 spec defines as an array of base64-encoded DER X.509 certificates
 * (leaf-first). The encoder decodes each base64 entry once at persistence
 * time; the decoder is the symmetric inverse used at sign time.
 *
 * Pure functions, no I/O.
 */

const BASE64_REGEX = /^[A-Za-z0-9+/]+={0,2}$/;

/**
 * Encode a leaf-first chain of base64-encoded DER certs into the
 * length-prefixed binary form persisted on `CscCredential.certCache`.
 *
 * Throws `INVALID_REQUEST` when the input is empty or any entry is not valid
 * base64.
 */
export const encodeCscCertChain = (certs: string[]): Uint8Array => {
  if (certs.length === 0) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'CSC certificate chain encoding requires at least one certificate.',
    });
  }

  const derBuffers: Uint8Array[] = [];
  let totalDerBytes = 0;

  for (const entry of certs) {
    if (entry.length === 0 || !BASE64_REGEX.test(entry)) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'CSC certificate chain entry is not valid base64.',
      });
    }

    const der = Buffer.from(entry, 'base64');

    if (der.length === 0) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'CSC certificate chain entry decoded to zero bytes.',
      });
    }

    derBuffers.push(der);
    totalDerBytes += der.length;
  }

  // 4 bytes for the count + 4 bytes per-cert length prefix + raw DER bytes.
  const totalLength = 4 + derBuffers.length * 4 + totalDerBytes;
  const out = new Uint8Array(totalLength);
  const view = new DataView(out.buffer, out.byteOffset, out.byteLength);

  view.setUint32(0, derBuffers.length, false);

  let offset = 4;

  for (const der of derBuffers) {
    view.setUint32(offset, der.length, false);
    offset += 4;
    out.set(der, offset);
    offset += der.length;
  }

  return out;
};

/**
 * Decode a length-prefixed cert chain back into an array of DER cert byte
 * arrays. Inverse of {@link encodeCscCertChain}.
 *
 * Throws `INVALID_REQUEST` when the buffer is truncated or any per-cert
 * length prefix runs off the end of the buffer.
 */
export const decodeCscCertChain = (bytes: Uint8Array): Uint8Array[] => {
  if (bytes.byteLength < 4) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'CSC certificate chain buffer is too short to contain a count prefix.',
    });
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const count = view.getUint32(0, false);

  const result: Uint8Array[] = [];
  let offset = 4;

  for (let i = 0; i < count; i++) {
    if (offset + 4 > bytes.byteLength) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'CSC certificate chain buffer truncated at length prefix.',
      });
    }

    const length = view.getUint32(offset, false);
    offset += 4;

    if (length === 0 || offset + length > bytes.byteLength) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'CSC certificate chain buffer truncated within certificate body.',
      });
    }

    // Slice copies the underlying bytes so callers can't mutate the source.
    result.push(bytes.slice(offset, offset + length));
    offset += length;
  }

  if (offset !== bytes.byteLength) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'CSC certificate chain buffer has trailing bytes after declared chain end.',
    });
  }

  return result;
};
