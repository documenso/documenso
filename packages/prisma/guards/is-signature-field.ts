import { FieldType } from '@prisma/client';

const SignatureFieldTypes = [FieldType.SIGNATURE, FieldType.FREE_SIGNATURE] as const;

type SignatureFieldType = (typeof SignatureFieldTypes)[number];

export const isSignatureFieldType = (type: FieldType): type is SignatureFieldType => {
  return type === FieldType.SIGNATURE || type === FieldType.FREE_SIGNATURE;
};
