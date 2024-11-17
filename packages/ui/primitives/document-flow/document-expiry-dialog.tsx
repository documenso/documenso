'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Trans } from '@lingui/macro';
import { format } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

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

const formSchema = z.object({
  expiryDate: z.date({
    required_error: 'Please select an expiry date.',
  }),
});

type DocumentExpiryDialogProps = {
  open: boolean;
  onOpenChange: (_open: boolean) => void;
};

export default function DocumentExpiryDialog({ open, onOpenChange }: DocumentExpiryDialogProps) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });

  // const { mutateAsync: moveDocument, isLoading } = trpc.document.moveDocumentToTeam.useMutation({
  //   onSuccess: () => {
  //     router.refresh();
  //     toast({
  //       title: _(msg`Document moved`),
  //       description: _(msg`The document has been successfully moved to the selected team.`),
  //       duration: 5000,
  //     });
  //     onOpenChange(false);
  //   },
  //   onError: (error) => {
  //     toast({
  //       title: _(msg`Error`),
  //       description: error.message || _(msg`An error occurred while moving the document.`),
  //       variant: 'destructive',
  //       duration: 7500,
  //     });
  //   },
  // });

  function onSubmit(values: z.infer<typeof formSchema>) {
    console.log(values);
    onOpenChange(false);
  }

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
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <FormField
              control={form.control}
              name="expiryDate"
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
              <Button type="submit">
                <Trans>Save Changes</Trans>
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
