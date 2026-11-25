import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { usePersistEmbedSignature } from './use-persist-embed-signature';

const mockMutateAsync = vi.fn().mockResolvedValue({ success: true });

vi.mock('@documenso/trpc/react', () => ({
  trpc: {
    embeddingPresign: {
      persistEmbedSignature: {
        useMutation: () => ({
          mutateAsync: mockMutateAsync,
        }),
      },
    },
  },
}));

function renderHook<T>(hook: () => T) {
  let result!: T;
  const effects: Array<() => (() => void) | undefined> = [];
  const cleanups: Array<() => void> = [];

  const dispatcher = {
    useRef: <V>(initial: V) => ({ current: initial }),
    useCallback: <F extends (...args: unknown[]) => unknown>(fn: F) => fn,
    useMemo: <V>(fn: () => V) => fn(),
    useState: <V>(initial: V) => [initial, () => null],
    useEffect: (fn: () => (() => void) | undefined) => {
      effects.push(fn);
    },
  };

  const clientInternals = (
    React as unknown as {
      __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE?: { H: unknown };
    }
  ).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;

  const prev = clientInternals?.H;
  if (clientInternals) {
    clientInternals.H = dispatcher;
  }

  try {
    result = hook();
  } finally {
    if (clientInternals) {
      clientInternals.H = prev;
    }
  }

  for (const effect of effects) {
    const cleanup = effect();
    if (typeof cleanup === 'function') {
      cleanups.push(cleanup);
    }
  }

  return {
    get current() {
      return result;
    },
    unmount() {
      for (const cleanup of cleanups) {
        cleanup();
      }
    },
  };
}

