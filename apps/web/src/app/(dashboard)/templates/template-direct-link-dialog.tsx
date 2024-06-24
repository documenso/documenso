import { useEffect, useMemo, useState } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { CircleDotIcon, CircleIcon, ClipboardCopyIcon, InfoIcon, LoaderIcon } from 'lucide-react';
import { P, match } from 'ts-pattern';

import { useLimits } from '@documenso/ee/server-only/limits/provider/client';
import { useCopyToClipboard } from '@documenso/lib/client-only/hooks/use-copy-to-clipboard';
import { RECIPIENT_ROLES_DESCRIPTION } from '@documenso/lib/constants/recipient-roles';
import {
  DIRECT_TEMPLATE_DOCUMENTATION,
  DIRECT_TEMPLATE_RECIPIENT_EMAIL,
} from '@documenso/lib/constants/template';
import { formatDirectTemplatePath } from '@documenso/lib/utils/templates';
import {
  type Recipient,
  RecipientRole,
  type Template,
  type TemplateDirectLink,
} from '@documenso/prisma/client';
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
    Recipient: Recipient[];
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

  const [, copy] = useCopyToClipboard();
  const router = useRouter();

  const [isEnabled, setIsEnabled] = useState(template.directLink?.enabled ?? false);
  const [token, setToken] = useState(template.directLink?.token ?? null);
  const [selectedRecipientId, setSelectedRecipientId] = useState<number | null>(null);
  const [currentStep, setCurrentStep] = useState<TemplateDirectLinkStep>(
    token ? 'MANAGE' : 'ONBOARD',
  );

  const validDirectTemplateRecipients = useMemo(
    () => template.Recipient.filter((recipient) => recipient.role !== RecipientRole.CC),
    [template.Recipient],
  );

  const {
    mutateAsync: createTemplateDirectLink,
    isLoading: isCreatingTemplateDirectLink,
    reset: resetCreateTemplateDirectLink,
  } = trpcReact.template.createTemplateDirectLink.useMutation({
    onSuccess: (data) => {
      setToken(data.token);
      setIsEnabled(data.enabled);
      setCurrentStep('MANAGE');

      router.refresh();
    },
    onError: () => {
      setSelectedRecipientId(null);

      toast({
        title: 'Something went wrong',
        description: 'Unable to create direct template access. Please try again later.',
        variant: 'destructive',
      });
    },
  });

  const { mutateAsync: toggleTemplateDirectLink, isLoading: isTogglingTemplateAccess } =
    trpcReact.template.toggleTemplateDirectLink.useMutation({
      onSuccess: (data) => {
        toast({
          title: 'Success',
          description: `Direct link signing has been ${data.enabled ? 'enabled' : 'disabled'}`,
        });
      },
      onError: (_ctx, data) => {
        toast({
          title: 'Something went wrong',
          description: `An error occurred while ${
            data.enabled ? 'enabling' : 'disabling'
          } direct link signing.`,
          variant: 'destructive',
        });
      },
    });

  const { mutateAsync: deleteTemplateDirectLink, isLoading: isDeletingTemplateDirectLink } =
    trpcReact.template.deleteTemplateDirectLink.useMutation({
      onSuccess: () => {
        onOpenChange(false);
        setToken(null);

        toast({
          title: 'Success',
          description: 'Direct template link deleted',
          duration: 5000,
        });

        router.refresh();
        setToken(null);
      },
      onError: () => {
        toast({
          title: 'Something went wrong',
          description:
            'We encountered an error while removing the direct template link. Please try again later.',
          variant: 'destructive',
        });
      },
    });

  const onCopyClick = async (token: string) =>
    copy(formatDirectTemplatePath(token)).then(() => {
      toast({
        title: 'Copied to clipboard',
        description: 'The direct link has been copied to your clipboard',
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
                  <DialogTitle>Create Direct Signing Link</DialogTitle>

                  <DialogDescription>Here's how it works:</DialogDescription>
                </DialogHeader>

                <ul className="mt-4 space-y-4 pl-12">
                  {DIRECT_TEMPLATE_DOCUMENTATION.map((step, index) => (
                    <li className="relative" key={index}>
                      <div className="absolute -left-12">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full border-[3px] border-neutral-200 text-sm font-bold">
                          {index + 1}
                        </div>
                      </div>

                      <h3 className="font-semibold">{step.title}</h3>
                      <p className="text-muted-foreground mt-1 text-sm">{step.description}</p>
                    </li>
                  ))}
                </ul>

                {remaining.directTemplates === 0 && (
                  <Alert variant="warning">
                    <AlertTitle>
                      Direct template link usage exceeded ({quota.directTemplates}/
                      {quota.directTemplates})
                    </AlertTitle>
                    <AlertDescription>
                      You have reached the maximum limit of {quota.directTemplates} direct
                      templates.{' '}
                      <Link
                        className="mt-1 block underline underline-offset-4"
                        href="/settings/billing"
                      >
                        Upgrade your account to continue!
                      </Link>
                    </AlertDescription>
                  </Alert>
                )}

                {remaining.directTemplates !== 0 && (
                  <DialogFooter className="mx-auto mt-4">
                    <Button type="button" onClick={() => setCurrentStep('SELECT_RECIPIENT')}>
                      Enable direct link signing
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
                  <DialogTitle>Choose Direct Link Recipient</DialogTitle>

                  <DialogDescription>
                    Choose an existing recipient from below to continue
                  </DialogDescription>
                </DialogHeader>

                <div className="custom-scrollbar max-h-[60vh] overflow-y-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Recipient</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {validDirectTemplateRecipients.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={3} className="h-16 text-center">
                            <p className="text-muted-foreground">No valid recipients found</p>
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
                            {RECIPIENT_ROLES_DESCRIPTION[row.role].roleName}
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
                {!template.Recipient.some(
                  (recipient) => recipient.email === DIRECT_TEMPLATE_RECIPIENT_EMAIL,
                ) && (
                  <DialogFooter className="mx-auto">
                    <div className="flex flex-col items-center justify-center">
                      {validDirectTemplateRecipients.length !== 0 && (
                        <p className="text-muted-foreground text-sm">Or</p>
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
                        Create one automatically
                      </Button>
                    </div>
                  </DialogFooter>
                )}
              </DialogContent>
            ))
            .with({ token: P.string, currentStep: 'MANAGE' }, ({ token }) => (
              <DialogContent className="relative">
                <DialogHeader>
                  <DialogTitle>Direct Link Signing</DialogTitle>

                  <DialogDescription>
                    Manage the direct link signing for this template
                  </DialogDescription>
                </DialogHeader>

                <div>
                  <div className="flex flex-row items-center justify-between">
                    <Label className="flex flex-row">
                      Enable Direct Link Signing
                      <Tooltip>
                        <TooltipTrigger tabIndex={-1} className="ml-2">
                          <InfoIcon className="h-4 w-4" />
                        </TooltipTrigger>
                        <TooltipContent className="text-foreground z-9999 max-w-md p-4">
                          Disabling direct link signing will prevent anyone from accessing the link.
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
                    <Label htmlFor="copy-direct-link">Copy Shareable Link</Label>

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
                    Remove
                  </Button>

                  <Button
                    type="button"
                    loading={isTogglingTemplateAccess}
                    onClick={async () =>
                      toggleTemplateDirectLink({
                        templateId: template.id,
                        enabled: isEnabled,
                      })
                    }
                  >
                    Save
                  </Button>
                </DialogFooter>
              </DialogContent>
            ))
            .with({ token: P.string, currentStep: 'CONFIRM_DELETE' }, () => (
              <DialogContent className="relative">
                <DialogHeader>
                  <DialogTitle>Are you sure?</DialogTitle>

                  <DialogDescription>
                    Please note that proceeding will remove direct linking recipient and turn it
                    into a placeholder.
                  </DialogDescription>
                </DialogHeader>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setCurrentStep('MANAGE')}
                  >
                    Cancel
                  </Button>

                  <Button
                    type="button"
                    variant="destructive"
                    loading={isDeletingTemplateDirectLink}
                    onClick={() => void deleteTemplateDirectLink({ templateId: template.id })}
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
