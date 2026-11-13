import type { TEmbedAuthRedeemResult } from '@documenso/auth/client';
import { authClient } from '@documenso/auth/client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { match } from 'ts-pattern';
import { z } from 'zod';

import { formatPath } from '../../constants/app';
import type { EmbedPopupAuthCscOptions, EmbedPopupAuthProvider } from '../../constants/embed-auth';
import {
  EMBED_AUTH_MESSAGE_NONCE,
  EMBED_AUTH_POPUP_PATH,
  EMBED_AUTH_POPUP_WINDOW_FEATURES,
  EMBED_AUTH_POPUP_WINDOW_NAME,
  ZEmbedAuthCompleteMessageSchema,
  ZEmbedAuthFailedMessageSchema,
  ZEmbedAuthReadyMessageSchema,
} from '../../constants/embed-auth';
import { alphaid } from '../../universal/id';
import { sleep } from '../../universal/sleep';

const REDEEM_POLL_INTERVAL_MS = 2_000;

const REDEEM_POLL_INITIAL_DELAY_MS = 5_000;

const REDEEM_RATE_LIMITED_DELAY_MS = 5_000;

const REDEEM_MAX_CONSECUTIVE_FAILURES = 3;

/**
 * Matches the server-side embed auth flow cookie max-age.
 *
 * `popup.closed` is deliberately not used to detect cancellation: some IdPs
 * (Google) enforce `Cross-Origin-Opener-Policy: same-origin`, which severs the
 * opener link and makes `closed` report true while the popup is still open.
 */
const FLOW_TIMEOUT_MS = 10 * 60 * 1_000;

const STORAGE_ACCESS_REDEEM_ATTEMPTS = 5;

const STORAGE_ACCESS_REDEEM_INTERVAL_MS = 1_000;

const CSC_SESSION_STATUS_PATH = '/api/csc/session-status';

const ZCscSessionStatusResponseSchema = z.object({
  active: z.boolean(),
});

export type { EmbedPopupAuthCscOptions, EmbedPopupAuthProvider };

export type EmbedPopupAuthStatus = 'idle' | 'waiting' | 'redeeming' | 'needs-storage-access' | 'success' | 'error';

export type EmbedPopupAuthError =
  | 'popup-blocked'
  | 'timeout'
  | 'auth-failed'
  | 'cookie-blocked'
  | 'storage-access-denied'
  | 'request-failed';

export type UseEmbedPopupAuthOptions = {
  onSuccess: () => void;
};

type EmbedPopupAuthBaseStartOptions = {
  email?: string;

  /**
   * Window pre-opened via `openPopupWindow()` inside the click's user activation,
   * for callers that need async work before `start`.
   */
  popup?: Window | null;
};

export type EmbedPopupAuthCscStartOptions = EmbedPopupAuthBaseStartOptions & {
  csc: EmbedPopupAuthCscOptions;
};

export type EmbedPopupAuthAccountStartOptions = EmbedPopupAuthBaseStartOptions & {
  csc?: never;
};

export type EmbedPopupAuthStartOptions = EmbedPopupAuthCscStartOptions | EmbedPopupAuthAccountStartOptions;

export type EmbedPopupAuthStart = {
  (provider: 'csc', options: EmbedPopupAuthCscStartOptions): void;
  (provider: Exclude<EmbedPopupAuthProvider, 'csc'>, options?: EmbedPopupAuthAccountStartOptions): void;
};

/**
 * Email and CSC options travel in the fragment, not the query string, so they
 * never reach the server with the page request.
 */
const buildPopupHash = (options: EmbedPopupAuthStartOptions): string => {
  const params = new URLSearchParams();

  if (options.email) {
    params.set('email', options.email);
  }

  if (options.csc) {
    params.set('scope', options.csc.scope);
    params.set('token', options.csc.token);

    if (options.csc.scope === 'credential') {
      params.set('sessionId', options.csc.sessionId);
    }
  }

  const hash = params.toString();

  return hash ? `#${hash}` : '';
};

const buildPopupWindowName = () => `${EMBED_AUTH_POPUP_WINDOW_NAME}-${alphaid(6)}`;

/**
 * Must be called synchronously from a click handler so `window.open` is not
 * blocked. Returns null when it was.
 */
