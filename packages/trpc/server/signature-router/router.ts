import { router } from '../trpc';
import { completeQrSignatureRoute } from './qr/complete-qr-signature';
import { createQrSignatureRoute } from './qr/create-qr-signature';
import { getQrSignatureRoute } from './qr/get-qr-signature';
import { getQrSignatureSessionRoute } from './qr/get-qr-signature-session';

export const signatureRouter = router({
  qr: {
    create: createQrSignatureRoute,
    get: getQrSignatureRoute,
    getSession: getQrSignatureSessionRoute,
    complete: completeQrSignatureRoute,
  },
});
