import { CSC_INSTANCE_SIGNATURE_LEVEL, IS_INSTANCE_CSC_MODE } from '../../constants/app';
import { AppError, AppErrorCode } from '../../errors/app-error';
import { SignatureLevel, type TSignatureLevel } from '../../types/signature-level';

type ResolveSignatureLevelOptions = {
  /**
   * The signature level the caller wants the envelope created at. Optional;
   * when omitted the resolver returns the instance-mode default (`SES` for
   * non-CSC instances, `AES` for CSC instances).
   */
  requested?: TSignatureLevel;

  /**
   * When `true`, a conflict between `requested` and the current instance mode
   * throws `CSC_INSTANCE_MODE_MISMATCH` rather than being silently coerced.
   * When `false` (default), the resolver coerces incompatible inputs to the
   * instance default without throwing.
   *
   * Omitting `requested` is accepted in both modes — the resolver returns the
   * instance default rather than throwing.
   *
   * Use `strict: true` at call sites that take the level from external input
   * (e.g. a public API) where silent coercion would mask caller mistakes.
   */
  strict?: boolean;
};

/**
 * Resolve the signature level for a new envelope.
 *
 * Server-only. Reads the `NEXT_PRIVATE_SIGNING_TRANSPORT` env var via
 * {@link IS_INSTANCE_CSC_MODE} so call sites do not have to thread the
 * instance mode through their own arguments. On CSC instances the coerced
 * default also reads {@link CSC_INSTANCE_SIGNATURE_LEVEL} so operators can
 * pick `AES` (default) or `QES` per their TSP capability.
 *
 * Source of truth for the `Envelope.signatureLevel` write at create-time. The
 * column has no DB default by design — every caller flows through here so the
 * instance-mode contract is enforced consistently.
 *
 * Coerce mode (default, `strict: false`):
 *
 * | Instance | requested      | Result                              |
 * |----------|----------------|-------------------------------------|
 * | non-CSC  | omitted        | `SES`                               |
 * | non-CSC  | `SES`          | `SES`                               |
 * | non-CSC  | `AES` / `QES`  | `SES` (coerced)                     |
 * | CSC      | omitted        | `CSC_INSTANCE_SIGNATURE_LEVEL()`    |
 * | CSC      | `SES`          | `CSC_INSTANCE_SIGNATURE_LEVEL()`    |
 * | CSC      | `AES` / `QES`  | passes through                      |
 *
 * Strict mode (`strict: true`): same instance defaults for the omitted case,
 * but any conflict between `requested` and the instance mode throws
 * `CSC_INSTANCE_MODE_MISMATCH` instead of silently coercing.
 *
 * Note: on CSC instances an explicit `AES`/`QES` request always passes
 * through, even when it disagrees with `CSC_INSTANCE_SIGNATURE_LEVEL`. The
 * env var sets the *default* legal tier; it doesn't restrict what callers
 * can ask for. Cert-capability checks live at the TSP boundary.
 */
export const resolveSignatureLevel = ({
  requested,
  strict = false,
}: ResolveSignatureLevelOptions = {}): TSignatureLevel => {
  const isCscInstance = IS_INSTANCE_CSC_MODE();
  const instanceDefault = isCscInstance ? CSC_INSTANCE_SIGNATURE_LEVEL() : SignatureLevel.SES;

  if (requested === undefined) {
    return instanceDefault;
  }

  const isCompatible = isCscInstance ? requested !== SignatureLevel.SES : requested === SignatureLevel.SES;

  if (isCompatible) {
    return requested;
  }

  if (strict) {
    throw new AppError(AppErrorCode.CSC_INSTANCE_MODE_MISMATCH, {
      message: isCscInstance
        ? `signatureLevel '${requested}' is not supported on a CSC-mode instance — every recipient must sign through the configured Trust Service Provider.`
        : `signatureLevel '${requested}' is not supported on a non-CSC instance — only 'SES' is permitted unless the CSC signing transport is configured.`,
    });
  }

  return instanceDefault;
};
