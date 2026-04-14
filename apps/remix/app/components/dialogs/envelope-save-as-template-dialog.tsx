import { useState } from 'react';

import { Trans, useLingui } from '@lingui/react/macro';
import { Controller, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';

import { formatTemplatesPath } from '@documenso/lib/utils/teams';
import { trpc } from '@documenso/trpc/react';
import { Button } from '@documenso/ui/primitives/button';
import { Checkbox } from '@documenso/ui/primitives/checkbox';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@documenso/ui/primitives/dialog';
import { Label } from '@documenso/ui/primitives/label';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { useCurrentTeam } from '~/providers/team';

type EnvelopeSaveAsTemplateDialogProps = {
  envelopeId: string;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export const EnvelopeSaveAsTemplateDialog = ({
  envelopeId,
  trigger,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: EnvelopeSaveAsTemplateDialogProps) => {
  const navigate = useNavigate();

  const [internalOpen, setInternalOpen] = useState(false);

  const open = controlledOpen ?? internalOpen;
  const setOpen = controlledOnOpenChange ?? setInternalOpen;

  const { toast } = useToast();
  const { t } = useLingui();

  const team = useCurrentTeam();

  const templatesPath = formatTemplatesPath(team.url);

  const form = useForm({
    defaultValues: {
      includeRecipients: true,
      includeFields: true,
    },
  });

  const includeRecipients = form.watch('includeRecipients');

  const { mutateAsync: saveAsTemplate, isPending } = trpc.envelope.saveAsTemplate.useMutation({
    onSuccess: async ({ id }) => {
      toast({
        title: t`Template Created`,
        description: t`Your document has been saved as a template.`,
        duration: 5000,
      });

      await navigate(`${templatesPath}/${id}/edit`);
      setOpen(false);
    },
  });

  const onSubmit = async () => {
    const { includeRecipients, includeFields } = form.getValues();

    try {
      await saveAsTemplate({
        envelopeId,
        includeRecipients,
        includeFields: includeRecipients && includeFields,
      });
    } catch {
      toast({
        title: t`Something went wrong`,
        description: t`This document could not be saved as a template at this time. Please try again.`,
        variant: 'destructive',
        duration: 7500,
      });
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (isPending) {
          return;
        }

        setOpen(value);

        if (!value) {
          form.reset();
        }
      }}
    >
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}

      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <Trans>Save as Template</Trans>
          </DialogTitle>
          <DialogDescription>
            <Trans>Create a template from this document.</Trans>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Controller
            control={form.control}
            name="includeRecipients"
            render={({ field }) => (
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="envelopeIncludeRecipients"
                  checked={field.value}
                  onCheckedChange={(checked) => {
                    field.onChange(checked === true);

                    if (!checked) {
                      form.setValue('includeFields', false);
                    }
                  }}
                />
                <Label htmlFor="envelopeIncludeRecipients">
                  <Trans>Include Recipients</Trans>
                </Label>
              </div>
            )}
          />

          <Controller
            control={form.control}
            name="includeFields"
            render={({ field }) => (
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="envelopeIncludeFields"
                  checked={field.value}
                  disabled={!includeRecipients}
                  onCheckedChange={(checked) => field.onChange(checked === true)}
                />
                <Label
                  htmlFor="envelopeIncludeFields"
                  className={!includeRecipients ? 'opacity-50' : ''}
                >
                  <Trans>Include Fields</Trans>
                </Label>
              </div>
            )}
          />
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary" disabled={isPending}>
              <Trans>Cancel</Trans>
            </Button>
          </DialogClose>

          <Button type="button" loading={isPending} onClick={onSubmit}>
            <Trans>Save as Template</Trans>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
