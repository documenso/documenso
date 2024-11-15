'use client';

import { useEffect, useState } from 'react';

import { useRouter, useSearchParams } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';
import { Trans, msg } from '@lingui/macro';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import type { Document } from '@documenso/prisma/client';
import { trpc } from '@documenso/trpc/react';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@documenso/ui/primitives/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@documenso/ui/primitives/form/form';
import { Textarea } from '@documenso/ui/primitives/textarea';
import { useToast } from '@documenso/ui/primitives/use-toast';

const ZRejectDocumentFormSchema = z.object({
  reason: z
    .string()
    .min(5, msg`Please provide a reason`)
    .max(500, msg`Reason must be less than 500 characters`),
});

type TRejectDocumentFormSchema = z.infer<typeof ZRejectDocumentFormSchema>;

export interface RejectDocumentDialogProps {
  document: Pick<Document, 'id'>;
  token: string;
}

export function RejectDocumentDialog({ document, token }: RejectDocumentDialogProps) {
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [isOpen, setIsOpen] = useState(false);

  const { mutateAsync: rejectDocumentWithToken } =
    trpc.recipient.rejectDocumentWithToken.useMutation();

  const form = useForm<TRejectDocumentFormSchema>({
    resolver: zodResolver(ZRejectDocumentFormSchema),
    defaultValues: {
      reason: '',
    },
  });

  const onRejectDocument = async ({ reason }: TRejectDocumentFormSchema) => {
    try {
      // TODO: Add trpc mutation here
      await rejectDocumentWithToken({
        documentId: document.id,
        token,
        reason,
      });

      toast({
        title: 'Document rejected',
        description: 'The document has been successfully rejected.',
        duration: 5000,
      });

      setIsOpen(false);

      router.push(`/sign/${token}/rejected`);
    } catch (err) {
      toast({
        title: 'Error',
        description: 'An error occurred while rejecting the document. Please try again.',
        variant: 'destructive',
        duration: 5000,
      });
    }
  };

  useEffect(() => {
    if (searchParams?.get('reject') === 'true') {
      setIsOpen(true);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) {
      form.reset();
    }
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Trans>Reject Document</Trans>
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <Trans>Reject Document</Trans>
          </DialogTitle>

          <DialogDescription>
            <Trans>
              Are you sure you want to reject this document? This action cannot be undone.
            </Trans>
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onRejectDocument)} className="space-y-4">
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Textarea
                      {...field}
                      rows={4}
                      placeholder="Please provide a reason for rejecting this document"
                      disabled={form.formState.isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsOpen(false)}
                disabled={form.formState.isSubmitting}
              >
                <Trans>Cancel</Trans>
              </Button>

              <Button
                type="submit"
                variant="destructive"
                loading={form.formState.isSubmitting}
                disabled={!form.formState.isValid}
              >
                <Trans>Reject Document</Trans>
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
