import { trpc } from '@documenso/trpc/react';
import type { TFindEmailTransportsResponse } from '@documenso/trpc/server/admin-router/email-transport/find-email-transports.types';
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
import { useToast } from '@documenso/ui/primitives/use-toast';
import { Trans, useLingui } from '@lingui/react/macro';
import { useState } from 'react';

import {
  EmailTransportForm,
  type EmailTransportFormValues,
  emailTransportFormToConfig,
} from '../forms/email-transport-form';

export type EmailTransportUpdateDialogProps = {
  transport: TFindEmailTransportsResponse['data'][number];
  trigger: React.ReactNode;
};

export const EmailTransportUpdateDialog = ({ transport, trigger }: EmailTransportUpdateDialogProps) => {
  const { t } = useLingui();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);

  const { mutateAsync: updateTransport, isPending } = trpc.admin.emailTransport.update.useMutation();

  const onFormSubmit = async (values: EmailTransportFormValues) => {
    try {
      await updateTransport({
        id: transport.id,
        data: {
          name: values.name,
          fromName: values.fromName,
          fromAddress: values.fromAddress,
          config: emailTransportFormToConfig(values),
        },
      });

      toast({
        title: t`Transport updated.`,
      });

      setOpen(false);
    } catch {
      toast({
        title: t`Failed to save transport.`,
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !isPending && setOpen(value)}>
      <DialogTrigger asChild onClick={(e) => e.stopPropagation()}>
        {trigger}
      </DialogTrigger>

      <DialogContent className="scrollbar-hidden max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            <Trans>Edit Email Transport</Trans>
          </DialogTitle>
          <DialogDescription>
            <Trans>Modify the details of the email transport.</Trans>
          </DialogDescription>
        </DialogHeader>

        <EmailTransportForm
          isEdit
          defaultValues={{
            // Pre-fill the non-secret connection settings; secrets stay blank
            // and are preserved on save unless re-entered.
            ...(transport.config ?? {}),
            name: transport.name,
            fromName: transport.fromName,
            fromAddress: transport.fromAddress,
            type: transport.type,
          }}
          onFormSubmit={onFormSubmit}
          formSubmitTrigger={
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
                <Trans>Cancel</Trans>
              </Button>

              <Button type="submit" loading={isPending}>
                <Trans>Save changes</Trans>
              </Button>
            </DialogFooter>
          }
        />
      </DialogContent>
    </Dialog>
  );
};
