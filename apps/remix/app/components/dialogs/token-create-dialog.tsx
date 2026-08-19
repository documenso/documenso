import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { trpc } from '@documenso/trpc/react';
import { ZCreateApiTokenRequestSchema } from '@documenso/trpc/server/api-token-router/create-api-token.types';
import { CopyTextButton } from '@documenso/ui/components/common/copy-text-button';
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@documenso/ui/primitives/form/form';
import { Input } from '@documenso/ui/primitives/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@documenso/ui/primitives/select';
import { useToast } from '@documenso/ui/primitives/use-toast';
import { zodResolver } from '@hookform/resolvers/zod';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import type * as DialogPrimitive from '@radix-ui/react-dialog';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { match } from 'ts-pattern';
import type { z } from 'zod';

import { useCurrentTeam } from '~/providers/team';

const NEVER_EXPIRE = 'NEVER' as const;

export const EXPIRATION_DATES = {
  ONE_WEEK: msg`7 days`,
  ONE_MONTH: msg`1 month`,
  THREE_MONTHS: msg`3 months`,
  SIX_MONTHS: msg`6 months`,
  ONE_YEAR: msg`12 months`,
  [NEVER_EXPIRE]: msg`Never`,
} as const;

const ZCreateTokenFormSchema = ZCreateApiTokenRequestSchema.pick({
  tokenName: true,
  expirationDate: true,
});

type TCreateTokenFormSchema = z.infer<typeof ZCreateTokenFormSchema>;

export type TokenCreateDialogProps = {
  trigger?: React.ReactNode;
} & Omit<DialogPrimitive.DialogProps, 'children'>;

export const TokenCreateDialog = ({ trigger, ...props }: TokenCreateDialogProps) => {
  const { _ } = useLingui();
  const { toast } = useToast();

  const team = useCurrentTeam();

  const [open, setOpen] = useState(false);
  const [createdToken, setCreatedToken] = useState<string | null>(null);

  const form = useForm<TCreateTokenFormSchema>({
    resolver: zodResolver(ZCreateTokenFormSchema),
    defaultValues: {
      tokenName: '',
      expirationDate: 'THREE_MONTHS',
    },
  });

  const { mutateAsync: createToken } = trpc.apiToken.create.useMutation();

  const onSubmit = async ({ tokenName, expirationDate }: TCreateTokenFormSchema) => {
    try {
      const { token } = await createToken({
        teamId: team.id,
        tokenName,
        expirationDate: expirationDate === NEVER_EXPIRE ? null : expirationDate,
      });

      setCreatedToken(token);
    } catch (err) {
      const error = AppError.parseError(err);

      const errorMessage = match(error.code)
        .with(AppErrorCode.UNAUTHORIZED, () => msg`You do not have permission to create a token for this team.`)
        .otherwise(() => msg`Something went wrong. Please try again later.`);

      toast({
        title: _(msg`An error occurred`),
        description: _(errorMessage),
        variant: 'destructive',
        duration: 5000,
      });
    }
  };

  useEffect(() => {
    if (open) {
      form.reset();
      setCreatedToken(null);
    }
  }, [open, form]);

  return (
    <Dialog open={open} onOpenChange={(value) => !form.formState.isSubmitting && setOpen(value)} {...props}>
      <DialogTrigger onClick={(e) => e.stopPropagation()} asChild>
        {trigger ?? (
          <Button className="flex-shrink-0">
            <Trans>Create token</Trans>
          </Button>
        )}
      </DialogTrigger>

      <DialogContent
        className="max-w-lg"
        position="center"
        onInteractOutside={(event) => {
          // Prevent losing the created token by accidentally clicking outside the dialog.
          if (createdToken) {
            event.preventDefault();
          }
        }}
      >
        {createdToken ? (
          <>
            <DialogHeader>
              <DialogTitle>
                <Trans>Token created</Trans>
              </DialogTitle>

              <DialogDescription>
                <Trans>Copy your token now. For security reasons you will not be able to see it again.</Trans>
              </DialogDescription>
            </DialogHeader>

            <div className="relative">
              <Input
                className="pr-12 font-mono text-sm"
                aria-label={_(msg`Your new API token`)}
                name="createdToken"
                readOnly
                value={createdToken}
              />
              <div className="absolute top-0 right-2 bottom-0 flex items-center justify-center">
                <CopyTextButton
                  value={createdToken}
                  onCopySuccess={() => toast({ title: _(msg`Token copied to clipboard`) })}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" onClick={() => setOpen(false)}>
                <Trans>Done</Trans>
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>
                <Trans>Create API token</Trans>
              </DialogTitle>

              <DialogDescription>
                <Trans>Use API tokens to authenticate with the Documenso API.</Trans>
              </DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)}>
                <fieldset className="flex h-full flex-col space-y-4" disabled={form.formState.isSubmitting}>
                  <FormField
                    control={form.control}
                    name="tokenName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel required>
                          <Trans>Name</Trans>
                        </FormLabel>

                        <FormControl>
                          <Input className="bg-background" {...field} />
                        </FormControl>

                        <FormDescription>
                          <Trans>A name to help you identify this token later.</Trans>
                        </FormDescription>

                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="expirationDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          <Trans>Expires in</Trans>
                        </FormLabel>

                        <FormControl>
                          <Select value={field.value ?? NEVER_EXPIRE} onValueChange={field.onChange}>
                            <SelectTrigger className="bg-background">
                              <SelectValue />
                            </SelectTrigger>

                            <SelectContent>
                              {Object.entries(EXPIRATION_DATES).map(([key, date]) => (
                                <SelectItem key={key} value={key}>
                                  {_(date)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormControl>

                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <DialogFooter>
                    <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                      <Trans>Cancel</Trans>
                    </Button>

                    <Button type="submit" loading={form.formState.isSubmitting}>
                      <Trans>Create token</Trans>
                    </Button>
                  </DialogFooter>
                </fieldset>
              </form>
            </Form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
