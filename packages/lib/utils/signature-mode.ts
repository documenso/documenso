import { AppError, AppErrorCode } from '../errors/app-error';

export type SignatureMode = 'typed' | 'image';

/**
 * Subset of documentMeta needed to evaluate whether a given signature
 * input mode is permitted. All three flags are tri-state in the DB
 * (true / false / null|undefined); only an explicit `false` disables.
 */
export type SignatureModeSettings = {
  typedSignatureEnabled?: boolean | null;
  drawSignatureEnabled?: boolean | null;
  uploadSignatureEnabled?: boolean | null;
};

/**
 * Decide whether a signature submitted in `mode` is permitted by the
 * document's signature-input settings.
 *
 * Note: the server cannot distinguish a drawn signature from an uploaded
 * one — both arrive as a PNG data URL. We therefore treat the `image`
 * mode as allowed when *either* `drawSignatureEnabled` or
 * `uploadSignatureEnabled` is enabled, and only reject when *both* are
 * explicitly disabled.
 */
export const isSignatureModeAllowed = (mode: SignatureMode, settings: SignatureModeSettings): boolean => {
  if (mode === 'typed') {
    return settings.typedSignatureEnabled !== false;
  }

  return settings.drawSignatureEnabled !== false || settings.uploadSignatureEnabled !== false;
};

export const assertSignatureModeAllowed = (mode: SignatureMode, settings: SignatureModeSettings): void => {
  if (isSignatureModeAllowed(mode, settings)) {
    return;
  }

  const message =
    mode === 'typed'
      ? 'Typed signatures are not allowed. Please draw your signature'
      : 'Drawn or uploaded signatures are not allowed. Please type your signature';

  throw new AppError(AppErrorCode.INVALID_BODY, { message });
};
