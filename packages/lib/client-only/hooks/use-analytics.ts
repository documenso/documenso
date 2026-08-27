import { extractPostHogConfig } from '@documenso/lib/constants/feature-flags';

let posthogPromise: Promise<typeof import('posthog-js')> | null = null;

const getPosthog = async () => {
  if (!posthogPromise) {
    posthogPromise = import('posthog-js');
  }

  return posthogPromise;
};

export function useAnalytics() {
  // const featureFlags = useFeatureFlags();
  const isPostHogEnabled = extractPostHogConfig();

  /**
   * Capture an analytic event.
   *
   * @param event The event name.
   * @param properties Properties to attach to the event.
   */
  const capture = (event: string, properties?: Record<string, unknown>) => {
    if (!isPostHogEnabled) {
      return;
    }

    void getPosthog().then(({ default: posthog }) => {
      posthog.capture(event, properties);
    });
  };

  /**
   * Capture an exception event.
   *
   * @param error The error to capture.
   * @param properties Properties to attach to the event, such as `source`, `location`,
   * `recipientId` or `envelopeId`. Never attach recipient tokens.
   */
  const captureException = (error: unknown, properties?: Record<string, unknown>) => {
    if (!isPostHogEnabled) {
      return;
    }

    const errorToCapture = error instanceof Error ? error : new Error(String(error));

    void getPosthog().then(({ default: posthog }) => {
      posthog.captureException(errorToCapture, properties);
    });
  };

  /**
   * Start the session recording.
   *
   * @param eventFlag The event to check against feature flags to determine whether tracking is enabled.
   */
  const startSessionRecording = (eventFlag?: string) => {
    return;
    // const isSessionRecordingEnabled = featureFlags.getFlag(FEATURE_FLAG_GLOBAL_SESSION_RECORDING);
    // const isSessionRecordingEnabledForEvent = Boolean(eventFlag && featureFlags.getFlag(eventFlag));

    // if (!isPostHogEnabled || !isSessionRecordingEnabled || !isSessionRecordingEnabledForEvent) {
    //   return;
    // }

    // posthog.startSessionRecording();
  };

  /**
   * Stop the current session recording.
   */
  const stopSessionRecording = () => {
    return;
    // const isSessionRecordingEnabled = featureFlags.getFlag(FEATURE_FLAG_GLOBAL_SESSION_RECORDING);

    // if (!isPostHogEnabled || !isSessionRecordingEnabled) {
    //   return;
    // }

    // posthog.stopSessionRecording();
  };

  return {
    capture,
    captureException,
    startSessionRecording,
    stopSessionRecording,
  };
}
