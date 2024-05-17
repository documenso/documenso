'use client';

import { useState } from 'react';

import { DateTime } from 'luxon';
import { signOut } from 'next-auth/react';

import { trpc } from '@documenso/trpc/react';
import { Button } from '@documenso/ui/primitives/button';
import { useToast } from '@documenso/ui/primitives/use-toast';

export type SigningAuthPageViewProps = {
  email: string;
};

export const SigningAuthPageView = ({ email }: SigningAuthPageViewProps) => {
  const { toast } = useToast();

  const [isSigningOut, setIsSigningOut] = useState(false);

  const { mutateAsync: encryptSecondaryData } = trpc.crypto.encryptSecondaryData.useMutation();

  const handleChangeAccount = async (email: string) => {
    try {
      setIsSigningOut(true);

      const encryptedEmail = await encryptSecondaryData({
        data: email,
        expiresAt: DateTime.now().plus({ days: 1 }).toMillis(),
      });

      await signOut({
        callbackUrl: `/signin?email=${encodeURIComponent(encryptedEmail)}`,
      });
    } catch {
      toast({
        title: 'დაფიქსირდა ხარვეზი',
        description: 'ანგარიშიდან გამოსვლა ამჯერად ვერ მოხერხდა. გთხოვთ თავიდან სცადეთ.',
        duration: 10000,
        variant: 'destructive',
      });
    }

    setIsSigningOut(false);
  };

  return (
    <div className="mx-auto flex h-[70vh] w-full max-w-md flex-col items-center justify-center">
      <div>
        <h1 className="text-3xl font-semibold">საჭიროა ავთენტიფიკაცია</h1>

        <p className="text-muted-foreground mt-2 text-sm">
          ამ გვერდის სანახავად ავტორიზირებული უნდა იყოთ როგორც: <strong>{email}</strong>
        </p>

        <Button
          className="mt-4 w-full"
          type="submit"
          onClick={async () => handleChangeAccount(email)}
          loading={isSigningOut}
        >
          ავტორიზაცია
        </Button>
      </div>
    </div>
  );
};
