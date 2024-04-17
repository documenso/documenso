<<<<<<< HEAD
import { Field, Signature } from '@documenso/prisma/client';
=======
import type { Field, Signature } from '@documenso/prisma/client';
>>>>>>> main

export type FieldWithSignature = Field & {
  Signature?: Signature | null;
};
