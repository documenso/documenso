import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { canExecuteOrganisationAction } from '@documenso/lib/utils/organisations';
import { Badge } from '@documenso/ui/primitives/badge';
import { Button } from '@documenso/ui/primitives/button';
import { Trans } from '@lingui/react/macro';
import { ArrowRightIcon, CheckIcon, LockIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

export type SettingsUpsellCardProps = {
  planLabel: ReactNode;
  title: ReactNode;
  description: ReactNode;
  features: ReactNode[];
  preview: ReactNode;

  /**
   * CTA label. Defaults to "Upgrade Plan".
   */
  ctaLabel?: ReactNode;

  /**
   * CTA destination. Defaults to the organisation billing settings page.
   */
  ctaTo?: string;

  /**
   * Render the CTA as an external link (new tab) instead of an internal route.
   */
  ctaExternal?: boolean;
};

/**
 * Shared split-card layout for claim-gated settings upsells on Documenso
 * Cloud. The left pane pitches the feature (plan badge, title, description,
 * feature list, upgrade CTA); the right pane renders a decorative scenario
 * preview supplied by the caller.
 *
 * Callers decide *when* to render this (cloud + missing claim flag).
 */
export const SettingsUpsellCard = ({
  planLabel,
  title,
  description,
  features,
  preview,
  ctaLabel,
  ctaTo,
  ctaExternal = false,
}: SettingsUpsellCardProps) => {
  const organisation = useCurrentOrganisation();

  const canManageBilling = canExecuteOrganisationAction('MANAGE_BILLING', organisation.currentOrganisationRole);

  const ctaHref = ctaTo ?? `/o/${organisation.url}/settings/billing`;

  const ctaContent = (
    <>
      {ctaLabel ?? <Trans>Upgrade Plan</Trans>}
      <ArrowRightIcon className="ml-2 h-4 w-4" />
    </>
  );

  return (
    <div className="mt-8 overflow-hidden rounded-xl border-2 ring-4 ring-muted/70 md:grid md:grid-cols-[1.08fr_0.92fr] xl:-mx-8">
      {/*
       * `min-w-0` on both grid items: `fr` tracks have an `auto` content
       * minimum, so long preview content (e.g. a wide mono domain line) would
       * otherwise widen the right track beyond its 0.92fr share — and
       * re-balance the whole grid on every preview cycle (layout shift).
       */}
      <div className="flex min-w-0 flex-col items-start p-6 md:p-8">
        <Badge size="small">
          <LockIcon className="mr-1 h-3 w-3" />
          <span className="uppercase">{planLabel}</span>
        </Badge>

        <h3 className="mt-4 font-semibold text-xl">{title}</h3>

        <p className="mt-2 max-w-[40ch] text-muted-foreground text-sm">{description}</p>

        <ul className="mt-6 space-y-3">
          {features.map((feature, index) => (
            <li key={index} className="flex items-start gap-2.5 text-sm">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-documenso-200">
                <CheckIcon className="h-3 w-3 text-documenso-800" strokeWidth={2.5} />
              </span>
              {feature}
            </li>
          ))}
        </ul>

        {canManageBilling ? (
          <Button className="mt-8" asChild>
            {ctaExternal ? (
              <a href={ctaHref} target="_blank" rel="noreferrer">
                {ctaContent}
              </a>
            ) : (
              <Link to={ctaHref}>{ctaContent}</Link>
            )}
          </Button>
        ) : (
          <p className="mt-8 text-muted-foreground text-xs">
            <Trans>Contact your organisation owner to upgrade plans.</Trans>
          </p>
        )}
      </div>

      <div
        aria-hidden="true"
        className="flex min-w-0 flex-col justify-center gap-3 border-t bg-muted p-6 md:border-t-0 md:border-l md:p-8"
      >
        {preview}
      </div>
    </div>
  );
};
