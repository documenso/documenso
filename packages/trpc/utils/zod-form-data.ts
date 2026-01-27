import type { ZodRawShape } from 'zod';
import z from 'zod';

/**
 * This helper takes the place of the `z.object` at the root of your schema.
 * It wraps your schema in a `z.preprocess` that extracts all the data out of a `FormData`
 * and transforms it into a regular object.
 * If the `FormData` contains multiple entries with the same field name,
 * it will automatically turn that field into an array.
 *
 * This is used instead of `zfd.formData()` because it receives `undefined`
 * somewhere in the pipeline of our openapi schema generation and throws
 * an error. This provides the same functionality as `zfd.formData()` but
 * can be considered somewhat safer.
 */
export const zodFormData = <T extends ZodRawShape>(schema: T) => {
  return z.preprocess((data) => {
    if (data instanceof FormData) {
      const formData: Record<string, unknown> = {};

      for (const key of data.keys()) {
        const values = data.getAll(key);

        formData[key] = values.length > 1 ? values : values[0];
      }

      return formData;
    }

    return data;
  }, z.object(schema));
};
