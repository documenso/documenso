import { trpc } from '@documenso/trpc/react';
import { Button } from '@documenso/ui/primitives/button';
import { useToast } from '@documenso/ui/primitives/use-toast';
import { Trans, useLingui } from '@lingui/react/macro';
import { useRevalidator } from 'react-router';

type OrganisationUsageResetButtonProps = {
  organisationId: string;
  counter: 'document' | 'email' | 'api';
};

export const OrganisationUsageResetButton = ({ organisationId, counter }: OrganisationUsageResetButtonProps) => {
  const { t } = useLingui();
  const { toast } = useToast();
  const { revalidate } = useRevalidator();

  const { mutateAsync: reset, isPending } = trpc.admin.organisation.stats.reset.useMutation({
    onSuccess: async () => {
      toast({ title: t`Counter reset.` });
      await revalidate();
    },
    onError: () => {
      toast({ title: t`Failed to reset counter.`, variant: 'destructive' });
    },
  });

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      loading={isPending}
      onClick={() => reset({ organisationId, counter })}
    >
      <Trans>Reset</Trans>
    </Button>
  );
};
