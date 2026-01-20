import { useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { Paperclip, Plus, X } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { AppError } from '@documenso/lib/errors/app-error';
import { trpc } from '@documenso/trpc/react';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@documenso/ui/primitives/form/form';
import { Input } from '@documenso/ui/primitives/input';
import { Popover, PopoverContent, PopoverTrigger } from '@documenso/ui/primitives/popover';
import { useToast } from '@documenso/ui/primitives/use-toast';

export type DocumentAttachmentsPopoverProps = {
  envelopeId: string;
  buttonClassName?: string;
  buttonSize?: 'sm' | 'default';
};

const ZAttachmentFormSchema = z.object({
  label: z.string().min(1, 'Label is required'),
  url: z.string().url('Must be a valid URL'),
});

type TAttachmentFormSchema = z.infer<typeof ZAttachmentFormSchema>;

export const DocumentAttachmentsPopover = ({
  envelopeId,
  buttonClassName,
  buttonSize,
}: DocumentAttachmentsPopoverProps) => {
  const { toast } = useToast();
  const { _ } = useLingui();

  const [isOpen, setIsOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  const utils = trpc.useUtils();

  const { data: attachments } = trpc.envelope.attachment.find.useQuery({
    envelopeId,
  });

  const { mutateAsync: createAttachment, isPending: isCreating } =
    trpc.envelope.attachment.create.useMutation({
      onSuccess: () => {
        void utils.envelope.attachment.find.invalidate({ envelopeId });
      },
    });

  const { mutateAsync: deleteAttachment } = trpc.envelope.attachment.delete.useMutation({
    onSuccess: () => {
      void utils.envelope.attachment.find.invalidate({ envelopeId });
    },
  });

  const form = useForm<TAttachmentFormSchema>({
    resolver: zodResolver(ZAttachmentFormSchema),
    defaultValues: {
      label: '',
      url: '',
    },
  });

  const onSubmit = async (data: TAttachmentFormSchema) => {
    try {
      await createAttachment({
        envelopeId,
        data: {
          label: data.label,
          data: data.url,
        },
      });

      form.reset();

      setIsAdding(false);

      toast({
        title: _(msg`Success`),
        description: _(msg`Attachment added successfully.`),
      });
    } catch (err) {
      const error = AppError.parseError(err);

      toast({
        title: _(msg`Error`),
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const onDeleteAttachment = async (id: string) => {
    try {
      await deleteAttachment({ id });

      toast({
        title: _(msg`Success`),
        description: _(msg`Attachment removed successfully.`),
      });
    } catch (err) {
      const error = AppError.parseError(err);

      toast({
        title: _(msg`Error`),
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn('gap-2', buttonClassName)} size={buttonSize}>
          <Paperclip className="h-4 w-4" />

          <span>
            <Trans>Attachments</Trans>
            {attachments && attachments.data.length > 0 && (
              <span className="ml-1">({attachments.data.length})</span>
            )}
          </span>
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-96" align="end">
        <div className="space-y-4">
          <div>
            <h4 className="font-medium">
              <Trans>Attachments</Trans>
            </h4>
            <p className="text-muted-foreground mt-1 text-sm">
              <Trans>Add links to relevant documents or resources.</Trans>
            </p>
          </div>

          {attachments && attachments.data.length > 0 && (
            <div className="space-y-2">
              {attachments?.data.map((attachment) => (
                <div
                  key={attachment.id}
                  className="border-border flex items-center justify-between rounded-md border p-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{attachment.label}</p>
                    <a
                      href={attachment.data}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-foreground truncate text-xs underline"
                    >
                      {attachment.data}
                    </a>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void onDeleteAttachment(attachment.id)}
                    className="ml-2 h-8 w-8 p-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {!isAdding && (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setIsAdding(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              <Trans>Add Attachment</Trans>
            </Button>
          )}

          {isAdding && (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
                <FormField
                  control={form.control}
                  name="label"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input placeholder={_(msg`Label`)} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="url"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input type="url" placeholder={_(msg`URL`)} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      setIsAdding(false);
                      form.reset();
                    }}
                  >
                    <Trans>Cancel</Trans>
                  </Button>
                  <Button type="submit" size="sm" className="flex-1" loading={isCreating}>
                    <Trans>Add</Trans>
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
