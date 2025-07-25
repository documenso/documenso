import { useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { Trans, useLingui } from '@lingui/react/macro';
import { Loader, Plus, TrashIcon } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { normalizeDomain, validateDomainFormat } from '@documenso/lib/utils/domain';
import { trpc } from '@documenso/trpc/react';
import { Alert, AlertDescription } from '@documenso/ui/primitives/alert';
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
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@documenso/ui/primitives/form/form';
import { Input } from '@documenso/ui/primitives/input';
import { useToast } from '@documenso/ui/primitives/use-toast';

const ZAddDomainFormSchema = z.object({
  domain: z
    .string()
    .min(1, 'Domain is required')
    .refine((domain) => validateDomainFormat(normalizeDomain(domain)), {
      message: 'Please enter a valid domain (e.g., example.com)',
    }),
});

type TAddDomainFormSchema = z.infer<typeof ZAddDomainFormSchema>;

interface DomainAccessSettingsFormProps {
  organisationId: string;
}

export function DomainAccessSettingsForm({ organisationId }: DomainAccessSettingsFormProps) {
  const { t } = useLingui();
  const { toast } = useToast();
  const _organisation = useCurrentOrganisation();

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [domainToDelete, setDomainToDelete] = useState<string | null>(null);

  // tRPC hooks
  const {
    data: domainsData,
    isLoading: isLoadingDomains,
    refetch: refetchDomains,
  } = trpc.organisation.domain.list.useQuery({
    organisationId,
    page: 1,
    perPage: 50,
  });

  const { mutateAsync: addDomain, isPending: isAddingDomain } =
    trpc.organisation.domain.add.useMutation();

  const { mutateAsync: removeDomain, isPending: isRemovingDomain } =
    trpc.organisation.domain.remove.useMutation();

  // Form setup
  const form = useForm<TAddDomainFormSchema>({
    resolver: zodResolver(ZAddDomainFormSchema),
    defaultValues: {
      domain: '',
    },
  });

  const onAddDomainSubmit = async (data: TAddDomainFormSchema) => {
    try {
      await addDomain({
        organisationId,
        domain: normalizeDomain(data.domain),
      });

      toast({
        title: t`Domain added successfully`,
        description: t`The domain has been added to your organisation and new users with matching email addresses will be automatically assigned.`,
      });

      form.reset();
      setIsAddDialogOpen(false);
      void refetchDomains();
    } catch (error) {
      console.error('Error adding domain:', error);
      toast({
        title: t`Failed to add domain`,
        description: t`There was an error adding the domain. Please check that the domain is valid and not already configured.`,
        variant: 'destructive',
      });
    }
  };

  const onRemoveDomain = async (domain: string) => {
    try {
      await removeDomain({
        organisationId,
        domain,
      });

      toast({
        title: t`Domain removed successfully`,
        description: t`The domain has been removed from your organisation.`,
      });

      setDomainToDelete(null);
      void refetchDomains();
    } catch (error) {
      console.error('Error removing domain:', error);
      toast({
        title: t`Failed to remove domain`,
        description: t`There was an error removing the domain. Please try again.`,
        variant: 'destructive',
      });
    } finally {
      setDomainToDelete(null);
    }
  };

  if (isLoadingDomains) {
    return (
      <div className="flex items-center justify-center rounded-lg py-8">
        <Loader className="text-muted-foreground h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Alert>
        <AlertDescription>
          <Trans>
            Configure email domains that will automatically assign new users to this organisation
            when they verify their email address. Users with matching email domains will be added as
            members with basic permissions.
          </Trans>
        </AlertDescription>
      </Alert>

      {/* Domain List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium">
            <Trans>Configured Domains</Trans>
          </h4>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                <Trans>Add Domain</Trans>
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  <Trans>Add Domain</Trans>
                </DialogTitle>
                <DialogDescription>
                  <Trans>
                    Add a domain to automatically assign new users to this organisation when they
                    verify their email address.
                  </Trans>
                </DialogDescription>
              </DialogHeader>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onAddDomainSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="domain"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          <Trans>Domain</Trans>
                        </FormLabel>
                        <FormControl>
                          <Input placeholder="example.com" {...field} disabled={isAddingDomain} />
                        </FormControl>
                        <FormDescription>
                          <Trans>Enter the domain without the @ symbol (e.g., example.com)</Trans>
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsAddDialogOpen(false)}
                      disabled={isAddingDomain}
                    >
                      <Trans>Cancel</Trans>
                    </Button>
                    <Button type="submit" disabled={isAddingDomain}>
                      {isAddingDomain && <Loader className="mr-2 h-4 w-4 animate-spin" />}
                      <Trans>Add Domain</Trans>
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        {domainsData?.domains && domainsData.domains.length > 0 ? (
          <div className="space-y-2">
            {domainsData.domains.map((domainAccess) => (
              <div
                key={domainAccess.id}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="flex flex-col">
                  <span className="font-medium">{domainAccess.domain}</span>
                  <span className="text-muted-foreground text-sm">
                    <Trans>Added on {new Date(domainAccess.createdAt).toLocaleDateString()}</Trans>
                  </span>
                </div>
                <Dialog
                  open={domainToDelete === domainAccess.domain}
                  onOpenChange={(open) => setDomainToDelete(open ? domainAccess.domain : null)}
                >
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" disabled={isRemovingDomain}>
                      <TrashIcon className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>
                        <Trans>Remove Domain</Trans>
                      </DialogTitle>
                      <DialogDescription>
                        <Trans>
                          Are you sure you want to remove "{domainAccess.domain}" from your
                          organisation? New users with this domain will no longer be automatically
                          assigned to this organisation.
                        </Trans>
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => setDomainToDelete(null)}
                        disabled={isRemovingDomain}
                      >
                        <Trans>Cancel</Trans>
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={async () => onRemoveDomain(domainAccess.domain)}
                        disabled={isRemovingDomain}
                      >
                        {isRemovingDomain && <Loader className="mr-2 h-4 w-4 animate-spin" />}
                        <Trans>Remove Domain</Trans>
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            ))}
          </div>
        ) : (
          <div className="border-muted text-muted-foreground flex h-32 items-center justify-center rounded-lg border border-dashed">
            <div className="text-center">
              <p className="text-sm">
                <Trans>No domains configured</Trans>
              </p>
              <p className="text-xs">
                <Trans>Add a domain to enable automatic user assignment</Trans>
              </p>
            </div>
          </div>
        )}
      </div>

      {domainsData?.totalCount && domainsData.totalCount > 0 && (
        <p className="text-muted-foreground text-sm">
          <Trans>Total domains: {domainsData.totalCount}</Trans>
        </p>
      )}
    </div>
  );
}
