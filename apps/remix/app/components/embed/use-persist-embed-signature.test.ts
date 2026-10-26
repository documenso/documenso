import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { usePersistEmbedSignature } from './use-persist-embed-signature';

const mockMutate = vi.fn();

vi.mock('@documenso/trpc/react', () => ({
  trpc: {
    embeddingPresign: {
      persistEmbedSignature: {
        useMutation: () => ({
          mutate: mockMutate,
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
    mockMutate.mockClear();
  });

  afterEach(() => {
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
    expect(mockMutate).not.toHaveBeenCalled();

    // Advance time past the 500ms debounce threshold
    vi.advanceTimersByTime(500);

    // Exactly one mutation call should be dispatched with the complete signature
    expect(mockMutate).toHaveBeenCalledTimes(1);
    expect(mockMutate).toHaveBeenCalledWith(
      {
        token: 'tok_123',
        clientUserId: 'usr_456',
        signature: 'Johnathan Doe',
      },
      expect.any(Object),
    );
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

    expect(mockMutate).not.toHaveBeenCalled();
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

    expect(mockMutate).not.toHaveBeenCalled();
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

    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('cancels pending debounce timer on unmount', () => {
    const { current, unmount } = renderHook(() =>
      usePersistEmbedSignature({
        token: 'tok_123',
        clientUserId: 'usr_456',
        initialSignature: null,
        debounceMs: 500,
      }),
    );

    current.persistSignature('Partial Signature');
    unmount();

    vi.advanceTimersByTime(1000);
    expect(mockMutate).not.toHaveBeenCalled();
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

    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('updates lastPersistedSignature on success preventing duplicate mutations', () => {
    const { current } = renderHook(() =>
      usePersistEmbedSignature({
        token: 'tok_123',
        clientUserId: 'usr_456',
        initialSignature: null,
        debounceMs: 500,
      }),
    );

    current.persistSignature('Jane Doe');
    vi.advanceTimersByTime(500);

    expect(mockMutate).toHaveBeenCalledTimes(1);

    // Trigger success callback
    const options = mockMutate.mock.calls[0][1];
    options.onSuccess();

    // Call again with the same signature
    current.persistSignature('Jane Doe');
    vi.advanceTimersByTime(1000);

    // Should not fire again
    expect(mockMutate).toHaveBeenCalledTimes(1);
  });
});
