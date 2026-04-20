import { useEffect, useMemo, useState } from 'react';

import { useLingui } from '@lingui/react/macro';
import { Trans } from '@lingui/react/macro';

import { AppError } from '@documenso/lib/errors/app-error';
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
} from '@documenso/ui/primitives/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@documenso/ui/primitives/select';
import { useToast } from '@documenso/ui/primitives/use-toast';

export type AdminSwapSubscriptionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceOrganisationId: string;
  sourceOrganisationName: string;
  userId: number;
};

export const AdminSwapSubscriptionDialog = ({
  open,
  onOpenChange,
  sourceOrganisationId,
  sourceOrganisationName,
  userId,
}: AdminSwapSubscriptionDialogProps) => {
  const { t } = useLingui();
  const { toast } = useToast();

  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: orgsData } = trpc.admin.organisation.find.useQuery(
    {
      ownerUserId: userId,
      perPage: 100,
    },
    {
      enabled: open,
    },
  );

  const trpcUtils = trpc.useUtils();

  const eligibleOrgs = useMemo(() => {
    if (!orgsData?.data) {
      return [];
    }

    return orgsData.data.filter((org) => {
      if (org.id === sourceOrganisationId) {
        return false;
      }

      const hasActiveSubscription =
        org.subscription &&
        (org.subscription.status === 'ACTIVE' || org.subscription.status === 'PAST_DUE');

      return !hasActiveSubscription;
    });
  }, [orgsData, sourceOrganisationId]);

  const selectedOrg = eligibleOrgs.find((org) => org.id === selectedOrgId);

  const { mutateAsync: swapSubscription } = trpc.admin.organisation.swapSubscription.useMutation();

  const onSubmit = async () => {
    if (!selectedOrgId) {
      return;
    }

    setIsSubmitting(true);

    try {
      await swapSubscription({
        sourceOrganisationId,
        targetOrganisationId: selectedOrgId,
      });

      await trpcUtils.admin.organisation.find.invalidate();
      await trpcUtils.admin.organisation.get.invalidate();

      onOpenChange(false);

      toast({
        title: t`Success`,
        description: t`Subscription moved successfully`,
        duration: 5000,
      });
    } catch (err) {
      const error = AppError.parseError(err);

      console.error(error);

      toast({
        title: t`Error`,
        description: t`Failed to move subscription. Please try again.`,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (!open) {
      setSelectedOrgId('');
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(value) => !isSubmitting && onOpenChange(value)}>
      <DialogContent position="center">
        <DialogHeader>
          <DialogTitle>
            <Trans>Move Subscription</Trans>
          </DialogTitle>

          <DialogDescription>
            <Trans>
              Move the subscription from "{sourceOrganisationName}" to another organisation owned by
              this user.
            </Trans>
          </DialogDescription>
        </DialogHeader>

        <fieldset className="flex flex-col space-y-4" disabled={isSubmitting}>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">
              <Trans>Target Organisation</Trans>
            </label>

            <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
              <SelectTrigger>
                <SelectValue placeholder={t`Select an organisation`} />
              </SelectTrigger>
              <SelectContent>
                {eligibleOrgs.map((org) => (
                  <SelectItem key={org.id} value={org.id}>
                    {org.name} ({org.url})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {eligibleOrgs.length === 0 && orgsData && (
              <p className="text-sm text-muted-foreground">
                <Trans>No eligible organisations found. The target must be on the free plan.</Trans>
              </p>
            )}
          </div>

          {selectedOrg && (
            <Alert variant="warning">
              <AlertDescription className="mt-0">
                <Trans>
                  This will move the subscription from "{sourceOrganisationName}" to "
                  {selectedOrg.name}". The source organisation will be reset to the free plan.
                </Trans>
              </AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              <Trans>Cancel</Trans>
            </Button>

            <Button
              type="button"
              onClick={onSubmit}
              disabled={!selectedOrgId}
              loading={isSubmitting}
            >
              <Trans>Move Subscription</Trans>
            </Button>
          </DialogFooter>
        </fieldset>
      </DialogContent>
    </Dialog>
  );
};
