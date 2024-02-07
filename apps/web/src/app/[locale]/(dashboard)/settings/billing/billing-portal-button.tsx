'use client';

import { useState } from 'react';

import { useTranslation } from 'react-i18next';

import { Button } from '@documenso/ui/primitives/button';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { createBillingPortal } from './create-billing-portal.action';

export const BillingPortalButton = () => {
  const { toast } = useToast();

  const [isFetchingPortalUrl, setIsFetchingPortalUrl] = useState(false);
  const { t } = useTranslation();

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
      let description = t('unable_to_proceed_to_billing_portal');

      if (e.message === 'CUSTOMER_NOT_FOUND') {
        description = t('dont_currently_have_customer_record');
      }

      toast({
        title: t('something_went_wrong'),
        description,
        variant: 'destructive',
        duration: 10000,
      });
    }

    setIsFetchingPortalUrl(false);
  };

  return (
    <Button onClick={async () => handleFetchPortalUrl()} loading={isFetchingPortalUrl}>
      {t('manage_subscriptions')}
    </Button>
  );
};
