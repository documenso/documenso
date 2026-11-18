export const SIGNATURE_CANVAS_DPI = 2;
export const SIGNATURE_MIN_COVERAGE_THRESHOLD = 0.01;

const PNG_DATA_URL_PREFIX = 'data:image/png;base64,';

// Base64 of the 8-byte PNG magic number.
const PNG_BASE64_MAGIC = 'iVBORw0KGgo';

export const isBase64Image = (value: string) => value.startsWith(PNG_DATA_URL_PREFIX);

// Stricter than `isBase64Image`: also checks the payload is a real PNG.
export const isPngSignatureDataUrl = (value: string) => {
  if (!isBase64Image(value)) {
    return false;
  }

  const payload = value.slice(PNG_DATA_URL_PREFIX.length);

  return payload.startsWith(PNG_BASE64_MAGIC) && /^[A-Za-z0-9+/]+=*$/.test(payload);
};
