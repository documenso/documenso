import { z } from 'zod';

import { isHttpUrl } from '../utils/is-http-url';

/**
 * Note this allows empty strings.
 */
export const ZUrlSchema = z.string().refine((value) => value === undefined || value === '' || isHttpUrl(value), {
  message: 'Please enter a valid URL, make sure you include http:// or https:// part of the url.',
});