export const openPopupWindow = (): Window | null => {
  return window.open('about:blank', buildPopupWindowName(), EMBED_AUTH_POPUP_WINDOW_FEATURES);
};

type Attempt = {
  nonce: string;
  generation: number;
  popup: Window | null;
  isActive: boolean;
  isRedeemInFlight: boolean;
  shouldRedeemImmediately: boolean;
  consecutiveFailures: number;
  redeemTimer: number | null;
  flowTimeout: number | null;
  onMessage: ((event: MessageEvent) => void) | null;
};

/**
 * CSC handoffs do not create a user session, so `getSession()` cannot verify
 * the redeemed cookie landed in the iframe's partition.
 */
const hasCscSession = async (csc: EmbedPopupAuthCscOptions): Promise<boolean> => {
  const params = new URLSearchParams({ scope: csc.scope, token: csc.token });

  if (csc.scope === 'credential') {
    params.set('sessionId', csc.sessionId);
  }

  try {
    const response = await fetch(`${formatPath(CSC_SESSION_STATUS_PATH)}?${params.toString()}`, {
      credentials: 'include',
    });

    if (!response.ok) {
      return false;
    }

    const result = ZCscSessionStatusResponseSchema.safeParse(await response.json());

    return result.success && result.data.active;
  } catch {
    return false;
  }
};

/**
 * Drives the embed popup login flow from inside a cross-site embed iframe.
 *
 * `start()` and `continueWithStorageAccess()` must be called synchronously from
 * a click handler (`window.open` and `requestStorageAccess` need user activation).
 *
 * The nonce is only ever exchanged via same-origin `postMessage` and request
 * bodies, never a URL.
 */
