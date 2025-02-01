import { useEffect, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { Loader } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useRevalidator } from 'react-router';
import { z } from 'zod';

import { IS_BILLING_ENABLED } from '@documenso/lib/constants/app';
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@documenso/ui/primitives/form/form';
import { Input } from '@documenso/ui/primitives/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@documenso/ui/primitives/select';
import { useToast } from '@documenso/ui/primitives/use-toast';

export type TeamTransferDialogProps = {
  teamId: number;
  teamName: string;
  ownerUserId: number;
  trigger?: React.ReactNode;
};

export const TeamTransferDialog = ({
  trigger,
  teamId,
  teamName,
  ownerUserId,
}: TeamTransferDialogProps) => {
  const [open, setOpen] = useState(false);

  const { _ } = useLingui();
  const { toast } = useToast();
  const { revalidate } = useRevalidator();

  const { mutateAsync: requestTeamOwnershipTransfer } =
    trpc.team.requestTeamOwnershipTransfer.useMutation();

  const {
    data,
    refetch: refetchTeamMembers,
    isPending: loadingTeamMembers,
    isLoadingError: loadingTeamMembersError,
  } = trpc.team.getTeamMembers.useQuery({
    teamId,
  });

  const confirmTransferMessage = _(msg`transfer ${teamName}`);

  const ZTransferTeamFormSchema = z.object({
    teamName: z.literal(confirmTransferMessage, {
      errorMap: () => ({ message: `You must enter '${confirmTransferMessage}' to proceed` }),
    }),
    newOwnerUserId: z.string(),
    clearPaymentMethods: z.boolean(),
  });

  const form = useForm<z.infer<typeof ZTransferTeamFormSchema>>({
    resolver: zodResolver(ZTransferTeamFormSchema),
    defaultValues: {
      teamName: '',
      clearPaymentMethods: false,
    },
  });

  const onFormSubmit = async ({
    newOwnerUserId,
    clearPaymentMethods,
  }: z.infer<typeof ZTransferTeamFormSchema>) => {
    try {
      await requestTeamOwnershipTransfer({
        teamId,
        newOwnerUserId: Number.parseInt(newOwnerUserId),
        clearPaymentMethods,
      });

      await revalidate();

      toast({
        title: _(msg`Success`),
        description: _(msg`An email requesting the transfer of this team has been sent.`),
        duration: 5000,
      });

      setOpen(false);
    } catch (err) {
      toast({
        title: _(msg`An unknown error occurred`),
        description: _(
          msg`We encountered an unknown error while attempting to request a transfer of this team. Please try again later.`,
        ),
        variant: 'destructive',
        duration: 10000,
      });
    }
  };

  useEffect(() => {
    if (!open) {
      form.reset();
    }
  }, [open, form]);

  useEffect(() => {
    if (open && loadingTeamMembersError) {
      void refetchTeamMembers();
    }
  }, [open, loadingTeamMembersError, refetchTeamMembers]);

  const teamMembers = data
    ? data.filter((teamMember) => teamMember.userId !== ownerUserId)
    : undefined;

  return (
    <Dialog open={open} onOpenChange={(value) => !form.formState.isSubmitting && setOpen(value)}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" className="bg-background">
            <Trans>Transfer team</Trans>
          </Button>
        )}
      </DialogTrigger>

      {teamMembers && teamMembers.length > 0 ? (
        <DialogContent position="center">
          <DialogHeader>
            <DialogTitle>
              <Trans>Transfer team</Trans>
            </DialogTitle>

            <DialogDescription className="mt-4">
              <Trans>Transfer ownership of this team to a selected team member.</Trans>
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onFormSubmit)}>
              <fieldset
                className="flex h-full flex-col space-y-4"
                disabled={form.formState.isSubmitting}
              >
                <FormField
                  control={form.control}
                  name="newOwnerUserId"
                  render={({ field }) => (
                    <FormItem className="w-full">
                      <FormLabel required>
                        <Trans>New team owner</Trans>
                      </FormLabel>
                      <FormControl>
                        <Select {...field} onValueChange={field.onChange}>
                          <SelectTrigger className="text-muted-foreground">
                            <SelectValue />
                          </SelectTrigger>

                          <SelectContent position="popper">
                            {teamMembers.map((teamMember) => (
                              <SelectItem
                                key={teamMember.userId}
                                value={teamMember.userId.toString()}
                              >
                                {teamMember.user.name} ({teamMember.user.email})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="teamName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        <Trans>
                          Confirm by typing{' '}
                          <span className="text-destructive">{confirmTransferMessage}</span>
                        </Trans>
                      </FormLabel>
                      <FormControl>
                        <Input className="bg-background" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Alert variant="neutral">
                  <AlertDescription>
                    <ul className="list-outside list-disc space-y-2 pl-4">
                      {IS_BILLING_ENABLED() && (
                        <li>
                          <Trans>
                            Any payment methods attached to this team will remain attached to this
                            team. Please contact us if you need to update this information.
                          </Trans>
                        </li>
                      )}
                      <li>
                        <Trans>
                          The selected team member will receive an email which they must accept
                          before the team is transferred
                        </Trans>
                      </li>
                    </ul>
                  </AlertDescription>
                </Alert>

                <DialogFooter>
                  <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                    <Trans>Cancel</Trans>
                  </Button>

                  <Button type="submit" variant="destructive" loading={form.formState.isSubmitting}>
                    <Trans>Request transfer</Trans>
                  </Button>
                </DialogFooter>
              </fieldset>
            </form>
          </Form>
        </DialogContent>
      ) : (
        <DialogContent
          position="center"
          className="text-muted-foreground flex items-center justify-center py-16 text-sm"
        >
          {loadingTeamMembers ? (
            <Loader className="text-muted-foreground h-6 w-6 animate-spin" />
          ) : (
            <p className="text-center text-sm">
              {loadingTeamMembersError ? (
                <Trans>An error occurred while loading team members. Please try again later.</Trans>
              ) : (
                <Trans>You must have at least one other team member to transfer ownership.</Trans>
              )}
            </p>
          )}
        </DialogContent>
      )}
    </Dialog>
  );
};
