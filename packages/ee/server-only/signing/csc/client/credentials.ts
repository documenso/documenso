import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';

import { cscJsonPost, joinCscUrl } from './http';
import {
  type TCscCredentialsInfoRequest,
  type TCscCredentialsInfoResponse,
  type TCscCredentialsListRequest,
  type TCscCredentialsListResponse,
  ZCscCredentialsInfoResponseSchema,
  ZCscCredentialsListResponseSchema,
} from './types';

type CscCredentialsListOptions = TCscCredentialsListRequest & {
  baseUrl: string;
  /** Service-scope bearer token (CSC §11.4 + §11.9). */
  accessToken: string;
  signal?: AbortSignal;
};

/**
 * `credentials/list` (§11.4) — list the credentialIDs the bearer token's user
 * owns at the TSP.
 *
 * Throws `CSC_CREDENTIAL_LIST_EMPTY` when the TSP returns a successful
 * response with zero credentials — the recipient needs to enrol with the TSP
 * before they can sign. Other failures throw `CSC_REQUEST_FAILED`.
 *
 * `userID` MUST be omitted when the service authorization is user-specific
 * (true for OAuth `service` scope, which is V1's only flow). The spec rejects
 * the call with `invalid_request` if both are present.
 */
export const cscCredentialsList = async (opts: CscCredentialsListOptions): Promise<TCscCredentialsListResponse> => {
  const { baseUrl, accessToken, signal, userID, maxResults, pageToken, clientData } = opts;

  const body: Record<string, unknown> = {};

  if (userID !== undefined) {
    body.userID = userID;
  }

  if (maxResults !== undefined) {
    body.maxResults = maxResults;
  }

  if (pageToken !== undefined) {
    body.pageToken = pageToken;
  }

  if (clientData !== undefined) {
    body.clientData = clientData;
  }

  const response = await cscJsonPost(
    {
      url: joinCscUrl({ baseUrl, path: 'credentials/list' }),
      body,
      accessToken,
      signal,
    },
    ZCscCredentialsListResponseSchema,
  );

  if (response.credentialIDs.length === 0) {
    throw new AppError(AppErrorCode.CSC_CREDENTIAL_LIST_EMPTY, {
      message:
        'CSC provider returned no credentials for the authenticated user. Recipient must enrol with the TSP before signing.',
    });
  }

  return response;
};

type CscCredentialsInfoOptions = TCscCredentialsInfoRequest & {
  baseUrl: string;
  /** Service-scope bearer token. */
  accessToken: string;
  signal?: AbortSignal;
};

/**
 * `credentials/info` (§11.5) — fetch credential metadata: key algorithm tuple,
 * X.509 certificate chain, authorization mode, multisign capacity.
 *
 * Returns the parsed response verbatim. Cert validity, algorithm policy, and
 * SCAL semantics are enforced by `csc/algorithm-resolver.ts` — that lives
 * outside the client because it's domain logic, not transport.
 */
export const cscCredentialsInfo = async (opts: CscCredentialsInfoOptions): Promise<TCscCredentialsInfoResponse> => {
  const { baseUrl, accessToken, signal, credentialID, certificates, certInfo, authInfo, lang, clientData } = opts;

  const body: Record<string, unknown> = { credentialID };

  if (certificates !== undefined) {
    body.certificates = certificates;
  }

  if (certInfo !== undefined) {
    body.certInfo = certInfo;
  }

  if (authInfo !== undefined) {
    body.authInfo = authInfo;
  }

  if (lang !== undefined) {
    body.lang = lang;
  }

  if (clientData !== undefined) {
    body.clientData = clientData;
  }

  return await cscJsonPost(
    {
      url: joinCscUrl({ baseUrl, path: 'credentials/info' }),
      body,
      accessToken,
      signal,
    },
    ZCscCredentialsInfoResponseSchema,
  );
};
