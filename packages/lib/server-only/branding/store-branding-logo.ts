import { AppError, AppErrorCode } from '../../errors/app-error';
import { putFileServerSide } from '../../universal/upload/put-file.server';
import { optimiseBrandingLogo } from '../../utils/images/logo';

/**
 * Validate, sanitise and store an uploaded branding logo. Returns the
 * `JSON.stringify({ type, data })` reference persisted in the `brandingLogo`
 * column (the same format the serving endpoints already expect).
 */
export const buildBrandingLogoData = async (file: File): Promise<string> => {
  const buffer = Buffer.from(await file.arrayBuffer());

  const optimised = await optimiseBrandingLogo(buffer).catch(() => {
    throw new AppError(AppErrorCode.INVALID_BODY, {
      message: 'The branding logo must be a valid image file.',
    });
  });

  const documentData = await putFileServerSide({
    name: 'branding-logo.png',
    type: 'image/png',
    arrayBuffer: async () => Promise.resolve(optimised),
  });

  return JSON.stringify(documentData);
};
