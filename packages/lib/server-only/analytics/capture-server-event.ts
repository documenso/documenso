import crypto from 'node:crypto';
import { PostHog } from 'posthog-node';

import { env } from '../../utils/env';

/**
 * Server-side product analytics client.
 *
 * Uses the same PostHog project as the client-side integration
 * (NEXT_PUBLIC_POSTHOG_KEY). Not to be confused with the self-hoster
 * telemetry client which reports to a separate project.
 *
 * Events are sent directly to PostHog rather than through the `/ingest`
 * reverse proxy used by the browser.
 */
const POSTHOG_HOST = 'https://eu.i.posthog.com';

let client: PostHog | null | undefined;

const getAnalyticsClient = () => {
  if (client !== undefined) {
    return client;
  }

  const apiKey = env('NEXT_PUBLIC_POSTHOG_KEY');

  // Low volume events, flush immediately so nothing is lost on shutdown.
  client = apiKey ? new PostHog(apiKey, { host: POSTHOG_HOST, flushAt: 1 }) : null;

  return client;
};

type CaptureServerEventOptions = {
  event: string;

  /**
   * The authenticated user this event belongs to, if any.
   *
   * Used as the distinct ID so server events line up with client-side
   * identified users. Anonymous events (e.g. embed signer sessions) get a
   * random distinct ID instead.
   */
  userId?: number;
  organisationId?: string;
  teamId?: number;
  properties?: Record<string, unknown>;
};

/**
 * Capture a product analytics event from the server.
 *
 * No-ops when NEXT_PUBLIC_POSTHOG_KEY is not configured. Events are captured
 * as anonymous events (no person profile processing) to keep usage costs low,
 * cross-referencing is done via the `userId`, `organisationId` and `teamId`
 * event properties.
 *
 * Never pass recipient tokens or document contents as properties.
 */
export const captureServerEvent = ({
  event,
  userId,
  organisationId,
  teamId,
  properties = {},
}: CaptureServerEventOptions) => {
  const posthog = getAnalyticsClient();

  if (!posthog) {
    return;
  }

  posthog.capture({
    distinctId: userId ? String(userId) : `anon_${crypto.randomUUID()}`,
    event,
    properties: {
      ...properties,
      userId,
      organisationId,
      teamId,
      $process_person_profile: false,
    },
  });
};
