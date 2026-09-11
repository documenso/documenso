import { bytesToHex, utf8ToBytes } from '@noble/ciphers/utils';
import { sha1 } from '@noble/hashes/legacy';

/**
 * Deterministic PDF object names for CSC TSP signing.
 *
 * Materialise-time and sign-time both derive these from the same
 * `(recipient, item [, page])` tuple — they MUST agree byte-for-byte.
 *
 * Output is opaque: SHA-1(label) hex-encoded uppercase (40 chars). The PDF
 * persists only the hex serial so recipient / envelope-item IDs never leak
 * into the document.
 */

const hashToOpaqueSerial = (label: string): string => bytesToHex(sha1(utf8ToBytes(label))).toUpperCase();

/** AcroForm signature-field name (TSP anchor) for a recipient + envelope item. */
export const buildTspAnchorName = (recipientId: number, envelopeItemId: string): string =>
  hashToOpaqueSerial(`recipient:${recipientId}|item:${envelopeItemId}`);

/** `/Stamp` annotation name for a recipient + envelope item on a specific page. */
export const buildTspStampName = (recipientId: number, envelopeItemId: string, pageNumber: number): string =>
  hashToOpaqueSerial(`recipient:${recipientId}|item:${envelopeItemId}|page:${pageNumber}`);
