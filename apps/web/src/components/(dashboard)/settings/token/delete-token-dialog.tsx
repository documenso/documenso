'use client';

import { useEffect, useState } from 'react';

import { useRouter } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import type { ApiToken } from '@documenso/prisma/client';
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
import { useToast } from '@documenso/ui/primitives/use-toast';

export type DeleteTokenDialogProps = {
  teamId?: number;
  token: Pick<ApiToken, 'id' | 'name'>;
  onDelete?: () => void;
  children?: React.ReactNode;
};

export default function DeleteTokenDialog({
  teamId,
  token,
  onDelete,
  children,
}: DeleteTokenDialogProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [isOpen, setIsOpen] = useState(false);

  const deleteMessage = `წაშალეთ ${token.name}`;

  const ZDeleteTokenDialogSchema = z.object({
    tokenName: z.literal(deleteMessage, {
      errorMap: () => ({ message: `გაგრძელებისთვის თქვენ უნდა ჩაწეროთ '${deleteMessage}'` }),
    }),
  });

  type TDeleteTokenByIdMutationSchema = z.infer<typeof ZDeleteTokenDialogSchema>;

  const { mutateAsync: deleteTokenMutation } = trpc.apiToken.deleteTokenById.useMutation({
    onSuccess() {
      onDelete?.();
    },
  });

  const form = useForm<TDeleteTokenByIdMutationSchema>({
    resolver: zodResolver(ZDeleteTokenDialogSchema),
    values: {
      tokenName: '',
    },
  });

  const onSubmit = async () => {
    try {
      await deleteTokenMutation({
        id: token.id,
        teamId,
      });

      toast({
        title: 'ტოკენი წაშლილია',
        description: 'ტოკენი წარმატებით წაიშალა!',
        duration: 5000,
      });

      setIsOpen(false);

      router.refresh();
    } catch (error) {
      toast({
        title: 'დაფიქსირდა ხარვეზი',
        variant: 'destructive',
        duration: 5000,
        description: 'ტოკენის წაშლისას დაფიქსირდა ხარვეზი. გთხოვთ თავიდან სცადოთ.',
      });
    }
  };

  useEffect(() => {
    if (!isOpen) {
      form.reset();
    }
  }, [isOpen, form]);

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(value) => !form.formState.isSubmitting && setIsOpen(value)}
    >
      <DialogTrigger asChild={true}>
        {children ?? (
          <Button className="mr-4" variant="destructive">
            წაშლა
          </Button>
        )}
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>ნამდვილად გნებავთ ტოკენის წაშლა?</DialogTitle>

          <DialogDescription>
            გთხოვთ გაითვალისწინოთ, რომ ეს ქმედება შეუქცევადია. დადასტურების შემდეგ, თქვენი ტოკენი
            სამუდამოდ წაიშლება.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <fieldset
              className="flex h-full flex-col space-y-4"
              disabled={form.formState.isSubmitting}
            >
              <FormField
                control={form.control}
                name="tokenName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      დადასტურებისთის ჩაწერეთ:{' '}
                      <span className="font-sm text-destructive font-semibold">
                        {deleteMessage}
                      </span>
                    </FormLabel>

                    <FormControl>
                      <Input className="bg-background" type="text" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <div className="flex w-full flex-nowrap gap-4">
                  <Button
                    type="button"
                    variant="secondary"
                    className="flex-1"
                    onClick={() => setIsOpen(false)}
                  >
                    დახურვა
                  </Button>

                  <Button
                    type="submit"
                    variant="destructive"
                    className="flex-1"
                    disabled={!form.formState.isValid}
                    loading={form.formState.isSubmitting}
                  >
                    დარწმუნებული ვარ, წაშალე!
                  </Button>
                </div>
              </DialogFooter>
            </fieldset>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
