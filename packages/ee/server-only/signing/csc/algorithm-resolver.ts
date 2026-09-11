import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';

import type { TCscCredentialsInfoResponse } from './client/types';

/**
 * CSC QES V1 algorithm policy.
 *
 * Single OID-to-algorithm map + single helper that:
 * - validates cert state (status, validity window) → `CSC_CERT_INVALID`,
 * - validates the credential's key + algorithm against the spec's policy
 *   table (RSA ≥2048, ECDSA P-256/384/521, SHA-256/384/512) →
 *   `CSC_ALGORITHM_REFUSED`,
 * - resolves a concrete `(signAlgo, hashAlgo)` OID pair for §11.9.
 *
 * Called at the service-scope OAuth callback (validation boundary) and
 * re-called at sign time as a defence-in-depth pre-check. Persisted fields
 * (`keyType` / `keyLenBits` / `digestAlgorithm` / `signAlgoOid`) round-trip
 * through `CscCredential`.
 */

export type CscKeyType = 'RSA' | 'ECDSA';

export type CscDigest = 'SHA-256' | 'SHA-384' | 'SHA-512';

export type CscEcdsaCurve = 'P-256' | 'P-384' | 'P-521';

export type CscAlgorithmPolicy = {
  keyType: CscKeyType;
  keyLenBits: number;
  digestAlgorithm: CscDigest;
  /** OID for `signatures/signHash.signAlgo` + persisted on `CscCredential`. */
  signAlgoOid: string;
  /** OID for `signatures/signHash.hashAlgo`. */
  hashAlgoOid: string;
  /** ECDSA named curve (informational; not separately persisted). */
  ecdsaCurve?: CscEcdsaCurve;
};

/**
 * Default RSA digest when the TSP advertises only hash-agnostic RSA OIDs
 * (plain `rsaEncryption` / RSASSA-PSS). SHA-256 matches the CSC §11.9
 * sample and is universally TSP-supported.
 */
const DEFAULT_RSA_DIGEST: CscDigest = 'SHA-256';

const HASH_OID_FOR_DIGEST: Record<CscDigest, string> = {
  'SHA-256': '2.16.840.1.101.3.4.2.1',
  'SHA-384': '2.16.840.1.101.3.4.2.2',
  'SHA-512': '2.16.840.1.101.3.4.2.3',
};

/**
 * Exposed lookup for the `signatures/signHash.hashAlgo` OID corresponding to a
 * resolved {@link CscDigest}. Useful at sign time when the policy's
 * `hashAlgoOid` field is not in scope (e.g. when reconstructing a
 * `LibpdfSignerAlgo` from a persisted `CscCredential` row).
 */
export const hashOidForDigest = (digest: CscDigest): string => HASH_OID_FOR_DIGEST[digest];

const DIGEST_STRENGTH: Record<CscDigest, number> = {
  'SHA-256': 256,
  'SHA-384': 384,
  'SHA-512': 512,
};

const STRONG_DIGEST_SET = new Set<string>(['SHA-256', 'SHA-384', 'SHA-512']);

type AlgoOidInfo = { family: 'RSA' | 'ECDSA'; boundDigest: CscDigest | 'SHA-1' | 'MD5' | null } | { family: 'DSA' };

/**
 * Source-of-truth registry for `key.algo` entries (§11.5). Anything not
 * listed is treated as unknown and skipped at policy evaluation.
 */
const KEY_ALGO_OID_REGISTRY: Record<string, AlgoOidInfo> = {
  // Hash-agnostic RSA — caller picks the hash via `hashAlgo`.
  '1.2.840.113549.1.1.1': { family: 'RSA', boundDigest: null }, // rsaEncryption
  '1.2.840.113549.1.1.10': { family: 'RSA', boundDigest: null }, // RSASSA-PSS

  // Hash-bound legacy RSA combos.
  '1.2.840.113549.1.1.4': { family: 'RSA', boundDigest: 'MD5' }, // md5WithRSAEncryption
  '1.2.840.113549.1.1.5': { family: 'RSA', boundDigest: 'SHA-1' }, // sha1WithRSAEncryption
  '1.2.840.113549.1.1.11': { family: 'RSA', boundDigest: 'SHA-256' }, // sha256WithRSAEncryption
  '1.2.840.113549.1.1.12': { family: 'RSA', boundDigest: 'SHA-384' }, // sha384WithRSAEncryption
  '1.2.840.113549.1.1.13': { family: 'RSA', boundDigest: 'SHA-512' }, // sha512WithRSAEncryption

  // ECDSA with SHA-x (hash is always bound).
  '1.2.840.10045.4.1': { family: 'ECDSA', boundDigest: 'SHA-1' }, // ecdsa-with-SHA1
  '1.2.840.10045.4.3.2': { family: 'ECDSA', boundDigest: 'SHA-256' },
  '1.2.840.10045.4.3.3': { family: 'ECDSA', boundDigest: 'SHA-384' },
  '1.2.840.10045.4.3.4': { family: 'ECDSA', boundDigest: 'SHA-512' },

  // DSA — refused outright.
  '1.2.840.10040.4.1': { family: 'DSA' },
  '1.2.840.10040.4.3': { family: 'DSA' }, // dsa-with-SHA1
};

