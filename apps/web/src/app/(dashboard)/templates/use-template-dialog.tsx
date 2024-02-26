import { useRouter } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';
import { Plus } from 'lucide-react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import * as z from 'zod';

import type { Recipient } from '@documenso/prisma/client';
import { RecipientRole } from '@documenso/prisma/client';
import { trpc } from '@documenso/trpc/react';
import { Button } from '@documenso/ui/primitives/button';
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
import { FormErrorMessage } from '@documenso/ui/primitives/form/form-error-message';
import { Input } from '@documenso/ui/primitives/input';
import { Label } from '@documenso/ui/primitives/label';
import { ROLE_ICONS } from '@documenso/ui/primitives/recipient-role-icons';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@documenso/ui/primitives/select';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { useOptionalCurrentTeam } from '~/providers/team';

const ZAddRecipientsForNewDocumentSchema = z.object({
  recipients: z.array(
    z.object({
      email: z.string().email(),
      name: z.string(),
      role: z.nativeEnum(RecipientRole),
    }),
  ),
});

type TAddRecipientsForNewDocumentSchema = z.infer<typeof ZAddRecipientsForNewDocumentSchema>;

export type UseTemplateDialogProps = {
  templateId: number;
  recipients: Recipient[];
  documentRootPath: string;
};

export function UseTemplateDialog({
  recipients,
  documentRootPath,
  templateId,
}: UseTemplateDialogProps) {
  const router = useRouter();
  const { toast } = useToast();

  const team = useOptionalCurrentTeam();

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<TAddRecipientsForNewDocumentSchema>({
    resolver: zodResolver(ZAddRecipientsForNewDocumentSchema),
    defaultValues: {
      recipients:
        recipients.length > 0
          ? recipients.map((recipient) => ({
              nativeId: recipient.id,
              formId: String(recipient.id),
              name: recipient.name,
              email: recipient.email,
              role: recipient.role,
            }))
          : [
              {
                name: '',
                email: '',
                role: RecipientRole.SIGNER,
              },
            ],
    },
  });

  const { mutateAsync: createDocumentFromTemplate, isLoading: isCreatingDocumentFromTemplate } =
    trpc.template.createDocumentFromTemplate.useMutation();

  const onSubmit = async (data: TAddRecipientsForNewDocumentSchema) => {
    try {
      const { id } = await createDocumentFromTemplate({
        templateId,
        teamId: team?.id,
        recipients: data.recipients,
      });

      toast({
        title: 'Document created',
        description: 'Your document has been created from the template successfully.',
        duration: 5000,
      });

      router.push(`${documentRootPath}/${id}`);
    } catch (err) {
      toast({
        title: 'Error',
        description: 'An error occurred while creating document from template.',
        variant: 'destructive',
      });
    }
  };

  const onCreateDocumentFromTemplate = handleSubmit(onSubmit);

  const { fields: formRecipients } = useFieldArray({
    control,
    name: 'recipients',
  });

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className="cursor-pointer">
          <Plus className="-ml-1 mr-2 h-4 w-4" />
          Use Template
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Document Recipients</DialogTitle>
          <DialogDescription>Add the recipients to create the template with.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col space-y-4">
          {formRecipients.map((recipient, index) => (
            <div
              key={recipient.id}
              data-native-id={recipient.id}
              className="flex flex-wrap items-end gap-x-4"
            >
              <div className="flex-1">
                <Label htmlFor={`recipient-${recipient.id}-email`}>
                  Email
                  <span className="text-destructive ml-1 inline-block font-medium">*</span>
                </Label>

                <Controller
                  control={control}
                  name={`recipients.${index}.email`}
                  render={({ field }) => (
                    <Input
                      id={`recipient-${recipient.id}-email`}
                      type="email"
                      className="bg-background mt-2"
                      disabled={isSubmitting}
                      {...field}
                    />
                  )}
                />
              </div>

              <div className="flex-1">
                <Label htmlFor={`recipient-${recipient.id}-name`}>Name</Label>

                <Controller
                  control={control}
                  name={`recipients.${index}.name`}
                  render={({ field }) => (
                    <Input
                      id={`recipient-${recipient.id}-name`}
                      type="text"
                      className="bg-background mt-2"
                      disabled={isSubmitting}
                      {...field}
                    />
                  )}
                />
              </div>

              <div className="w-[60px]">
                <Controller
                  control={control}
                  name={`recipients.${index}.role`}
                  render={({ field: { value, onChange } }) => (
                    <Select value={value} onValueChange={(x) => onChange(x)}>
                      <SelectTrigger className="bg-background">{ROLE_ICONS[value]}</SelectTrigger>

                      <SelectContent className="" align="end">
                        <SelectItem value={RecipientRole.SIGNER}>
                          <div className="flex items-center">
                            <span className="mr-2">{ROLE_ICONS[RecipientRole.SIGNER]}</span>
                            Signer
                          </div>
                        </SelectItem>

                        <SelectItem value={RecipientRole.CC}>
                          <div className="flex items-center">
                            <span className="mr-2">{ROLE_ICONS[RecipientRole.CC]}</span>
                            Receives copy
                          </div>
                        </SelectItem>

                        <SelectItem value={RecipientRole.APPROVER}>
                          <div className="flex items-center">
                            <span className="mr-2">{ROLE_ICONS[RecipientRole.APPROVER]}</span>
                            Approver
                          </div>
                        </SelectItem>

                        <SelectItem value={RecipientRole.VIEWER}>
                          <div className="flex items-center">
                            <span className="mr-2">{ROLE_ICONS[RecipientRole.VIEWER]}</span>
                            Viewer
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div className="w-full">
                <FormErrorMessage className="mt-2" error={errors.recipients?.[index]?.email} />
                <FormErrorMessage className="mt-2" error={errors.recipients?.[index]?.name} />
              </div>
            </div>
          ))}
        </div>

        <DialogFooter className="justify-end">
          <DialogClose asChild>
            <Button type="button" variant="secondary">
              Close
            </Button>
          </DialogClose>

          <Button
            type="button"
            loading={isCreatingDocumentFromTemplate}
            disabled={isCreatingDocumentFromTemplate}
            onClick={onCreateDocumentFromTemplate}
          >
            Create Document
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
