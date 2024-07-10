'use client';

import { useEffect, useMemo, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import type * as DialogPrimitive from '@radix-ui/react-dialog';
import { CheckCircle2Icon, CircleIcon } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { P, match } from 'ts-pattern';
import { z } from 'zod';

import type { Template, TemplateDirectLink } from '@documenso/prisma/client';
import { TemplateType } from '@documenso/prisma/client';
import { trpc } from '@documenso/trpc/react';
import {
  MAX_TEMPLATE_PUBLIC_DESCRIPTION_LENGTH,
  MAX_TEMPLATE_PUBLIC_TITLE_LENGTH,
} from '@documenso/trpc/server/template-router/schema';
import { AnimateGenericFadeInOut } from '@documenso/ui/components/animate/animate-generic-fade-in-out';
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@documenso/ui/primitives/form/form';
import { Input } from '@documenso/ui/primitives/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@documenso/ui/primitives/table';
import { Textarea } from '@documenso/ui/primitives/textarea';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { useOptionalCurrentTeam } from '~/providers/team';

import { LocaleDate } from '../formatter/locale-date';

export type ManagePublicTemplateDialogProps = {
  directTemplates: (Template & {
    directLink: Pick<TemplateDirectLink, 'token' | 'enabled'>;
  })[];
  initialTemplateId?: number | null;
  initialStep?: ProfileTemplateStep;
  trigger?: React.ReactNode;
  isOpen?: boolean;
  onIsOpenChange?: (value: boolean) => unknown;
} & Omit<DialogPrimitive.DialogProps, 'children'>;

const ZUpdatePublicTemplateFormSchema = z.object({
  publicTitle: z
    .string()
    .min(1, { message: 'Title is required' })
    .max(MAX_TEMPLATE_PUBLIC_TITLE_LENGTH, {
      message: `Title cannot be longer than ${MAX_TEMPLATE_PUBLIC_TITLE_LENGTH} characters`,
    }),
  publicDescription: z
    .string()
    .min(1, { message: 'Description is required' })
    .max(MAX_TEMPLATE_PUBLIC_DESCRIPTION_LENGTH, {
      message: `Description cannot be longer than ${MAX_TEMPLATE_PUBLIC_DESCRIPTION_LENGTH} characters`,
    }),
});

type TUpdatePublicTemplateFormSchema = z.infer<typeof ZUpdatePublicTemplateFormSchema>;

type ProfileTemplateStep = 'SELECT_TEMPLATE' | 'MANAGE' | 'CONFIRM_DISABLE';

export const ManagePublicTemplateDialog = ({
  directTemplates,
  trigger,
  initialTemplateId = null,
  initialStep = 'SELECT_TEMPLATE',
  isOpen = false,
  onIsOpenChange,
  ...props
}: ManagePublicTemplateDialogProps) => {
  const { toast } = useToast();

  const [open, onOpenChange] = useState(isOpen);

  const team = useOptionalCurrentTeam();

  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(initialTemplateId);

  const [currentStep, setCurrentStep] = useState<ProfileTemplateStep>(() => {
    if (initialStep) {
      return initialStep;
    }

    return selectedTemplateId ? 'MANAGE' : 'SELECT_TEMPLATE';
  });

  const form = useForm({
    resolver: zodResolver(ZUpdatePublicTemplateFormSchema),
    defaultValues: {
      publicTitle: '',
      publicDescription: '',
    },
  });

  const { mutateAsync: updateTemplateSettings, isLoading: isUpdatingTemplateSettings } =
    trpc.template.updateTemplateSettings.useMutation();

  const setTemplateToPrivate = async (templateId: number) => {
    try {
      await updateTemplateSettings({
        templateId,
        teamId: team?.id,
        data: {
          type: TemplateType.PRIVATE,
        },
      });

      toast({
        title: 'Success',
        description: 'Template has been removed from your public profile.',
        duration: 5000,
      });

      handleOnOpenChange(false);
    } catch {
      toast({
        title: 'An unknown error occurred',
        variant: 'destructive',
        description:
          'We encountered an unknown error while attempting to remove this template from your profile. Please try again later.',
      });
    }
  };

  const onFormSubmit = async ({
    publicTitle,
    publicDescription,
  }: TUpdatePublicTemplateFormSchema) => {
    if (!selectedTemplateId) {
      return;
    }

    try {
      await updateTemplateSettings({
        templateId: selectedTemplateId,
        teamId: team?.id,
        data: {
          type: TemplateType.PUBLIC,
          publicTitle,
          publicDescription,
        },
      });

      toast({
        title: 'Success',
        description: 'Template has been updated.',
        duration: 5000,
      });

      onOpenChange(false);
    } catch {
      toast({
        title: 'An unknown error occurred',
        variant: 'destructive',
        description:
          'We encountered an unknown error while attempting to update the template. Please try again later.',
      });
    }
  };

  const selectedTemplate = useMemo(
    () => directTemplates.find((template) => template.id === selectedTemplateId),
    [directTemplates, selectedTemplateId],
  );

  const onManageStep = () => {
    if (!selectedTemplate) {
      return;
    }

    form.reset({
      publicTitle: selectedTemplate.publicTitle,
      publicDescription: selectedTemplate.publicDescription,
    });

    setCurrentStep('MANAGE');
  };

  const isLoading = isUpdatingTemplateSettings || form.formState.isSubmitting;

  useEffect(() => {
    const initialTemplate = directTemplates.find((template) => template.id === initialTemplateId);

    if (initialTemplate) {
      setSelectedTemplateId(initialTemplate.id);

      form.reset({
        publicTitle: initialTemplate.publicTitle,
        publicDescription: initialTemplate.publicDescription,
      });
    } else {
      setSelectedTemplateId(null);
    }

    const step = initialStep || (selectedTemplateId ? 'MANAGE' : 'SELECT_TEMPLATE');

    setCurrentStep(step);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTemplateId, initialStep, open, isOpen]);

  const handleOnOpenChange = (value: boolean) => {
    if (isLoading || typeof value !== 'boolean') {
      return;
    }

    onOpenChange(value);
    onIsOpenChange?.(value);
  };

  return (
    <Dialog {...props} open={isOpen || open} onOpenChange={handleOnOpenChange}>
      <fieldset disabled={isLoading} className="relative flex-shrink-0">
        <DialogTrigger asChild>{trigger}</DialogTrigger>

        <AnimateGenericFadeInOut motionKey={currentStep}>
          {match({ templateId: selectedTemplateId, currentStep })
            .with({ currentStep: 'SELECT_TEMPLATE' }, () => (
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{team?.name || 'Your'} direct signing templates</DialogTitle>

                  <DialogDescription>
                    Select a template you'd like to display on your {team && `team's`} public
                    profile
                  </DialogDescription>
                </DialogHeader>

                <div className="custom-scrollbar max-h-[60vh] overflow-y-auto rounded-md border">
                  <Table overflowHidden>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Template</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {directTemplates.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={3} className="h-16 text-center">
                            <p className="text-muted-foreground">No valid direct templates found</p>
                          </TableCell>
                        </TableRow>
                      )}

                      {directTemplates.map((row) => (
                        <TableRow
                          className="w-full cursor-pointer"
                          key={row.id}
                          onClick={() => setSelectedTemplateId(row.id)}
                        >
                          <TableCell className="text-muted-foreground max-w-[30ch] text-sm">
                            {row.title}
                          </TableCell>

                          <TableCell className="text-muted-foreground text-sm">
                            <LocaleDate date={row.createdAt} />
                          </TableCell>

                          <TableCell>
                            {selectedTemplateId === row.id ? (
                              <CheckCircle2Icon className="h-5 w-5 text-neutral-600 dark:text-neutral-200" />
                            ) : (
                              <CircleIcon className="h-5 w-5 text-neutral-300 dark:text-neutral-600" />
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button type="button" variant="secondary">
                      Close
                    </Button>
                  </DialogClose>

                  <Button
                    type="button"
                    disabled={selectedTemplateId === null}
                    onClick={() => onManageStep()}
                  >
                    Continue
                  </Button>
                </DialogFooter>
              </DialogContent>
            ))
            .with({ templateId: P.number, currentStep: 'MANAGE' }, () => (
              <DialogContent className="relative">
                <DialogHeader>
                  <DialogTitle>Configure template</DialogTitle>

                  <DialogDescription>Manage details for this public template</DialogDescription>
                </DialogHeader>

                <Form {...form}>
                  <form
                    className="flex h-full flex-col space-y-4"
                    onSubmit={form.handleSubmit(onFormSubmit)}
                  >
                    <FormField
                      control={form.control}
                      name="publicTitle"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel required>Title</FormLabel>
                          <FormControl>
                            <Input placeholder="The public name for your template" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="publicDescription"
                      render={({ field }) => {
                        const remaningLength =
                          MAX_TEMPLATE_PUBLIC_DESCRIPTION_LENGTH - (field.value || '').length;
                        const pluralWord =
                          Math.abs(remaningLength) === 1 ? 'character' : 'characters';

                        return (
                          <FormItem>
                            <FormLabel required>Description</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="The public description that will be displayed with this template"
                                {...field}
                              />
                            </FormControl>

                            {!form.formState.errors.publicDescription && (
                              <p className="text-muted-foreground text-sm">
                                {remaningLength >= 0
                                  ? `${remaningLength} ${pluralWord} remaining`
                                  : `${Math.abs(remaningLength)} ${pluralWord} over the limit`}
                              </p>
                            )}

                            <FormMessage />
                          </FormItem>
                        );
                      }}
                    />

                    <DialogFooter>
                      {selectedTemplate?.type === TemplateType.PUBLIC && (
                        <Button
                          variant="destructive"
                          className="mr-auto w-full sm:w-auto"
                          onClick={() => setCurrentStep('CONFIRM_DISABLE')}
                        >
                          Disable
                        </Button>
                      )}

                      <DialogClose asChild>
                        <Button variant="secondary">Close</Button>
                      </DialogClose>

                      <Button type="submit" loading={isUpdatingTemplateSettings}>
                        Update
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            ))
            .with({ templateId: P.number, currentStep: 'CONFIRM_DISABLE' }, ({ templateId }) => (
              <DialogContent className="relative">
                <DialogHeader>
                  <DialogTitle>Are you sure?</DialogTitle>

                  <DialogDescription>
                    The template will be removed from your profile
                  </DialogDescription>
                </DialogHeader>

                <DialogFooter>
                  <DialogClose asChild>
                    <Button type="button" variant="secondary">
                      Cancel
                    </Button>
                  </DialogClose>

                  <Button
                    type="button"
                    variant="destructive"
                    loading={isUpdatingTemplateSettings}
                    onClick={() => void setTemplateToPrivate(templateId)}
                  >
                    Confirm
                  </Button>
                </DialogFooter>
              </DialogContent>
            ))
            .otherwise(() => null)}
        </AnimateGenericFadeInOut>
      </fieldset>
    </Dialog>
  );
};
