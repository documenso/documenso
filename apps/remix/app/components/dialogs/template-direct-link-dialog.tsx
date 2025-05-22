import { useEffect, useMemo, useState } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import {
  type Recipient,
  RecipientRole,
  type Template,
  type TemplateDirectLink,
} from '@prisma/client';
import { CircleDotIcon, CircleIcon, ClipboardCopyIcon, InfoIcon, LoaderIcon } from 'lucide-react';
import { Link, useRevalidator } from 'react-router';
import { P, match } from 'ts-pattern';

import { useLimits } from '@documenso/ee/server-only/limits/provider/client';
import { useCopyToClipboard } from '@documenso/lib/client-only/hooks/use-copy-to-clipboard';
import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { DIRECT_TEMPLATE_RECIPIENT_EMAIL } from '@documenso/lib/constants/direct-templates';
import { RECIPIENT_ROLES_DESCRIPTION } from '@documenso/lib/constants/recipient-roles';
import { DIRECT_TEMPLATE_DOCUMENTATION } from '@documenso/lib/constants/template';
import { formatDirectTemplatePath } from '@documenso/lib/utils/templates';
import { trpc as trpcReact } from '@documenso/trpc/react';
import { AnimateGenericFadeInOut } from '@documenso/ui/components/animate/animate-generic-fade-in-out';
import { Alert, AlertDescription, AlertTitle } from '@documenso/ui/primitives/alert';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@documenso/ui/primitives/dialog';
import { Input } from '@documenso/ui/primitives/input';
import { Label } from '@documenso/ui/primitives/label';
import { Switch } from '@documenso/ui/primitives/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@documenso/ui/primitives/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@documenso/ui/primitives/tooltip';
import { useToast } from '@documenso/ui/primitives/use-toast';

type TemplateDirectLinkDialogProps = {
  template: Template & {
    directLink?: Pick<TemplateDirectLink, 'token' | 'enabled'> | null;
    recipients: Recipient[];
  };
  open: boolean;
  onOpenChange: (_open: boolean) => void;
};

type TemplateDirectLinkStep = 'ONBOARD' | 'SELECT_RECIPIENT' | 'MANAGE' | 'CONFIRM_DELETE';

