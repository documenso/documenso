'use client';

import { useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { History } from 'lucide-react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

import { Recipient } from '@documenso/prisma/client';
import { trpc as trpcReact } from '@documenso/trpc/react';
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

interface ResendEmailMenuItemProps {
  recipients: Recipient[];
  documentId: number;
}

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
  const { mutateAsync: sendDocument, isLoading } = trpcReact.document.sendDocument.useMutation({
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
    await sendDocument({ documentId, resendEmails: data.emails });
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
        <DialogContent className="sm:max-w-[400px]" hideClose>
          <DialogHeader>
            <DialogTitle>
              <h1 className="text-center text-xl">Who do you want to remind?</h1>
            </DialogTitle>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} id="remainder-email" className="pt-5">
                <FormField
                  control={form.control}
                  name="emails"
                  render={({ field }) => (
                    <>
                      {recipients.map((item) => (
                        <FormItem
                          key={item.id}
                          className="flex flex-row items-center justify-between gap-x-3"
                        >
                          <FormLabel className="break-all text-sm font-normal">
                            {item.email}
                          </FormLabel>
                          <FormControl>
                            <Checkbox
                              value={item.email}
                              checked={field.value?.includes(item.email)}
                              onCheckedChange={(checked: boolean) => {
                                return checked
                                  ? field.onChange([...field.value, item.email])
                                  : field.onChange(
                                      field.value?.filter((value) => value !== item.email),
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
          </DialogHeader>

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
