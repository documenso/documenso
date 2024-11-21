'use client';

import { useState } from 'react';

import { useRouter } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';
import { Trans, msg } from '@lingui/macro';
import { useLingui } from '@lingui/react';
import { addDays, addMonths, addWeeks, format } from 'date-fns';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@documenso/ui/primitives/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@documenso/ui/primitives/tabs';

import { calculatePeriod } from '../../lib/calculate-period';
import { cn } from '../../lib/utils';
import { useToast } from '../use-toast';
import type { TAddSignerSchema as Signer } from './add-signers.types';

const dateFormSchema = z.object({
  expiry: z.date({
    required_error: 'Please select an expiry date.',
  }),
});

const periodFormSchema = z.object({
  amount: z.number().min(1, 'Please enter a number greater than 0.'),
  unit: z.enum(['days', 'weeks', 'months']),
});

type DocumentExpiryDialogProps = {
  open: boolean;
  onOpenChange: (_open: boolean) => void;
  signer: Signer;
  documentId: number;
};

export function DocumentExpiryDialog({
  open,
  onOpenChange,
  signer,
  documentId,
}: DocumentExpiryDialogProps) {
  const { _ } = useLingui();
  const router = useRouter();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'date' | 'period'>('date');

  const dateForm = useForm<z.infer<typeof dateFormSchema>>({
    resolver: zodResolver(dateFormSchema),
    defaultValues: {
      expiry: signer.expiry,
    },
  });

  const periodForm = useForm<z.infer<typeof periodFormSchema>>({
    resolver: zodResolver(periodFormSchema),
    defaultValues: signer.expiry
      ? calculatePeriod(signer.expiry)
      : {
          amount: undefined,
          unit: undefined,
        },
  });

  const watchAmount = periodForm.watch('amount');
  const watchUnit = periodForm.watch('unit');

  const { mutateAsync: setSignerExpiry, isLoading } = trpc.recipient.setSignerExpiry.useMutation({
    onSuccess: (updatedRecipient) => {
      router.refresh();

      periodForm.reset(
        updatedRecipient?.expired
          ? calculatePeriod(updatedRecipient.expired)
          : {
              amount: undefined,
              unit: undefined,
            },
      );

      dateForm.reset(
        {
          expiry: updatedRecipient?.expired ?? undefined,
        },
        {
          keepValues: false,
        },
      );

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

  const onSetExpiry = async (
    values: z.infer<typeof dateFormSchema> | z.infer<typeof periodFormSchema>,
  ) => {
    if (!signer.nativeId) {
      return toast({
        title: _(msg`Error`),
        description: _(msg`An error occurred while setting the expiry date.`),
        variant: 'destructive',
        duration: 7500,
      });
    }

    let expiryDate: Date;

    if ('expiry' in values) {
      expiryDate = values.expiry;
    } else {
      const now = new Date();
      switch (values.unit) {
        case 'days':
          expiryDate = addDays(now, values.amount);
          break;
        case 'weeks':
          expiryDate = addWeeks(now, values.amount);
          break;
        case 'months':
          expiryDate = addMonths(now, values.amount);
          break;
        default:
          throw new Error(`Invalid unit: ${values.unit}`);
      }
    }

    await setSignerExpiry({
      documentId,
      signerId: signer.nativeId,
      expiry: expiryDate,
    });

    // TODO: Duncan => Implement logic to update expiry when resending document
    // This should be handled on the server-side when a document is resent

    // TODO: Duncan => Implement logic to mark recipients as expired
    // This should be a scheduled task or part of the completion process on the server
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Set Recipient Expiry</DialogTitle>
          <DialogDescription>
            Set the expiry date for the document signing recipient. The recipient will not be able
            to sign the document after this date.
          </DialogDescription>
        </DialogHeader>
        <Tabs
          value={activeTab}
          onValueChange={(value) => {
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
            return setActiveTab(value as 'date' | 'period');
          }}
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="date">Specific Date</TabsTrigger>
            <TabsTrigger value="period">Time Period</TabsTrigger>
          </TabsList>
          <TabsContent value="date">
            <Form {...dateForm}>
              <form onSubmit={dateForm.handleSubmit(onSetExpiry)} className="space-y-8">
                <FormField
                  control={dateForm.control}
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
                        <PopoverContent className="z-[1100] w-auto p-0" align="start">
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
          </TabsContent>
          <TabsContent value="period">
            <Form {...periodForm}>
              <form onSubmit={periodForm.handleSubmit(onSetExpiry)} className="space-y-8">
                <div className="flex space-x-4">
                  <FormField
                    control={periodForm.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormLabel>Amount</FormLabel>
                        <FormControl>
                          <Select
                            onValueChange={(value) => field.onChange(parseInt(value, 10))}
                            value={watchAmount?.toString()}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select amount" />
                            </SelectTrigger>
                            <SelectContent>
                              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                                <SelectItem key={num} value={num.toString()}>
                                  {num}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={periodForm.control}
                    name="unit"
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormLabel>Unit</FormLabel>
                        <FormControl>
                          <Select onValueChange={field.onChange} value={watchUnit}>
                            {' '}
                            <SelectTrigger>
                              <SelectValue placeholder="Select unit" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="days">Days</SelectItem>
                              <SelectItem value="weeks">Weeks</SelectItem>
                              <SelectItem value="months">Months</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormDescription>
                  The document will expire after the selected time period from now.
                </FormDescription>
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
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
