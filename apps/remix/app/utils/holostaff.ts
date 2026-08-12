import type { BowtieStage } from '@holostaff/sdk';

import { env } from '@documenso/lib/utils/env';

/**
 * Holostaff: an optional in-product success manager for document senders.
 *
 * Off by default. Nothing loads and nothing is contacted unless both
 * NEXT_PUBLIC_HOLOSTAFF_TENANT_ID and NEXT_PUBLIC_HOLOSTAFF_SOURCE_ID are
 * set (runtime public env, so self-hosters can enable it on the prebuilt
 * image without a rebuild). The SDK sits behind a dynamic import, so with
 * the ids empty no visitor ever downloads its code.
 *
 * Called from the authenticated layout only, so it can never run on the
 * public recipient pages (/sign/:token, /d/:token), embeds, or the auth
 * pages. Recipients are your users' users; they stay out of scope.
 *
 * Docs: https://docs.holostaff.ai
 */

// Journey stages, by the route the user is on. First match wins. The
// copilot uses this to know whether someone is working their documents,
// setting up their team, or looking at plans; everything else (stall
// detection, what to say, whether to say anything at all) comes from the
// journey map, not from this file.
const STAGE_ROUTES: [RegExp, BowtieStage][] = [
  [/^\/(o|t)\/[^/]+\/settings\/(billing|members|groups|teams)/, 'expansion'],
  [/^\/settings\/(billing|organisations)/, 'expansion'],
  [/./, 'adoption'],
];

export const isHolostaffEnabled = (): boolean =>
  Boolean(
    env('NEXT_PUBLIC_HOLOSTAFF_TENANT_ID') && env('NEXT_PUBLIC_HOLOSTAFF_SOURCE_ID'),
  );

let sdk: Promise<typeof import('@holostaff/sdk')> | null = null;
let currentStage: BowtieStage | null = null;

export const holostaffMarkPath = (pathname: string): void => {
  if (!isHolostaffEnabled()) {
    return;
  }

  sdk =
    sdk ??
    import('@holostaff/sdk').then((mod) => {
      mod.holostaff.init({
        tenantId: env('NEXT_PUBLIC_HOLOSTAFF_TENANT_ID') ?? '',
        sourceId: env('NEXT_PUBLIC_HOLOSTAFF_SOURCE_ID') ?? '',
        // A sender's screen can show recipient names and emails, so mask
        // the content of every input in the session capture, not just
        // PII field types.
        observe: { maskAllInputs: true },
      });

      return mod;
    });

  const stage = STAGE_ROUTES.find(([pattern]) => pattern.test(pathname))?.[1];

  sdk
    .then(({ holostaff }) => {
      if (stage && stage !== currentStage) {
        currentStage = stage;
        holostaff.markStageEntry(stage);
      }
    })
    .catch((error) => {
      console.warn('Holostaff did not load:', error);
    });
};