/**
 * ECDSA named-curve OID registry. Policy verdict (allow/refuse) is decided
 * by the resolver from the resolved curve name, not encoded here.
 */
const CURVE_OID_REGISTRY: Record<string, CscEcdsaCurve | 'P-192' | 'P-224'> = {
  '1.2.840.10045.3.1.7': 'P-256', // secp256r1
  '1.3.132.0.34': 'P-384', // secp384r1
  '1.3.132.0.35': 'P-521', // secp521r1
  '1.2.840.10045.3.1.1': 'P-192', // secp192r1
  '1.3.132.0.33': 'P-224', // secp224r1
};

/**
 * Validate a CSC credential's cert + key/algorithm against V1 policy and
 * resolve the `(signAlgo, hashAlgo)` OID pair used by `signatures/signHash`.
 *
 * Caller MUST fetch the credential with `certInfo: true` so `cert.validFrom`
 * / `cert.validTo` are present.
 *
 * Throws:
 * - `CSC_CERT_INVALID` for cert-state issues (status not `valid`, missing or
 *   malformed validity dates, current time outside the validity window).
 * - `CSC_ALGORITHM_REFUSED` for key/algorithm policy failures (disabled key,
 *   missing `key.len`, RSA `< 2048`, ECDSA without an allowed curve, DSA, no
 *   acceptable digest advertised in `key.algo`).
 */
export const resolveCscAlgorithmPolicy = (credentialInfo: TCscCredentialsInfoResponse): CscAlgorithmPolicy => {
  assertCertValid(credentialInfo.cert);

  if (credentialInfo.key.status !== 'enabled') {
    throw new AppError(AppErrorCode.CSC_ALGORITHM_REFUSED, {
      message: `CSC credential key status is '${credentialInfo.key.status}'.`,
    });
  }

  if (credentialInfo.key.len === undefined) {
    throw new AppError(AppErrorCode.CSC_ALGORITHM_REFUSED, {
      message: 'CSC credential omits required key.len (REQUIRED per §11.5).',
    });
  }

  const choice = pickAlgorithmChoice(credentialInfo.key.algo);

  if (choice.family === 'RSA') {
    if (credentialInfo.key.len < 2048) {
      throw new AppError(AppErrorCode.CSC_ALGORITHM_REFUSED, {
        message: `CSC RSA credential keyLen ${credentialInfo.key.len} < 2048.`,
      });
    }

    return {
      keyType: 'RSA',
      keyLenBits: credentialInfo.key.len,
      digestAlgorithm: choice.digest,
      signAlgoOid: choice.signAlgoOid,
      hashAlgoOid: HASH_OID_FOR_DIGEST[choice.digest],
    };
  }

  const curve = resolveEcdsaCurve(credentialInfo.key.curve);

  return {
    keyType: 'ECDSA',
    keyLenBits: credentialInfo.key.len,
    digestAlgorithm: choice.digest,
    signAlgoOid: choice.signAlgoOid,
    hashAlgoOid: HASH_OID_FOR_DIGEST[choice.digest],
    ecdsaCurve: curve,
  };
};

type AlgorithmChoice = {
  family: 'RSA' | 'ECDSA';
  signAlgoOid: string;
  digest: CscDigest;
};

/**
 * Iterate the TSP's advertised `key.algo` OIDs, drop the policy-refused
 * entries, and pick the strongest survivor.
 *
 * Precedence: ECDSA before RSA (smaller signatures, modern); within each
 * family, strongest advertised digest first. Hash-agnostic RSA OIDs pair
 * with {@link DEFAULT_RSA_DIGEST}.
 */
const pickAlgorithmChoice = (algoOids: readonly string[]): AlgorithmChoice => {
  const candidates: AlgorithmChoice[] = [];

  for (const oid of algoOids) {
    const info = KEY_ALGO_OID_REGISTRY[oid];

    if (info === undefined) {
      // Unknown OID — another entry in `key.algo` may still be acceptable.
      continue;
    }

    if (info.family === 'DSA') {
      continue;
    }

    if (info.boundDigest === null) {
      candidates.push({
        family: info.family,
        signAlgoOid: oid,
        digest: DEFAULT_RSA_DIGEST,
      });
      continue;
    }

    if (STRONG_DIGEST_SET.has(info.boundDigest)) {
      candidates.push({
        family: info.family,
        signAlgoOid: oid,
        digest: info.boundDigest as CscDigest,
      });
    }
  }

  if (candidates.length === 0) {
    throw new AppError(AppErrorCode.CSC_ALGORITHM_REFUSED, {
      message: `CSC credential advertises no policy-compliant key.algo OIDs (got: ${algoOids.join(', ') || '<empty>'}).`,
    });
  }

  candidates.sort((a, b) => {
    if (a.family !== b.family) {
      return a.family === 'ECDSA' ? -1 : 1;
    }

    return DIGEST_STRENGTH[b.digest] - DIGEST_STRENGTH[a.digest];
  });

  return candidates[0];
};

