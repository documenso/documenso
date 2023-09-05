'use client';

import { useState } from 'react';

import { useRouter } from 'next/navigation';

import { Loader } from 'lucide-react';
import { useForm } from 'react-hook-form';

import { completeDocumentWithToken } from '@documenso/lib/server-only/document/complete-document-with-token';
import { Document, Field, Recipient } from '@documenso/prisma/client';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import { Card, CardContent } from '@documenso/ui/primitives/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTrigger,
} from '@documenso/ui/primitives/dialog';
import { Input } from '@documenso/ui/primitives/input';
import { Label } from '@documenso/ui/primitives/label';
import { SignaturePad } from '@documenso/ui/primitives/signature-pad';

import { useRequiredSigningContext } from './provider';

export type SigningFormProps = {
  document: Document;
  recipient: Recipient;
  fields: Field[];
};

export const SigningForm = ({ document, recipient, fields }: SigningFormProps) => {
  const router = useRouter();

  const { fullName, signature, setFullName, setSignature } = useRequiredSigningContext();

  const [showConfirmSignatureDialog, setShowConfirmSignatureDialog] = useState(false);

  const {
    handleSubmit,
    formState: { isSubmitting },
  } = useForm();

  const isComplete = fields.every((f) => f.inserted);

  const onFormSubmit = () => {
    if (!isComplete) {
      return;
    }
  };

  return (
    <form
      className={cn(
        'dark:bg-background border-border bg-widget sticky top-20 flex h-full max-h-[80rem] flex-col rounded-xl border px-4 py-6',
      )}
      onSubmit={handleSubmit(onFormSubmit)}
    >
      <div className={cn('-mx-2 flex flex-1 flex-col overflow-hidden px-2')}>
        <div className={cn('flex flex-1 flex-col')}>
          <h3 className="text-foreground text-2xl font-semibold">Sign Document</h3>

          <p className="text-muted-foreground mt-2 text-sm">
            Please review the document before signing.
          </p>

          <hr className="border-border mb-8 mt-4" />

          <div className="-mx-2 flex flex-1 flex-col gap-4 overflow-y-auto px-2">
            <div className="flex flex-1 flex-col gap-y-4">
              <div>
                <Label htmlFor="full-name">Full Name</Label>

                <Input
                  type="text"
                  id="full-name"
                  className="bg-background mt-2"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="Signature">Signature</Label>

                <Card className="mt-2" gradient degrees={-120}>
                  <CardContent className="p-0">
                    <SignaturePad
                      className="h-44 w-full"
                      defaultValue={signature ?? undefined}
                      onChange={(value) => {
                        setSignature(value);
                      }}
                    />
                  </CardContent>
                </Card>
              </div>
            </div>

            <div className="flex flex-col gap-4 md:flex-row">
              <Button
                type="button"
                className="dark:bg-muted dark:hover:bg-muted/80 w-full  bg-black/5 hover:bg-black/10"
                variant="secondary"
                size="lg"
              >
                Cancel
              </Button>

              <Dialog
                open={showConfirmSignatureDialog}
                onOpenChange={setShowConfirmSignatureDialog}
              >
                <DialogTrigger asChild>
                  <Button
                    className="w-full"
                    type="button"
                    size="lg"
                    disabled={!isComplete || isSubmitting}
                  >
                    {isSubmitting && <Loader className="mr-2 h-5 w-5 animate-spin" />}
                    Complete
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <div className="text-center">
                    <div className="text-xl font-semibold text-neutral-800">Sign Document</div>
                    <div className="text-muted-foreground mx-auto w-4/5 py-2 text-center">
                      You are about to finish signing "{document.title}". Are you sure?
                    </div>
                  </div>

                  <DialogFooter>
                    <div className="flex w-full flex-1 flex-nowrap gap-4">
                      <Button
                        type="button"
                        className="dark:bg-muted dark:hover:bg-muted/80 flex-1  bg-black/5 hover:bg-black/10"
                        variant="secondary"
                        onClick={() => {
                          setShowConfirmSignatureDialog(false);
                        }}
                      >
                        Cancel
                      </Button>

                      <Button
                        type="button"
                        className="flex-1"
                        disabled={!isComplete || isSubmitting}
                        onClick={async () => {
                          await completeDocumentWithToken({
                            token: recipient.token,
                            documentId: document.id,
                          });

                          router.push(`/sign/${recipient.token}/complete`);
                        }}
                      >
                        {isSubmitting && <Loader className="mr-2 h-5 w-5 animate-spin" />}
                        Sign
                      </Button>
                    </div>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
};
