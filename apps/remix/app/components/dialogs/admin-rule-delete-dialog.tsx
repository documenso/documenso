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
import { useToast } from '@documenso/ui/primitives/use-toast';
import { Trans, useLingui } from '@lingui/react/macro';
import { useState } from 'react';

export type AdminRuleDeleteDialogProps = {
  ruleId: string;
  ruleName: string;
  trigger?: React.ReactNode;
  onDeleted?: () => void;
};

export const AdminRuleDeleteDialog = ({ ruleId, ruleName, trigger, onDeleted }: AdminRuleDeleteDialogProps) => {
  const { t } = useLingui();
  const { toast } = useToast();

  const trpcUtils = trpc.useUtils();

  const [open, setOpen] = useState(false);

  const { mutate: deleteRule, isPending: isDeleting } = trpc.admin.rule.delete.useMutation({
    onSuccess: async () => {
      await trpcUtils.admin.rule.getMany.invalidate();

      toast({
        title: t`Rule deleted`,
        description: t`"${ruleName}" has been removed.`,
        duration: 5000,
      });

      setOpen(false);
      onDeleted?.();
    },
    onError: () => {
      toast({
        title: t`Something went wrong`,
        description: t`We were unable to delete the rule. Please try again.`,
        variant: 'destructive',
        duration: 10000,
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={(value) => !isDeleting && setOpen(value)}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="destructive">
            <Trans>Delete</Trans>
          </Button>
        )}
      </DialogTrigger>

      <DialogContent position="center">
        <DialogHeader>
          <DialogTitle>
            <Trans>Are you sure?</Trans>
          </DialogTitle>

          <DialogDescription className="mt-4">
            <Trans>You are about to delete the following rule. Its match history will also be removed.</Trans>
          </DialogDescription>
        </DialogHeader>

        <Alert variant="neutral">
          <AlertDescription className="truncate text-center font-semibold" title={ruleName}>
            {ruleName}
          </AlertDescription>
        </Alert>

        <fieldset disabled={isDeleting}>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              <Trans>Cancel</Trans>
            </Button>

            <Button type="button" variant="destructive" loading={isDeleting} onClick={() => deleteRule({ ruleId })}>
              <Trans>Delete</Trans>
            </Button>
          </DialogFooter>
        </fieldset>
      </DialogContent>
    </Dialog>
  );
};
