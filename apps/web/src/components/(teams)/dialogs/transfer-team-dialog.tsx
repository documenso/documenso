'use client';

import { useEffect, useState } from 'react';

import { useRouter } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { trpc } from '@documenso/trpc/react';
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

export type TransferTeamDialogProps = {
  teamId: number;
  teamName: string;
  ownerUserId: number;
  trigger?: React.ReactNode;
};

export default function TransferTeamDialog({
  trigger,
  teamId,
  teamName,
  ownerUserId,
}: TransferTeamDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const { toast } = useToast();

  const { mutateAsync: requestTeamOwnershipTransfer } =
    trpc.team.requestTeamOwnershipTransfer.useMutation();

  const {
    data,
    refetch: refetchTeamMembers,
    isLoading: loadingTeamMembers,
    isLoadingError: loadingTeamMembersError,
  } = trpc.team.getTeamMembers.useQuery({
    teamId,
  });

  const confirmTransferMessage = `transfer ${teamName}`;

  const ZDeleteTeamFormSchema = z.object({
    teamName: z.literal(confirmTransferMessage, {
      errorMap: () => ({ message: `You must enter '${confirmTransferMessage}' to proceed` }),
    }),
    newOwnerUserId: z.string(),
  });

  const form = useForm<z.infer<typeof ZDeleteTeamFormSchema>>({
    resolver: zodResolver(ZDeleteTeamFormSchema),
    defaultValues: {
      teamName: '',
    },
  });

  const onFormSubmit = async ({ newOwnerUserId }: z.infer<typeof ZDeleteTeamFormSchema>) => {
    try {
      await requestTeamOwnershipTransfer({
        teamId,
        newOwnerUserId: Number.parseInt(newOwnerUserId),
      });

      router.refresh();

      toast({
        title: 'Success',
        description: 'An email requesting the transfer of this team has been sent.',
        duration: 5000,
      });

      setOpen(false);
    } catch (err) {
      toast({
        title: 'An unknown error occurred',
        variant: 'destructive',
        duration: 10000,
        description:
          'We encountered an unknown error while attempting to request a transfer of this team. Please try again later.',
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
            Transfer team
          </Button>
        )}
      </DialogTrigger>

      {teamMembers && teamMembers.length > 0 ? (
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer team</DialogTitle>

            <DialogDescription className="mt-4">
              Transfer ownership of this team to a selected team member.
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
                      <FormLabel required>New team owner</FormLabel>
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
                                {teamMember.user.name}
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
                        Confirm by typing{' '}
                        <span className="text-destructive">{confirmTransferMessage}</span>
                      </FormLabel>
                      <FormControl>
                        <Input className="bg-background" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="rounded-lg bg-gray-50/70 p-4">
                  <p className="text-muted-foreground text-sm">
                    The selected team member will receive an email which they must accept before the
                    team is transferred.
                  </p>
                </div>

                <DialogFooter className="space-x-4">
                  <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>

                  <Button type="submit" variant="destructive" loading={form.formState.isSubmitting}>
                    Transfer
                  </Button>
                </DialogFooter>
              </fieldset>
            </form>
          </Form>
        </DialogContent>
      ) : (
        <DialogContent className="text-muted-foreground flex items-center justify-center py-16 text-sm">
          {loadingTeamMembers ? (
            <Loader className="text-muted-foreground h-6 w-6 animate-spin" />
          ) : (
            <p className="text-center text-sm">
              {loadingTeamMembersError
                ? 'An error occurred while loading team members. Please try again later.'
                : 'You must have at least one other team member to transfer ownership.'}
            </p>
          )}
        </DialogContent>
      )}
    </Dialog>
  );
}
