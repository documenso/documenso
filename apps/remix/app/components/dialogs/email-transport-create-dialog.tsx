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
import { useToast } from '@documenso/ui/primitives/use-toast';
import { Trans, useLingui } from '@lingui/react/macro';
import { useState } from 'react';

import {
  EmailTransportForm,
  type EmailTransportFormValues,
  emailTransportFormToConfig,
} from '../forms/email-transport-form';

export type EmailTransportCreateDialogProps = {
  trigger?: React.ReactNode;
};

export const EmailTransportCreateDialog = ({ trigger }: EmailTransportCreateDialogProps) => {
  const { t } = useLingui();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);

  const { mutateAsync: createTransport, isPending } = trpc.admin.emailTransport.create.useMutation({
    onSuccess: () => {
      toast({
        title: t`Transport created.`,
      });

      setOpen(false);
    },
    onError: (error) => {
      toast({
        title: t`Failed to create transport.`,
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const onFormSubmit = async (values: EmailTransportFormValues) => {
    await createTransport({
      name: values.name,
      fromName: values.fromName,
      fromAddress: values.fromAddress,
      config: emailTransportFormToConfig(values),
    });
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !isPending && setOpen(value)}>
      <DialogTrigger onClick={(e) => e.stopPropagation()} asChild>
        {trigger ?? (
          <Button className="flex-shrink-0">
            <Trans>Add transport</Trans>
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="scrollbar-hidden max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            <Trans>Add Email Transport</Trans>
          </DialogTitle>
          <DialogDescription>
            <Trans>Fill in the details to create a new email transport.</Trans>
          </DialogDescription>
        </DialogHeader>

        <EmailTransportForm
          onFormSubmit={onFormSubmit}
          formSubmitTrigger={
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
                <Trans>Cancel</Trans>
              </Button>

              <Button type="submit" loading={isPending}>
                <Trans>Create</Trans>
              </Button>
            </DialogFooter>
          }
        />
      </DialogContent>
    </Dialog>
  );
};