export const useEmbedPopupAuth = ({ onSuccess }: UseEmbedPopupAuthOptions) => {
  const [status, setStatusState] = useState<EmbedPopupAuthStatus>('idle');
  const [error, setError] = useState<EmbedPopupAuthError | null>(null);

  // Synchronous mirror so `reset()` then `start()` in one click handler works.
  const statusRef = useRef<EmbedPopupAuthStatus>('idle');

  const setStatus = useCallback((next: EmbedPopupAuthStatus) => {
    statusRef.current = next;
    setStatusState(next);
  }, []);

  const attemptRef = useRef<Attempt | null>(null);
  const nonceRef = useRef<string | null>(null);

  // Async continuations bail out after each await if this has moved on, so a
  // cancelled or superseded flow can never flip status or fire `onSuccess` late.
  const generationRef = useRef(0);

  const verifyCookieRef = useRef<(() => Promise<boolean>) | null>(null);

  // Redeem always overwrites the embed cookie, so an unchanged session id means
  // the browser dropped it and a stale cookie is still being sent.
  const sessionSnapshotRef = useRef<Promise<string | null> | null>(null);

  const onSuccessRef = useRef(onSuccess);

  onSuccessRef.current = onSuccess;

  const teardownAttempt = useCallback(() => {
    const attempt = attemptRef.current;

    if (!attempt) {
      return;
    }

    attempt.isActive = false;

    if (attempt.redeemTimer !== null) {
      window.clearTimeout(attempt.redeemTimer);
    }

    if (attempt.flowTimeout !== null) {
      window.clearTimeout(attempt.flowTimeout);
    }

    if (attempt.onMessage) {
      window.removeEventListener('message', attempt.onMessage);
    }

    attemptRef.current = null;
  }, []);

  const fail = useCallback(
    (code: EmbedPopupAuthError, generation: number) => {
      if (generation !== generationRef.current) {
        return;
      }

      teardownAttempt();

      setError(code);
      setStatus('error');
    },
    [teardownAttempt, setStatus],
  );

  const hasSession = useCallback(async () => {
    try {
      const [session, snapshotSessionId] = await Promise.all([
        authClient.embed.getSession(),
        sessionSnapshotRef.current ?? Promise.resolve(null),
      ]);

      if (!session.user) {
        return false;
      }

      return snapshotSessionId === null || session.session.id !== snapshotSessionId;
    } catch {
      return false;
    }
  }, []);

  const verifyCookie = useCallback(() => {
    const verify = verifyCookieRef.current ?? hasSession;

    return verify();
  }, [hasSession]);

  const finalize = useCallback(
    async (attempt: Attempt) => {
      const { generation } = attempt;

      if (generation !== generationRef.current) {
        return;
      }

      teardownAttempt();

      setStatus('redeeming');

      const isSignedIn = await verifyCookie();

      if (generation !== generationRef.current) {
        return;
      }

      if (isSignedIn) {
        setStatus('success');
        onSuccessRef.current();

        return;
      }

      if (typeof document.requestStorageAccess === 'function') {
        setStatus('needs-storage-access');

        return;
      }

      fail('cookie-blocked', generation);
    },
    [teardownAttempt, verifyCookie, fail, setStatus],
  );

  const scheduleRedeem = useCallback((attempt: Attempt, delay: number, run: (attempt: Attempt) => void) => {
    if (attempt.redeemTimer !== null) {
      window.clearTimeout(attempt.redeemTimer);
    }

    attempt.redeemTimer = window.setTimeout(() => {
      attempt.redeemTimer = null;

      run(attempt);
    }, delay);
  }, []);

  const runRedeem = useCallback(
    async (attempt: Attempt) => {
      if (!attempt.isActive) {
        return;
      }

      if (attempt.isRedeemInFlight) {
        attempt.shouldRedeemImmediately = true;

        return;
      }

      if (attempt.redeemTimer !== null) {
        window.clearTimeout(attempt.redeemTimer);
        attempt.redeemTimer = null;
      }

      attempt.isRedeemInFlight = true;
      attempt.shouldRedeemImmediately = false;

      let result: TEmbedAuthRedeemResult | null = null;

      try {
        result = await authClient.embed.redeem({ nonce: attempt.nonce });
      } catch {
        result = null;
      }

      attempt.isRedeemInFlight = false;

      if (!attempt.isActive) {
        return;
      }

      if (result === null) {
        attempt.consecutiveFailures += 1;

        if (attempt.consecutiveFailures >= REDEEM_MAX_CONSECUTIVE_FAILURES) {
          fail('request-failed', attempt.generation);

          return;
        }

        scheduleRedeem(attempt, REDEEM_POLL_INTERVAL_MS, (next) => void runRedeem(next));

        return;
      }

      attempt.consecutiveFailures = 0;

      if (result === 'failed') {
        fail('auth-failed', attempt.generation);

        return;
      }

      const delay = match(result)
        .with('ok', () => null)
        .with('pending', () => (attempt.shouldRedeemImmediately ? 0 : REDEEM_POLL_INTERVAL_MS))
        .with('rate-limited', () => REDEEM_RATE_LIMITED_DELAY_MS)
        .exhaustive();

      if (delay === null) {
        void finalize(attempt);

        return;
      }

      scheduleRedeem(attempt, delay, (next) => void runRedeem(next));
    },
    [fail, finalize, scheduleRedeem],
  );

  const start = useCallback<EmbedPopupAuthStart>(
    (provider: EmbedPopupAuthProvider, options: EmbedPopupAuthStartOptions = {}) => {
      const closePreOpenedPopup = () => {
        if (options.popup && !options.popup.closed) {
          options.popup.close();
        }
      };

      if (statusRef.current !== 'idle' && statusRef.current !== 'error') {
        closePreOpenedPopup();

        return;
      }

      teardownAttempt();

      generationRef.current += 1;

      const generation = generationRef.current;

      setError(null);

      const nonce = crypto.randomUUID();

      nonceRef.current = nonce;

      const csc = options.csc;

      verifyCookieRef.current = csc ? async () => hasCscSession(csc) : hasSession;

      sessionSnapshotRef.current = authClient.embed
        .getSession()
        .then((session) => session.session?.id ?? null)
        .catch(() => null);

      const attempt: Attempt = {
        nonce,
        generation,
        popup: null,
        isActive: true,
        isRedeemInFlight: false,
        shouldRedeemImmediately: false,
        consecutiveFailures: 0,
        redeemTimer: null,
        flowTimeout: null,
        onMessage: null,
      };

      const onMessage = (event: MessageEvent) => {
        const popup = attempt.popup;

        if (!attempt.isActive || !popup) {
          return;
        }

        if (event.origin !== window.location.origin || event.source !== popup) {
          return;
        }

        if (ZEmbedAuthReadyMessageSchema.safeParse(event.data).success) {
          popup.postMessage({ type: EMBED_AUTH_MESSAGE_NONCE, nonce }, window.location.origin);

          return;
        }

        if (ZEmbedAuthCompleteMessageSchema.safeParse(event.data).success) {
          void runRedeem(attempt);

          return;
        }

        if (ZEmbedAuthFailedMessageSchema.safeParse(event.data).success) {
          fail('auth-failed', generation);
        }
      };

      attempt.onMessage = onMessage;

      window.addEventListener('message', onMessage);

      const popupHash = buildPopupHash(options);

      const popupUrl = `${formatPath(EMBED_AUTH_POPUP_PATH)}?provider=${encodeURIComponent(provider)}${popupHash}`;

      const preOpenedPopup = options.popup && !options.popup.closed ? options.popup : null;

      let popup: Window | null;

      if (preOpenedPopup) {
        preOpenedPopup.location.href = popupUrl;

        popup = preOpenedPopup;
      } else {
        popup = window.open(popupUrl, buildPopupWindowName(), EMBED_AUTH_POPUP_WINDOW_FEATURES);
      }

      if (!popup) {
        window.removeEventListener('message', onMessage);

        setError('popup-blocked');
        setStatus('error');

        return;
      }

      attempt.popup = popup;
      attemptRef.current = attempt;

      setStatus('waiting');

      attempt.flowTimeout = window.setTimeout(() => {
        fail('timeout', generation);
      }, FLOW_TIMEOUT_MS);

      scheduleRedeem(attempt, REDEEM_POLL_INITIAL_DELAY_MS, (next) => void runRedeem(next));
    },
    [teardownAttempt, fail, runRedeem, scheduleRedeem, hasSession, setStatus],
  );

  const continueWithStorageAccess = useCallback(async () => {
    if (statusRef.current !== 'needs-storage-access') {
      return;
    }

    const nonce = nonceRef.current;
    const generation = generationRef.current;

    if (!nonce) {
      fail('request-failed', generation);

      return;
    }

    try {
      await document.requestStorageAccess();
    } catch {
      fail('storage-access-denied', generation);

      return;
    }

    if (generation !== generationRef.current) {
      return;
    }

    setStatus('redeeming');

    let isRedeemed = false;

    for (let i = 0; i < STORAGE_ACCESS_REDEEM_ATTEMPTS; i += 1) {
      let result: TEmbedAuthRedeemResult;

      try {
        result = await authClient.embed.redeem({ nonce });
      } catch {
        fail('request-failed', generation);

        return;
      }

      if (generation !== generationRef.current) {
        return;
      }

      if (result === 'ok') {
        isRedeemed = true;

        break;
      }

      if (result === 'failed') {
        fail('auth-failed', generation);

        return;
      }

      await sleep(STORAGE_ACCESS_REDEEM_INTERVAL_MS);

      if (generation !== generationRef.current) {
        return;
      }
    }

    if (!isRedeemed) {
      fail('cookie-blocked', generation);

      return;
    }

    const isSignedIn = await verifyCookie();

    if (generation !== generationRef.current) {
      return;
    }

    if (!isSignedIn) {
      fail('cookie-blocked', generation);

      return;
    }

    setStatus('success');
    onSuccessRef.current();
  }, [fail, verifyCookie, setStatus]);

  const reset = useCallback(() => {
    teardownAttempt();

    generationRef.current += 1;

    nonceRef.current = null;
    verifyCookieRef.current = null;
    sessionSnapshotRef.current = null;

    setError(null);
    setStatus('idle');
  }, [teardownAttempt, setStatus]);

  // After a COOP-enforcing IdP `close()` is a no-op; the user dismisses the window.
  const cancel = useCallback(() => {
    const popup = attemptRef.current?.popup ?? null;

    if (popup && !popup.closed) {
      popup.close();
    }

    reset();
  }, [reset]);

  useEffect(() => {
    return () => {
      generationRef.current += 1;

      teardownAttempt();
    };
  }, [teardownAttempt]);

  return {
    status,
    error,
    start,
    continueWithStorageAccess,
    reset,
    cancel,
  };
};

export type EmbedPopupAuth = ReturnType<typeof useEmbedPopupAuth>;
