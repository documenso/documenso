import { useEffect } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from './button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './dialog';
import { Form, FormControl, FormField, FormItem, FormMessage } from './form/form';
import { Input } from './input';

const ZPasswordDialogFormSchema = z.object({
  password: z.string(),
});

type TPasswordDialogFormSchema = z.infer<typeof ZPasswordDialogFormSchema>;

type PasswordDialogProps = {
  open: boolean;
  onOpenChange: (_open: boolean) => void;
  defaultPassword?: string;
  onPasswordSubmit?: (password: string) => void;
  isError?: boolean;
};

export const PasswordDialog = ({
  open,
  onOpenChange,
  defaultPassword,
  onPasswordSubmit,
  isError,
}: PasswordDialogProps) => {
  const form = useForm<TPasswordDialogFormSchema>({
    defaultValues: {
      password: defaultPassword ?? '',
    },
    resolver: zodResolver(ZPasswordDialogFormSchema),
  });

  const onFormSubmit = ({ password }: TPasswordDialogFormSchema) => {
    onPasswordSubmit?.(password);
  };

  useEffect(() => {
    if (isError) {
      form.setError('password', {
        type: 'manual',
        message: 'The password you have entered is incorrect. Please try again.',
      });
    }
  }, [form, isError]);

  return (
    <Dialog open={open}>
      <DialogContent className="w-full max-w-md">
        <DialogHeader>
          <DialogTitle>Password Required</DialogTitle>

          <DialogDescription className="text-muted-foreground">
            This document is password protected. Please enter the password to view the document.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onFormSubmit)}>
            <fieldset className="flex flex-wrap items-start justify-between gap-4">
              <FormField
                name="password"
                control={form.control}
                render={({ field }) => (
                  <FormItem className="relative flex-1">
                    <FormControl>
                      <Input
                        type="password"
                        className="bg-background"
                        placeholder="Enter password"
                        autoComplete="off"
                        {...field}
                      />
                    </FormControl>

                    <FormMessage />
                  </FormItem>
                )}
              />

              <div>
                <Button>Submit</Button>
              </div>
            </fieldset>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
