import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { CreditCardIcon } from 'lucide-react';
import { Link } from 'react-router';

import { useSession } from '@documenso/lib/client-only/providers/session';
import { IS_BILLING_ENABLED } from '@documenso/lib/constants/app';
import { ORGANISATION_MEMBER_ROLE_MAP } from '@documenso/lib/constants/organisations-translations';
import { formatAvatarUrl } from '@documenso/lib/utils/avatars';
import { canExecuteOrganisationAction } from '@documenso/lib/utils/organisations';
import { AvatarWithText } from '@documenso/ui/primitives/avatar';
import { Button } from '@documenso/ui/primitives/button';
import { Card, CardContent } from '@documenso/ui/primitives/card';

export const AccountBillingOrganisations = () => {
  const { _ } = useLingui();
  const { user, organisations } = useSession();

  if (!IS_BILLING_ENABLED()) {
    return null;
  }

  // Filter to only organisations where user can manage billing
  const billingOrganisations = organisations.filter((org) =>
    canExecuteOrganisationAction('MANAGE_BILLING', org.currentOrganisationRole),
  );

  if (billingOrganisations.length === 0) {
    return null;
  }

  return (
    <div className="max-w-xl">
      <h3 className="text-foreground mb-2 text-lg font-semibold">
        <Trans>Billing Management</Trans>
      </h3>
      <p className="text-muted-foreground mb-4 text-sm">
        <Trans>Manage billing for organisations where you have billing permissions.</Trans>
      </p>

      <div className="space-y-3">
        {billingOrganisations.map((org) => (
          <Card key={org.id} className="overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <AvatarWithText
                    avatarSrc={formatAvatarUrl(org.avatarImageId)}
                    avatarClass="h-10 w-10"
                    avatarFallback={org.name.slice(0, 1).toUpperCase()}
                    primaryText={<span className="font-medium">{org.name}</span>}
                    secondaryText={
                      org.ownerUserId === user.id
                        ? _(msg`Owner`)
                        : _(ORGANISATION_MEMBER_ROLE_MAP[org.currentOrganisationRole])
                    }
                  />
                </div>

                <Button variant="outline" size="sm" asChild>
                  <Link to={`/o/${org.url}/settings/billing`}>
                    <CreditCardIcon className="mr-2 h-4 w-4" />
                    <Trans>Manage Billing</Trans>
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
