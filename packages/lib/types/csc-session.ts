import { z } from 'zod';

/**
 * One entry in a CSC sign-time session, pinning the bytes (`documentDataId`)
 * whose digest (`hashB64`) was captured at prep time for a given envelope
 * item. The `ordinal` is the position of this entry in the session items array
 * — it lines up with the position-ordered `signatures/signHash` response per
 * CSC v1.0.4.0 §11.9.
 */
export const ZCscSessionItemSchema = z.object({
  envelopeItemId: z.string(),
  documentDataId: z.string(),
  hashB64: z.string(),
  ordinal: z.number().int().nonnegative(),
});

/**
 * Contract between CSC prep and sign on `CscSession.itemsJson`.
 *
 * Built at prep time alongside the captured signedAttrs digests. At sign time
 * the mutation re-derives each item's digest against the pinned
 * `documentDataId` bytes and dispatches one batched `signatures/signHash` per
 * recipient.
 */
export const ZCscSessionItemsSchema = z.array(ZCscSessionItemSchema);

export type TCscSessionItem = z.infer<typeof ZCscSessionItemSchema>;
export type TCscSessionItems = z.infer<typeof ZCscSessionItemsSchema>;
