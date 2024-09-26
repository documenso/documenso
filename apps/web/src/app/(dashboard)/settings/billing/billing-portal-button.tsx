'use client';

import { useState } from 'react';

import { Trans, msg } from '@lingui/macro';
import { useLingui } from '@lingui/react';

import { Button } from '@documenso/ui/primitives/button';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { createBillingPortal } from './create-billing-portal.action';

export type BillingPortalButtonProps = {
  buttonProps?: React.ComponentProps<typeof Button>;
};

export const BillingPortalButton = ({ buttonProps }: BillingPortalButtonProps) => {
  const { _ } = useLingui();
  const { toast } = useToast();

  const [isFetchingPortalUrl, setIsFetchingPortalUrl] = useState(false);

  const handleFetchPortalUrl = async () => {
    if (isFetchingPortalUrl) {
      return;
    }

    setIsFetchingPortalUrl(true);

    try {
      const sessionUrl = await createBillingPortal();

      if (!sessionUrl) {
        throw new Error('NO_SESSION');
      }

      window.open(sessionUrl, '_blank');
    } catch (e) {
      let description = _(
        msg`We are unable to proceed to the billing portal at this time. Please try again, or contact support.`,
      );

      if (e.message === 'CUSTOMER_NOT_FOUND') {
        description = _(
          msg`You do not currently have a customer record, this should not happen. Please contact support for assistance.`,
        );
      }

      toast({
        title: _(msg`Something went wrong`),
        description,
        variant: 'destructive',
        duration: 10000,
      });
    }

    setIsFetchingPortalUrl(false);
  };

  return (
    <Button
      {...buttonProps}
      onClick={async () => handleFetchPortalUrl()}
      loading={isFetchingPortalUrl}
    >
      <Trans>Manage Subscription</Trans>
    </Button>
  );
};
