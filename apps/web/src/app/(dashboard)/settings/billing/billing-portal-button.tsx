'use client';

import { useState } from 'react';

import { Button } from '@documenso/ui/primitives/button';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { createBillingPortal } from './create-billing-portal.action';

export type BillingPortalButtonProps = {
  buttonProps?: React.ComponentProps<typeof Button>;
};

export const BillingPortalButton = ({ buttonProps }: BillingPortalButtonProps) => {
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
      let description =
        'ამჯერად გადახდის პორტალზე გადასვლა ვერ მოხერხდა. გთხოვთ სცადოთ ხელახლა ან დაგვიკავშირდეთ.';

      if (e.message === 'CUSTOMER_NOT_FOUND') {
        description = 'ამჟამად არ გაქვთ მომხმარებლის ჩანაწერი. გთხოვთ დაგვიკავშირდეთ.';
      }

      toast({
        title: 'დაფიქსირდა ხარვეზი',
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
      Manage Subscription
    </Button>
  );
};
