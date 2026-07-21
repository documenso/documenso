const ALLOWED_PROTOCOLS = ['http', 'https'];

/**
 * Returns true only when `value` parses as an absolute URL using the http or
 * https protocol.
 *
 * Zod's `.url()` accepts any parseable URL, including non-web schemes. Use this
 * to restrict user-supplied URLs to http(s) before they are stored or rendered
 * as a link.
 */
export const isHttpUrl = (value: string) => {
  try {
    const url = new URL(value);

    return ALLOWED_PROTOCOLS.includes(url.protocol.slice(0, -1).toLowerCase());
  } catch {
    return false;
  }
};

/**
 * Returns the value to use for a link `href` only when it is an http(s) URL,
 * otherwise `undefined`. Use this when rendering user-supplied URLs as anchors,
 * including for older rows stored before URL validation was in place.
 */
export const toSafeHref = (value: string | null | undefined): string | undefined => {
  if (!value || !isHttpUrl(value)) {
    return undefined;
  }

  return value;
};