describe('usePersistEmbedSignature', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockMutateAsync.mockClear();
    mockMutateAsync.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('debounces rapid keystrokes to a single mutation call with the final signature', () => {
    const { current } = renderHook(() =>
      usePersistEmbedSignature({
        token: 'tok_123',
        clientUserId: 'usr_456',
        initialSignature: null,
        debounceMs: 500,
      }),
    );

    // Simulate typing 13 characters rapidly (one keystroke every 40ms)
    const typedName = 'Johnathan Doe';
    for (let i = 1; i <= typedName.length; i++) {
      current.persistSignature(typedName.slice(0, i));
      vi.advanceTimersByTime(40);
    }

    // During active typing, no mutation should have fired yet
    expect(mockMutateAsync).not.toHaveBeenCalled();

    // Advance time past the 500ms debounce threshold
    vi.advanceTimersByTime(500);

    // Exactly one mutation call should be dispatched with the complete signature
    expect(mockMutateAsync).toHaveBeenCalledTimes(1);
    expect(mockMutateAsync).toHaveBeenCalledWith({
      token: 'tok_123',
      clientUserId: 'usr_456',
      signature: 'Johnathan Doe',
    });
  });

  it('does not trigger mutation when clientUserId is null or undefined', () => {
    const { current } = renderHook(() =>
      usePersistEmbedSignature({
        token: 'tok_123',
        clientUserId: null,
        initialSignature: null,
      }),
    );

    current.persistSignature('Johnathan Doe');
    vi.advanceTimersByTime(1000);

    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it('does not trigger mutation when signature is empty or null', () => {
    const { current } = renderHook(() =>
      usePersistEmbedSignature({
        token: 'tok_123',
        clientUserId: 'usr_456',
        initialSignature: null,
      }),
    );

    current.persistSignature('');
    current.persistSignature(null);
    vi.advanceTimersByTime(1000);

    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it('does not trigger mutation when signature equals initial signature', () => {
    const { current } = renderHook(() =>
      usePersistEmbedSignature({
        token: 'tok_123',
        clientUserId: 'usr_456',
        initialSignature: 'Existing Signature',
      }),
    );

    current.persistSignature('Existing Signature');
    vi.advanceTimersByTime(1000);

    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it('flushes pending signature during unmount cleanup', () => {
    const { current, unmount } = renderHook(() =>
      usePersistEmbedSignature({
        token: 'tok_123',
        clientUserId: 'usr_456',
        initialSignature: null,
        debounceMs: 500,
      }),
    );

    current.persistSignature('Last Drawn Stroke');
    vi.advanceTimersByTime(100);
    expect(mockMutateAsync).not.toHaveBeenCalled();

    // Unmount cleanup dispatches the pending signature mutation immediately
    unmount();

    expect(mockMutateAsync).toHaveBeenCalledTimes(1);
    expect(mockMutateAsync).toHaveBeenCalledWith({
      token: 'tok_123',
      clientUserId: 'usr_456',
      signature: 'Last Drawn Stroke',
    });
  });

  it('dispatches a keepalive fetch on pagehide and visibilitychange without double-sending', () => {
    const listeners = new Map<string, Set<EventListener>>();
    const originalWindow = globalThis.window;
    const originalDocument = globalThis.document;
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true });

    vi.stubGlobal('fetch', fetchSpy);
    vi.stubGlobal('window', {
      addEventListener: (type: string, listener: EventListener) => {
        if (!listeners.has(type)) {
          listeners.set(type, new Set());
        }
        listeners.get(type)?.add(listener);
      },
      removeEventListener: (type: string, listener: EventListener) => {
        listeners.get(type)?.delete(listener);
      },
    });

    const visibilityStateRef = { value: 'visible' as DocumentVisibilityState };
    vi.stubGlobal('document', {
      get visibilityState() {
        return visibilityStateRef.value;
      },
    });

    try {
      const { current } = renderHook(() =>
        usePersistEmbedSignature({
          token: 'tok_123',
          clientUserId: 'usr_456',
          initialSignature: null,
          debounceMs: 500,
        }),
      );

      current.persistSignature('Hidden Tab Stroke');
      visibilityStateRef.value = 'hidden';
      for (const listener of listeners.get('visibilitychange') ?? []) {
        listener(new Event('visibilitychange'));
      }

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/trpc/embeddingPresign.persistEmbedSignature',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
          keepalive: true,
          body: JSON.stringify({
            json: {
              token: 'tok_123',
              clientUserId: 'usr_456',
              signature: 'Hidden Tab Stroke',
            },
          }),
        }),
      );

      // Firing pagehide immediately afterwards should not duplicate the request.
      for (const listener of listeners.get('pagehide') ?? []) {
        listener(new Event('pagehide'));
      }
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      // A direct pagehide without prior visibilitychange also sends keepalive.
      current.persistSignature('Page Hide Stroke');
      for (const listener of listeners.get('pagehide') ?? []) {
        listener(new Event('pagehide'));
      }
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    } finally {
      vi.stubGlobal('window', originalWindow);
      vi.stubGlobal('document', originalDocument);
      vi.unstubAllGlobals();
    }
  });

  it('awaits in-flight and debounced mutations when flush() is called', async () => {
    let resolveMutation!: (value: { success: boolean }) => void;
    mockMutateAsync.mockImplementationOnce(
      () =>
        new Promise<{ success: boolean }>((resolve) => {
          resolveMutation = resolve;
        }),
    );

    const { current } = renderHook(() =>
      usePersistEmbedSignature({
        token: 'tok_123',
        clientUserId: 'usr_456',
        initialSignature: null,
        debounceMs: 500,
      }),
    );

    current.persistSignature('Instant Signature');
    expect(mockMutateAsync).not.toHaveBeenCalled();

    let flushed = false;
    const flushPromise = current.flush().then(() => {
      flushed = true;
    });

    expect(mockMutateAsync).toHaveBeenCalledTimes(1);
    expect(mockMutateAsync).toHaveBeenCalledWith({
      token: 'tok_123',
      clientUserId: 'usr_456',
      signature: 'Instant Signature',
    });

    // Promise should stay pending until the mutation resolves
    await Promise.resolve();
    expect(flushed).toBe(false);

    resolveMutation({ success: true });
    await flushPromise;
    expect(flushed).toBe(true);

    // Advancing timers should not cause duplicate submission
    vi.advanceTimersByTime(1000);
    expect(mockMutateAsync).toHaveBeenCalledTimes(1);
  });

  it('cancels pending timer if signature is restored to already persisted signature', () => {
    const { current } = renderHook(() =>
      usePersistEmbedSignature({
        token: 'tok_123',
        clientUserId: 'usr_456',
        initialSignature: 'Existing',
        debounceMs: 500,
      }),
    );

    current.persistSignature('Existing New');
    vi.advanceTimersByTime(100);

    // Revert back before timer fires
    current.persistSignature('Existing');
    vi.advanceTimersByTime(1000);

    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it('updates lastPersistedSignature on success preventing duplicate mutations', async () => {
    const { current } = renderHook(() =>
      usePersistEmbedSignature({
        token: 'tok_123',
        clientUserId: 'usr_456',
        initialSignature: null,
        debounceMs: 500,
      }),
    );

    current.persistSignature('Jane Doe');
    await vi.advanceTimersByTimeAsync(500);

    expect(mockMutateAsync).toHaveBeenCalledTimes(1);

    // Call again with the same signature
    current.persistSignature('Jane Doe');
    await vi.advanceTimersByTimeAsync(1000);

    // Should not fire again
    expect(mockMutateAsync).toHaveBeenCalledTimes(1);
  });
});
