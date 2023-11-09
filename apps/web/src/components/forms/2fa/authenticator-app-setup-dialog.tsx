import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

import { ErrorCode, isErrorCode } from '@documenso/lib/next-auth/error-codes';
import { trpc } from '@documenso/trpc/react';
import { Button } from '@documenso/ui/primitives/button';
import { CardDescription } from '@documenso/ui/primitives/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@documenso/ui/primitives/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@documenso/ui/primitives/form/form';
import { Input } from '@documenso/ui/primitives/input';
import { useToast } from '@documenso/ui/primitives/use-toast';

type AuthenticatorAppSetupDialogProps = {
  secret?: string;
  qr?: string;
  onSetupComplete: () => void;
  open: boolean;
  onOpenChange: (_val: boolean) => void;
};

const formSchema = z.object({
  code: z.string().min(6).max(6),
});

const FIELD_ERROR_MESSAGES: Partial<Record<keyof typeof ErrorCode, string>> = {
  [ErrorCode.INCORRECT_TWO_FACTOR_CODE]: 'invalid 2fa code',
};

type TFormSchema = z.infer<typeof formSchema>;

export const AuthenticatorAppSetupDialog = ({
  qr,
  secret,
  onSetupComplete,
  open,
  onOpenChange,
}: AuthenticatorAppSetupDialogProps) => {
  const { toast } = useToast();

  const form = useForm<TFormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      code: '',
    },
  });

  const { mutateAsync: enable } = trpc.twoFactor.enable.useMutation({
    onError: ({ message }) => {
      if (isErrorCode(message) && FIELD_ERROR_MESSAGES[message]) {
        form.setError('code', { type: 'custom', message: FIELD_ERROR_MESSAGES[message] });
      }
    },

    onSuccess: () => {
      onSetupComplete();
      form.reset();
      toast({
        title: 'Success',
        description: 'successfully configured 2fa',
        variant: 'default',
      });
    },
  });

  const onSubmit = async (data: TFormSchema) => {
    try {
      await enable(data);
    } catch (error) {
      return;
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        onOpenChange(val);
        form.reset();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Setup two-factor authentication</DialogTitle>
          <DialogDescription>
            Use an authenticator app or browser extension to scan the qr code.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-y-2">
          <div>
            <img src={qr} alt="2fa qrcode" />
          </div>
          <CardDescription>
            Unable to scan? You can use the setup key to manually configure your authenticator app.
          </CardDescription>

          <div>
            <p>{secret}</p>
          </div>

          <hr className="my-2" />
          <Form {...form}>
            <form id="2fa-setup-form" className="max-w-xs" onSubmit={form.handleSubmit(onSubmit)}>
              <FormField
                control={form.control}
                name="code"
                render={({ field, formState: { isSubmitting } }) => (
                  <FormItem>
                    <FormLabel> OTP code</FormLabel>
                    <FormControl>
                      <Input disabled={isSubmitting} placeholder="xxxxxx" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </form>
          </Form>
        </div>
        <DialogFooter>
          <Button type="submit" form="2fa-setup-form">
            Submit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
