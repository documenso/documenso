'use client';

import { useRouter } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';
import { Trans, msg } from '@lingui/macro';
import { useLingui } from '@lingui/react';
import { format } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

import { trpc } from '@documenso/trpc/react';
import { Button } from '@documenso/ui/primitives/button';
import { Calendar } from '@documenso/ui/primitives/calendar';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@documenso/ui/primitives/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@documenso/ui/primitives/form/form';
import { Popover, PopoverContent, PopoverTrigger } from '@documenso/ui/primitives/popover';

import { cn } from '../../lib/utils';
import { useToast } from '../use-toast';
import type { TAddSignerSchema as Signer } from './add-signers.types';

const formSchema = z.object({
  expiry: z.date({
    required_error: 'Please select an expiry date.',
  }),
});

type DocumentExpiryDialogProps = {
  open: boolean;
  onOpenChange: (_open: boolean) => void;
  signer: Signer;
  documentId: number;
};

export default function DocumentExpiryDialog({
  open,
  onOpenChange,
  signer,
  documentId,
}: DocumentExpiryDialogProps) {
  const { toast } = useToast();
  const router = useRouter();

  const { _ } = useLingui();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      expiry: signer.expiry,
    },
  });

  const { mutateAsync: setSignerExpiry, isLoading } = trpc.recipient.setSignerExpiry.useMutation({
    onSuccess: () => {
      router.refresh();
      toast({
        title: _(msg`Signer Expiry Set`),
        description: _(msg`The expiry date for the signer has been set.`),
        duration: 5000,
      });
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: _(msg`Error`),
        description: error.message || _(msg`An error occurred while setting the expiry date.`),
        variant: 'destructive',
        duration: 7500,
      });
    },
  });

  const onSetExpiry = async (values: z.infer<typeof formSchema>) => {
    if (!signer.nativeId) {
      return toast({
        title: _(msg`Error`),
        description: _(msg`An error occurred while setting the expiry date.`),
        variant: 'destructive',
        duration: 7500,
      });
    }

    await setSignerExpiry({
      documentId,
      signerId: signer.nativeId,
      expiry: new Date(values.expiry),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Set Document Expiry</DialogTitle>
          <DialogDescription>
            Set the expiry date for the document signing recipient. The recipient will not be able
            to sign the document after this date.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSetExpiry)} className="space-y-8">
            <FormField
              control={form.control}
              name="expiry"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Expiry Date</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={'outline'}
                          className={cn(
                            'w-[240px] pl-3 text-left font-normal',
                            !field.value && 'text-muted-foreground',
                          )}
                        >
                          {field.value ? format(field.value, 'PPP') : <span>Pick a date</span>}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="z-[1100] w-auto p-0 " align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) => date < new Date() || date < new Date('1900-01-01')}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormDescription>
                    The document will expire at 11:59 PM on the selected date.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="secondary">
                  <Trans>Cancel</Trans>
                </Button>
              </DialogClose>
              <Button type="submit" loading={isLoading}>
                <Trans>Save Changes</Trans>
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
