'use client';

import { useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { Loader } from 'lucide-react';

import { Recipient } from '@documenso/prisma/client';
import { FieldWithSignature } from '@documenso/prisma/types/field-with-signature';
import { trpc } from '@documenso/trpc/react';
import { Button } from '@documenso/ui/primitives/button';
import { Dialog, DialogContent, DialogFooter, DialogTitle } from '@documenso/ui/primitives/dialog';
import { Input } from '@documenso/ui/primitives/input';
import { Label } from '@documenso/ui/primitives/label';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { useRequiredSigningContext } from './provider';
import { SigningFieldContainer } from './signing-field-container';

export type NameFieldProps = {
  field: FieldWithSignature;
  recipient: Recipient;
};

export const NameField = ({ field, recipient }: NameFieldProps) => {
  const router = useRouter();

  const { toast } = useToast();

  const { fullName: providedFullName, setFullName: setProvidedFullName } =
    useRequiredSigningContext();

  const [isPending, startTransition] = useTransition();

  const { mutateAsync: signFieldWithToken, isLoading: isSignFieldWithTokenLoading } =
    trpc.field.signFieldWithToken.useMutation();

  const {
    mutateAsync: removeSignedFieldWithToken,
    isLoading: isRemoveSignedFieldWithTokenLoading,
  } = trpc.field.removeSignedFieldWithToken.useMutation();

  const isLoading = isSignFieldWithTokenLoading || isRemoveSignedFieldWithTokenLoading || isPending;

  const [showFullNameModal, setShowFullNameModal] = useState(false);
  const [localFullName, setLocalFullName] = useState('');

  const onSign = async (source: 'local' | 'provider' = 'provider') => {
    try {
      if (!providedFullName && !localFullName) {
        setShowFullNameModal(true);
        return;
      }

      await signFieldWithToken({
        token: recipient.token,
        fieldId: field.id,
        value: source === 'local' && localFullName ? localFullName : providedFullName ?? '',
        isBase64: false,
      });

      if (source === 'local' && !providedFullName) {
        setProvidedFullName(localFullName);
      }

      setLocalFullName('');

      startTransition(() => router.refresh());
    } catch (err) {
      console.error(err);

      toast({
        title: 'Error',
        description: 'An error occurred while signing the document.',
        variant: 'destructive',
      });
    }
  };

  const onRemove = async () => {
    try {
      await removeSignedFieldWithToken({
        token: recipient.token,
        fieldId: field.id,
      });

      startTransition(() => router.refresh());
    } catch (err) {
      console.error(err);

      toast({
        title: 'Error',
        description: 'An error occurred while removing the signature.',
        variant: 'destructive',
      });
    }
  };

  return (
    <SigningFieldContainer field={field} onSign={onSign} onRemove={onRemove}>
      {isLoading && (
        <div className="bg-background absolute inset-0 flex items-center justify-center rounded-md">
          <Loader className="text-primary h-5 w-5 animate-spin md:h-8 md:w-8" />
        </div>
      )}

      {!field.inserted && (
        <p className="group-hover:text-primary text-muted-foreground text-lg duration-200">Name</p>
      )}

      {field.inserted && <p className="text-muted-foreground duration-200">{field.customText}</p>}

      <Dialog open={showFullNameModal} onOpenChange={setShowFullNameModal}>
        <DialogContent>
          <DialogTitle>
            Sign as {recipient.name}{' '}
            <span className="text-muted-foreground">({recipient.email})</span>
          </DialogTitle>

          <div className="py-4">
            <Label htmlFor="signature">Full Name</Label>

            <Input
              type="text"
              className="mt-2"
              value={localFullName}
              onChange={(e) => setLocalFullName(e.target.value.trimStart())}
            />
          </div>

          <DialogFooter>
            <div className="flex w-full flex-1 flex-nowrap gap-4">
              <Button
                type="button"
                className="dark:bg-muted dark:hover:bg-muted/80 flex-1  bg-black/5 hover:bg-black/10"
                variant="secondary"
                onClick={() => {
                  setShowFullNameModal(false);
                  setLocalFullName('');
                }}
              >
                Cancel
              </Button>

              <Button
                type="button"
                className="flex-1"
                disabled={!localFullName}
                onClick={() => {
                  setShowFullNameModal(false);
                  void onSign('local');
                }}
              >
                Sign
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SigningFieldContainer>
  );
};