export const TemplateDirectLinkDialog = ({
  template,
  open,
  onOpenChange,
}: TemplateDirectLinkDialogProps) => {
  const { toast } = useToast();
  const { quota, remaining } = useLimits();
  const { _ } = useLingui();
  const { revalidate } = useRevalidator();

  const [, copy] = useCopyToClipboard();

  const [isEnabled, setIsEnabled] = useState(template.directLink?.enabled ?? false);
  const [token, setToken] = useState(template.directLink?.token ?? null);
  const [selectedRecipientId, setSelectedRecipientId] = useState<number | null>(null);
  const [currentStep, setCurrentStep] = useState<TemplateDirectLinkStep>(
    token ? 'MANAGE' : 'ONBOARD',
  );

  const organisation = useCurrentOrganisation();

  const validDirectTemplateRecipients = useMemo(
    () =>
      template.recipients.filter(
        (recipient) =>
          recipient.role !== RecipientRole.CC && recipient.role !== RecipientRole.ASSISTANT,
      ),
    [template.recipients],
  );

  const {
    mutateAsync: createTemplateDirectLink,
    isPending: isCreatingTemplateDirectLink,
    reset: resetCreateTemplateDirectLink,
  } = trpcReact.template.createTemplateDirectLink.useMutation({
    onSuccess: async (data) => {
      await revalidate();

      setToken(data.token);
      setIsEnabled(data.enabled);
      setCurrentStep('MANAGE');
    },
    onError: () => {
      setSelectedRecipientId(null);

      toast({
        title: _(msg`Something went wrong`),
        description: _(msg`Unable to create direct template access. Please try again later.`),
        variant: 'destructive',
      });
    },
  });

  const { mutateAsync: toggleTemplateDirectLink, isPending: isTogglingTemplateAccess } =
    trpcReact.template.toggleTemplateDirectLink.useMutation({
      onSuccess: async (data) => {
        await revalidate();

        const enabledDescription = msg`Direct link signing has been enabled`;
        const disabledDescription = msg`Direct link signing has been disabled`;

        toast({
          title: _(msg`Success`),
          description: _(data.enabled ? enabledDescription : disabledDescription),
        });
      },
      onError: (_ctx, data) => {
        const enabledDescription = msg`An error occurred while enabling direct link signing.`;
        const disabledDescription = msg`An error occurred while disabling direct link signing.`;

        toast({
          title: _(msg`Something went wrong`),
          description: _(data.enabled ? enabledDescription : disabledDescription),
          variant: 'destructive',
        });
      },
    });

  const { mutateAsync: deleteTemplateDirectLink, isPending: isDeletingTemplateDirectLink } =
    trpcReact.template.deleteTemplateDirectLink.useMutation({
      onSuccess: async () => {
        await revalidate();

        onOpenChange(false);
        setToken(null);

        toast({
          title: _(msg`Success`),
          description: _(msg`Direct template link deleted`),
          duration: 5000,
        });

        setToken(null);
      },
      onError: () => {
        toast({
          title: _(msg`Something went wrong`),
          description: _(
            msg`We encountered an error while removing the direct template link. Please try again later.`,
          ),
          variant: 'destructive',
        });
      },
    });

  const onCopyClick = async (token: string) =>
    copy(formatDirectTemplatePath(token)).then(() => {
      toast({
        title: _(msg`Copied to clipboard`),
        description: _(msg`The direct link has been copied to your clipboard`),
      });
    });

  const onRecipientTableRowClick = async (recipientId: number) => {
    if (isLoading) {
      return;
    }

    setSelectedRecipientId(recipientId);

    await createTemplateDirectLink({
      templateId: template.id,
      directRecipientId: recipientId,
    });
  };

  const isLoading =
    isCreatingTemplateDirectLink || isTogglingTemplateAccess || isDeletingTemplateDirectLink;

  useEffect(() => {
    resetCreateTemplateDirectLink();
    setCurrentStep(token ? 'MANAGE' : 'ONBOARD');
    setSelectedRecipientId(null);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(value) => !isLoading && onOpenChange(value)}>
      <fieldset disabled={isLoading} className="relative">
        <AnimateGenericFadeInOut motionKey={currentStep}>
          {match({ token, currentStep })
            .with({ token: P.nullish, currentStep: 'ONBOARD' }, () => (
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    <Trans>Create Direct Signing Link</Trans>
                  </DialogTitle>

                  <DialogDescription>
                    <Trans>Here's how it works:</Trans>
                  </DialogDescription>
                </DialogHeader>

                <ul className="mt-4 space-y-4 pl-12">
                  {DIRECT_TEMPLATE_DOCUMENTATION.map((step, index) => (
                    <li className="relative" key={index}>
                      <div className="absolute -left-12">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full border-[3px] border-neutral-200 text-sm font-bold">
                          {index + 1}
                        </div>
                      </div>

                      <h3 className="font-semibold">{_(step.title)}</h3>
                      <p className="text-muted-foreground mt-1 text-sm">{_(step.description)}</p>
                    </li>
                  ))}
                </ul>

                {remaining.directTemplates === 0 && (
                  <Alert variant="warning">
                    <AlertTitle>
                      <Trans>
                        Direct template link usage exceeded ({quota.directTemplates}/
                        {quota.directTemplates})
                      </Trans>
                    </AlertTitle>
                    <AlertDescription>
                      <Trans>
                        You have reached the maximum limit of {quota.directTemplates} direct
                        templates.{' '}
                        <Link
                          className="mt-1 block underline underline-offset-4"
                          to={`/org/${organisation.url}/settings/billing`}
                        >
                          Upgrade your account to continue!
                        </Link>
                      </Trans>
                    </AlertDescription>
                  </Alert>
                )}

                {remaining.directTemplates !== 0 && (
                  <DialogFooter className="mx-auto mt-4">
                    <Button type="button" onClick={() => setCurrentStep('SELECT_RECIPIENT')}>
                      <Trans> Enable direct link signing</Trans>
                    </Button>
                  </DialogFooter>
                )}
              </DialogContent>
            ))
            .with({ token: P.nullish, currentStep: 'SELECT_RECIPIENT' }, () => (
              <DialogContent className="relative">
                {isCreatingTemplateDirectLink && validDirectTemplateRecipients.length !== 0 && (
                  <div className="absolute inset-0 z-50 flex items-center justify-center rounded bg-white/50 dark:bg-black/50">
                    <LoaderIcon className="h-6 w-6 animate-spin text-gray-500" />
                  </div>
                )}

                <DialogHeader>
                  <DialogTitle>
                    <Trans>Choose Direct Link Recipient</Trans>
                  </DialogTitle>

                  <DialogDescription>
                    <Trans>Choose an existing recipient from below to continue</Trans>
                  </DialogDescription>
                </DialogHeader>

                <div className="custom-scrollbar max-h-[60vh] overflow-y-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>
                          <Trans>Recipient</Trans>
                        </TableHead>
                        <TableHead>
                          <Trans>Role</Trans>
                        </TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {validDirectTemplateRecipients.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={3} className="h-16 text-center">
                            <p className="text-muted-foreground">
                              <Trans>No valid recipients found</Trans>
                            </p>
                          </TableCell>
                        </TableRow>
                      )}

                      {validDirectTemplateRecipients.map((row) => (
                        <TableRow
                          className="cursor-pointer"
                          key={row.id}
                          onClick={async () => onRecipientTableRowClick(row.id)}
                        >
                          <TableCell>
                            <div className="text-muted-foreground text-sm">
                              <p>{row.name}</p>
                              <p className="text-muted-foreground/70 text-xs">{row.email}</p>
                            </div>
                          </TableCell>

                          <TableCell className="text-muted-foreground text-sm">
                            {_(RECIPIENT_ROLES_DESCRIPTION[row.role].roleName)}
                          </TableCell>

                          <TableCell>
                            {selectedRecipientId === row.id ? (
                              <CircleDotIcon className="h-5 w-5 text-neutral-300" />
                            ) : (
                              <CircleIcon className="h-5 w-5 text-neutral-300" />
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Prevent creating placeholder direct template recipient if the email already exists. */}
                {!template.recipients.some(
                  (recipient) => recipient.email === DIRECT_TEMPLATE_RECIPIENT_EMAIL,
                ) && (
                  <DialogFooter className="mx-auto">
                    <div className="flex flex-col items-center justify-center">
                      {validDirectTemplateRecipients.length !== 0 && (
                        <p className="text-muted-foreground text-sm">
                          <Trans>Or</Trans>
                        </p>
                      )}

                      <Button
                        type="button"
                        className="mt-2"
                        loading={isCreatingTemplateDirectLink && !selectedRecipientId}
                        onClick={async () =>
                          createTemplateDirectLink({
                            templateId: template.id,
                          })
                        }
                      >
                        <Trans>Create one automatically</Trans>
                      </Button>
                    </div>
                  </DialogFooter>
                )}
              </DialogContent>
            ))
            .with({ token: P.string, currentStep: 'MANAGE' }, ({ token }) => (
              <DialogContent className="relative">
                <DialogHeader>
                  <DialogTitle>
                    <Trans>Direct Link Signing</Trans>
                  </DialogTitle>

                  <DialogDescription>
                    <Trans>Manage the direct link signing for this template</Trans>
                  </DialogDescription>
                </DialogHeader>

                <div>
                  <div className="flex flex-row items-center justify-between">
                    <Label className="flex flex-row">
                      <Trans>Enable Direct Link Signing</Trans>
                      <Tooltip>
                        <TooltipTrigger tabIndex={-1} className="ml-2">
                          <InfoIcon className="h-4 w-4" />
                        </TooltipTrigger>
                        <TooltipContent className="text-foreground z-9999 max-w-md p-4">
                          <Trans>
                            Disabling direct link signing will prevent anyone from accessing the
                            link.
                          </Trans>
                        </TooltipContent>
                      </Tooltip>
                    </Label>

                    <Switch
                      className="mt-2"
                      checked={isEnabled}
                      onCheckedChange={(value) => setIsEnabled(value)}
                    />
                  </div>

                  <div className="mt-2">
                    <Label htmlFor="copy-direct-link">
                      <Trans>Copy Shareable Link</Trans>
                    </Label>

                    <div className="relative mt-1">
                      <Input
                        id="copy-direct-link"
                        disabled
                        value={formatDirectTemplatePath(token).replace(/https?:\/\//, '')}
                        readOnly
                        className="pr-12"
                      />

                      <div className="absolute bottom-0 right-1 top-0 flex items-center justify-center">
                        <Button
                          variant="none"
                          type="button"
                          className="h-8 w-8"
                          onClick={() => void onCopyClick(token)}
                        >
                          <ClipboardCopyIcon className="h-4 w-4 flex-shrink-0" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                <DialogFooter className="mt-4">
                  <Button
                    type="button"
                    variant="destructive"
                    className="mr-auto w-full sm:w-auto"
                    loading={isDeletingTemplateDirectLink}
                    onClick={() => setCurrentStep('CONFIRM_DELETE')}
                  >
                    <Trans>Remove</Trans>
                  </Button>

                  <Button
                    type="button"
                    loading={isTogglingTemplateAccess}
                    onClick={async () => {
                      await toggleTemplateDirectLink({
                        templateId: template.id,
                        enabled: isEnabled,
                      }).catch(() => null);

                      onOpenChange(false);
                    }}
                  >
                    <Trans>Save</Trans>
                  </Button>
                </DialogFooter>
              </DialogContent>
            ))
            .with({ token: P.string, currentStep: 'CONFIRM_DELETE' }, () => (
              <DialogContent className="relative">
                <DialogHeader>
                  <DialogTitle>
                    <Trans>Are you sure?</Trans>
                  </DialogTitle>

                  <DialogDescription>
                    <Trans>
                      Please note that proceeding will remove direct linking recipient and turn it
                      into a placeholder.
                    </Trans>
                  </DialogDescription>
                </DialogHeader>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setCurrentStep('MANAGE')}
                  >
                    <Trans>Cancel</Trans>
                  </Button>

                  <Button
                    type="button"
                    variant="destructive"
                    loading={isDeletingTemplateDirectLink}
                    onClick={() => void deleteTemplateDirectLink({ templateId: template.id })}
                  >
                    <Trans>Confirm</Trans>
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