const resolveEcdsaCurve = (curveOid: string | undefined): CscEcdsaCurve => {
  if (curveOid === undefined || curveOid === '') {
    throw new AppError(AppErrorCode.CSC_ALGORITHM_REFUSED, {
      message: 'CSC ECDSA credential omits required key.curve.',
    });
  }

  const named = CURVE_OID_REGISTRY[curveOid];

  if (named === 'P-256' || named === 'P-384' || named === 'P-521') {
    return named;
  }

  const detail = named ? `, named=${named}` : '';

  throw new AppError(AppErrorCode.CSC_ALGORITHM_REFUSED, {
    message: `CSC ECDSA credential uses refused curve (oid=${curveOid}${detail}).`,
  });
};

const assertCertValid = (cert: TCscCredentialsInfoResponse['cert']): void => {
  if (cert.status !== undefined && cert.status !== 'valid') {
    throw new AppError(AppErrorCode.CSC_CERT_INVALID, {
      message: `CSC credential certificate status is '${cert.status}'.`,
    });
  }

  if (!cert.validFrom || !cert.validTo) {
    throw new AppError(AppErrorCode.CSC_CERT_INVALID, {
      message: 'CSC credential certificate omits validFrom/validTo (malformed).',
    });
  }

  const validFromMs = parseGeneralizedTime(cert.validFrom);
  const validToMs = parseGeneralizedTime(cert.validTo);

  if (validFromMs === null || validToMs === null) {
    throw new AppError(AppErrorCode.CSC_CERT_INVALID, {
      message: `CSC credential certificate validity dates are malformed (validFrom=${cert.validFrom}, validTo=${cert.validTo}).`,
    });
  }

  const now = Date.now();

  if (now < validFromMs) {
    throw new AppError(AppErrorCode.CSC_CERT_INVALID, {
      message: `CSC credential certificate is not yet valid (validFrom=${cert.validFrom}).`,
    });
  }

  if (now > validToMs) {
    throw new AppError(AppErrorCode.CSC_CERT_INVALID, {
      message: `CSC credential certificate has expired (validTo=${cert.validTo}).`,
    });
  }
};

/**
 * Parse an X.509 GeneralizedTime string (`YYYYMMDDHHMMSSZ`) into epoch ms.
 * Strict — returns null on any deviation from the §11.5 example format.
 */
const parseGeneralizedTime = (value: string): number | null => {
  const matched = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})Z$/.exec(value);

  if (matched === null) {
    return null;
  }

  const [, y, mo, d, h, mi, s] = matched;

  const ms = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s));

  return Number.isNaN(ms) ? null : ms;
};

/**
 * Subset of libpdf's `Signer` interface fields derived from a `CscAlgorithmPolicy`.
 * Used by `CscCaptureSigner` / `CscFifoSigner` to satisfy libpdf's signer
 * contract without re-deriving the mapping at each call site. `keyLenBits`
 * is carried through so the capture-signer can size its placeholder output
 * appropriately for the chosen key.
 */
export type LibpdfSignerAlgo = {
  keyType: 'RSA' | 'EC';
  signatureAlgorithm: 'RSASSA-PKCS1-v1_5' | 'RSA-PSS' | 'ECDSA';
  digestAlgorithm: CscDigest;
  keyLenBits: number;
};

/**
 * Translate a `CscAlgorithmPolicy` (CSC §11.5 OIDs) into libpdf's `Signer`
 * algorithm tuple. RSASSA-PSS is detected by the `signAlgoOid`; everything
 * else maps directly from `keyType` + `digestAlgorithm`.
 */
export const policyToLibpdfSignerAlgo = (policy: CscAlgorithmPolicy): LibpdfSignerAlgo => {
  if (policy.keyType === 'ECDSA') {
    return {
      keyType: 'EC',
      signatureAlgorithm: 'ECDSA',
      digestAlgorithm: policy.digestAlgorithm,
      keyLenBits: policy.keyLenBits,
    };
  }

  // RSA — distinguish PKCS1-v1.5 from PSS by the resolved sign-algo OID.
  // RSASSA-PSS OID: '1.2.840.113549.1.1.10'.
  const signatureAlgorithm: 'RSASSA-PKCS1-v1_5' | 'RSA-PSS' =
    policy.signAlgoOid === '1.2.840.113549.1.1.10' ? 'RSA-PSS' : 'RSASSA-PKCS1-v1_5';

  return {
    keyType: 'RSA',
    signatureAlgorithm,
    digestAlgorithm: policy.digestAlgorithm,
    keyLenBits: policy.keyLenBits,
  };
};
