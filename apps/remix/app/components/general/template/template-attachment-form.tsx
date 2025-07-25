import { useEffect } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { Trans, useLingui } from '@lingui/react/macro';
import { Trash } from 'lucide-react';
import { useFieldArray, useForm } from 'react-hook-form';

import { nanoid } from '@documenso/lib/universal/id';
import { AttachmentType } from '@documenso/prisma/generated/types';
import { trpc } from '@documenso/trpc/react';
import type { TSetTemplateAttachmentsSchema } from '@documenso/trpc/server/template-router/set-template-attachments.types';
import { ZSetTemplateAttachmentsSchema } from '@documenso/trpc/server/template-router/set-template-attachments.types';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
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
  FormMessage,
} from '@documenso/ui/primitives/form/form';
import { Input } from '@documenso/ui/primitives/input';
import { useToast } from '@documenso/ui/primitives/use-toast';

export type AttachmentFormProps = {
  templateId: number;
};

export const AttachmentForm = ({ templateId }: AttachmentFormProps) => {
  const { toast } = useToast();
  const { t } = useLingui();

  const { data: attachmentsData, refetch: refetchAttachments } =
    trpc.template.attachments.find.useQuery({
      templateId,
    });

  const { mutateAsync: setTemplateAttachments } = trpc.template.attachments.set.useMutation();

  const defaultAttachments = [
    {
      id: nanoid(12),
      label: '',
      url: '',
      type: AttachmentType.LINK,
    },
  ];

  const form = useForm<TSetTemplateAttachmentsSchema>({
    resolver: zodResolver(ZSetTemplateAttachmentsSchema),
    defaultValues: {
      templateId,
      attachments: attachmentsData ?? defaultAttachments,
    },
  });

  const {
    fields: attachments,
    append: appendAttachment,
    remove: removeAttachment,
  } = useFieldArray({
    control: form.control,
    name: 'attachments',
  });

  const onAddAttachment = () => {
    appendAttachment({
      id: nanoid(12),
      label: '',
      url: '',
      type: AttachmentType.LINK,
    });
  };

  const onRemoveAttachment = (index: number) => {
    removeAttachment(index);
  };

  useEffect(() => {
    if (attachmentsData && attachmentsData.length > 0) {
      form.setValue('attachments', attachmentsData);
    }
  }, [attachmentsData]);

  const onSubmit = async (data: TSetTemplateAttachmentsSchema) => {
    try {
      await setTemplateAttachments({
        templateId,
        attachments: data.attachments,
      });

      toast({
        title: t`Attachment(s) updated`,
        description: t`The attachment(s) have been updated successfully`,
      });

      await refetchAttachments();
    } catch (error) {
      console.error(error);

      toast({
        title: t`Something went wrong`,
        description: t`We encountered an unknown error while attempting to create the attachments.`,
        variant: 'destructive',
        duration: 5000,
      });
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Trans>Attachments</Trans>
        </Button>
      </DialogTrigger>
      <DialogContent position="center">
        <DialogHeader>
          <DialogTitle>
            <Trans>Attachments</Trans>
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <fieldset disabled={form.formState.isSubmitting} className="space-y-4">
              {attachments.map((attachment, index) => (
                <div key={attachment.id} className="flex items-end gap-2">
                  <FormField
                    control={form.control}
                    name={`attachments.${index}.label`}
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormLabel required>
                          <Trans>Label</Trans>
                        </FormLabel>
                        <FormControl>
                          <Input {...field} placeholder={t`Attachment label`} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`attachments.${index}.url`}
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormLabel required>
                          <Trans>URL</Trans>
                        </FormLabel>
                        <FormControl>
                          <Input {...field} placeholder={t`https://...`} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemoveAttachment(index)}
                  >
                    <Trash className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </fieldset>
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={onAddAttachment}>
                <Trans>Add</Trans>
              </Button>
              <Button type="submit">
                <Trans>Save</Trans>
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
