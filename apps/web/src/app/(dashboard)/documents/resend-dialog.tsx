'use client';

import { useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { History } from 'lucide-react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

import { getRecipientType } from '@documenso/lib/client-only/recipient-type';
import { recipientAbbreviation } from '@documenso/lib/utils/recipient-formatter';
import { Recipient } from '@documenso/prisma/client';
import { trpc as trpcReact } from '@documenso/trpc/react';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import { Checkbox } from '@documenso/ui/primitives/checkbox';
import {
  Dialog,
  DialogClose,
  DialogContent,
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
  FormLabel,
} from '@documenso/ui/primitives/form/form';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { StackAvatar } from '~/components/(dashboard)/avatar/stack-avatar';

type ResendEmailMenuItemProps = {
  recipients: Recipient[];
  documentId: number;
};

const FormSchema = z.object({
  emails: z.array(z.string()).refine((value) => value.some((item) => item), {
    message: 'You have to select at least one item.',
  }),
});

type TFormSchema = z.infer<typeof FormSchema>;

export const ResendEmailMenuItem = (props: ResendEmailMenuItemProps) => {
  const { recipients, documentId } = props;
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();
  const { mutateAsync: sendDocument, isLoading } = trpcReact.document.resendDocument.useMutation({
    onSuccess: () => {
      toast({
        title: 'Document re-sent',
        description: 'Your document has been re-sent successfully.',
        duration: 5000,
      });
      setIsOpen(false);
    },
  });

  const form = useForm<TFormSchema>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      emails: [],
    },
  });

  const onSubmit = async (data: TFormSchema) => {
    await sendDocument({ documentId, recipientsEmail: data.emails });
  };
  return (
    <>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button
            disabled={!recipients.length}
            size="sm"
            variant="ghost"
            className="flex w-full justify-start px-2"
          >
            <History aria-hidden className="mr-2 h-4 w-4" />
            Resend
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[350px]" hideClose>
          <DialogHeader>
            <DialogTitle>
              <h1 className="text-center text-xl">Who do you want to remind?</h1>
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} id="remainder-email" className="px-3">
              <FormField
                control={form.control}
                name="emails"
                render={({ field }) => (
                  <>
                    {recipients.map((recipient) => (
                      <FormItem
                        key={recipient.id}
                        className="flex flex-row items-center justify-between gap-x-3"
                      >
                        <FormLabel
                          className={cn('my-2 flex items-center gap-2 font-normal', {
                            'opacity-50': !field.value?.includes(recipient.email),
                          })}
                        >
                          <StackAvatar
                            key={recipient.id}
                            type={getRecipientType(recipient)}
                            fallbackText={recipientAbbreviation(recipient)}
                          />
                          {recipient.email}
                        </FormLabel>
                        <FormControl>
                          <Checkbox
                            className="h-5 w-5 rounded-full data-[state=checked]:border-black data-[state=checked]:bg-black "
                            checkClassName="text-white"
                            value={recipient.email}
                            checked={field.value?.includes(recipient.email)}
                            onCheckedChange={(checked: boolean) => {
                              return checked
                                ? field.onChange([...field.value, recipient.email])
                                : field.onChange(
                                    field.value?.filter((value) => value !== recipient.email),
                                  );
                            }}
                          />
                        </FormControl>
                      </FormItem>
                    ))}
                  </>
                )}
              />
            </form>
          </Form>

          <DialogFooter>
            <div className="flex w-full flex-1 flex-nowrap gap-4">
              <DialogClose asChild>
                <Button
                  type="button"
                  className="dark:bg-muted dark:hover:bg-muted/80 flex-1  bg-black/5 hover:bg-black/10"
                  variant="secondary"
                >
                  Cancel
                </Button>
              </DialogClose>
              <Button className="flex-1" loading={isLoading} type="submit" form="remainder-email">
                Send reminder
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
