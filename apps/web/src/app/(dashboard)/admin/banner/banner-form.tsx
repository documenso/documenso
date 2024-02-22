'use client';

import { useRouter } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { TRPCClientError } from '@documenso/trpc/client';
import { trpc as trpcReact } from '@documenso/trpc/react';
import { Button } from '@documenso/ui/primitives/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@documenso/ui/primitives/form/form';
import { Switch } from '@documenso/ui/primitives/switch';
import { Textarea } from '@documenso/ui/primitives/textarea';
import { useToast } from '@documenso/ui/primitives/use-toast';

const ZBannerSchema = z.object({
  text: z.string().optional(),
  show: z.boolean().optional(),
});

type TBannerSchema = z.infer<typeof ZBannerSchema>;

export function BannerForm({ show, text }: TBannerSchema) {
  const router = useRouter();
  const { toast } = useToast();

  const form = useForm<TBannerSchema>({
    resolver: zodResolver(ZBannerSchema),
    defaultValues: {
      show,
      text,
    },
  });

  const { mutateAsync: updateBanner, isLoading: isUpdatingBanner } =
    trpcReact.banner.updateBanner.useMutation();

  const onBannerUpdate = async ({ show, text }: TBannerSchema) => {
    try {
      await updateBanner({
        show,
        text,
      });

      toast({
        title: 'Banner Updated',
        description: 'Your banner has been updated successfully.',
        duration: 5000,
      });

      router.refresh();
    } catch (err) {
      if (err instanceof TRPCClientError && err.data?.code === 'BAD_REQUEST') {
        toast({
          title: 'An error occurred',
          description: err.message,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'An unknown error occurred',
          variant: 'destructive',
          description:
            'We encountered an unknown error while attempting to reset your password. Please try again later.',
        });
      }
    }
  };

  return (
    <Form {...form}>
      <form className="flex flex-col" onSubmit={form.handleSubmit(onBannerUpdate)}>
        <FormField
          control={form.control}
          name="show"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
              <div className="space-y-0.5">
                <FormLabel>Show Banner</FormLabel>
                <FormDescription>Show a banner to the users by the admin</FormDescription>
              </div>
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="text"
          render={({ field }) => (
            <FormItem className="mt-8">
              <FormLabel className="text-base ">Banner Text</FormLabel>
              <FormControl>
                <Textarea placeholder="Text to show to users" className="resize-none" {...field} />
              </FormControl>

              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" loading={isUpdatingBanner} className="mt-3 justify-end self-end">
          Update Banner
        </Button>
      </form>
    </Form>
  );
}
