import { useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { Paperclip, Plus, X } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { useCurrentEnvelopeEditor } from '@documenso/lib/client-only/providers/envelope-editor-provider';
import { nanoid } from '@documenso/lib/universal/id';
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

export type EmbeddedEditorAttachmentPopoverProps = {
  buttonClassName?: string;
  buttonSize?: 'sm' | 'default';
};

const ZAttachmentFormSchema = z.object({
  label: z.string().min(1, 'Label is required'),
  url: z.string().url('Must be a valid URL'),
});

type TAttachmentFormSchema = z.infer<typeof ZAttachmentFormSchema>;

// NOTE: REMEMBER TO UPDATE THE NON-EMBEDDED VERSION OF THIS COMPONENT TOO.
export const EmbeddedEditorAttachmentPopover = ({
  buttonClassName,
  buttonSize,
}: EmbeddedEditorAttachmentPopoverProps) => {
  const { toast } = useToast();
  const { _ } = useLingui();

  const [isOpen, setIsOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  const { envelope, setLocalEnvelope } = useCurrentEnvelopeEditor();

  const attachments = envelope.attachments ?? [];

  const form = useForm<TAttachmentFormSchema>({
    resolver: zodResolver(ZAttachmentFormSchema),
    defaultValues: {
      label: '',
      url: '',
    },
  });

  const onSubmit = (data: TAttachmentFormSchema) => {
    setLocalEnvelope({
      attachments: [
        ...attachments,
        {
          id: nanoid(),
          type: 'link',
          label: data.label,
          data: data.url,
        },
      ],
    });

    form.reset();
    setIsAdding(false);

    toast({
      title: _(msg`Success`),
      description: _(msg`Attachment added successfully.`),
    });
  };

  const onDeleteAttachment = (id: string) => {
    setLocalEnvelope({
      attachments: attachments.filter((a) => a.id !== id),
    });

    toast({
      title: _(msg`Success`),
      description: _(msg`Attachment removed successfully.`),
    });
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn('gap-2', buttonClassName)} size={buttonSize}>
          <Paperclip className="h-4 w-4" />

          <span>
            <Trans>Attachments</Trans>
            {attachments.length > 0 && <span className="ml-1">({attachments.length})</span>}
          </span>
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-96" align="end">
        <div className="space-y-4">
          <div>
            <h4 className="font-medium">
              <Trans>Attachments</Trans>
            </h4>
            <p className="mt-1 text-sm text-muted-foreground">
              <Trans>Add links to relevant documents or resources.</Trans>
            </p>
          </div>

          {attachments.length > 0 && (
            <div className="space-y-2">
              {attachments.map((attachment) => (
                <div
                  key={attachment.id}
                  className="flex items-center justify-between rounded-md border border-border p-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{attachment.label}</p>
                    <a
                      href={attachment.data}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate text-xs text-muted-foreground underline hover:text-foreground"
                    >
                      {attachment.data}
                    </a>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDeleteAttachment(attachment.id)}
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
                  <Button type="submit" size="sm" className="flex-1">
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
