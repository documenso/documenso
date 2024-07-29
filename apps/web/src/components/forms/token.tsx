'use client';

import { useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';
import { AnimatePresence, motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { useCopyToClipboard } from '@documenso/lib/client-only/hooks/use-copy-to-clipboard';
import type { ApiToken } from '@documenso/prisma/client';
import { TRPCClientError } from '@documenso/trpc/client';
import { trpc } from '@documenso/trpc/react';
import type { TCreateTokenMutationSchema } from '@documenso/trpc/server/api-token-router/schema';
import { ZCreateTokenMutationSchema } from '@documenso/trpc/server/api-token-router/schema';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import { Card, CardContent } from '@documenso/ui/primitives/card';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@documenso/ui/primitives/select';
import { Switch } from '@documenso/ui/primitives/switch';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { EXPIRATION_DATES } from '../(dashboard)/settings/token/contants';

const ZCreateTokenFormSchema = ZCreateTokenMutationSchema.extend({
  enabled: z.boolean(),
});

type TCreateTokenFormSchema = z.infer<typeof ZCreateTokenFormSchema>;

type NewlyCreatedToken = {
  id: number;
  token: string;
};

export type ApiTokenFormProps = {
  className?: string;
  teamId?: number;
  tokens?: Pick<ApiToken, 'id'>[];
};

export const ApiTokenForm = ({ className, teamId, tokens }: ApiTokenFormProps) => {
  const router = useRouter();
  const [isTransitionPending, startTransition] = useTransition();

  const [, copy] = useCopyToClipboard();
  const { toast } = useToast();

  const [newlyCreatedToken, setNewlyCreatedToken] = useState<NewlyCreatedToken | null>();
  const [noExpirationDate, setNoExpirationDate] = useState(false);

  // This lets us hide the token from being copied if it has been deleted without
  // resorting to a useEffect or any other fanciness. This comes at the cost of it
  // taking slighly longer to appear since it will need to wait for the router.refresh()
  // to finish updating.
  const hasNewlyCreatedToken =
    tokens?.find((token) => token.id === newlyCreatedToken?.id) !== undefined;

  const { mutateAsync: createTokenMutation } = trpc.apiToken.createToken.useMutation({
    onSuccess(data) {
      setNewlyCreatedToken(data);
    },
  });

  const form = useForm<TCreateTokenFormSchema>({
    resolver: zodResolver(ZCreateTokenFormSchema),
    defaultValues: {
      tokenName: '',
      expirationDate: '',
      enabled: false,
    },
  });

  const copyToken = async (token: string) => {
    try {
      const copied = await copy(token);

      if (!copied) {
        throw new Error('Unable to copy the token');
      }

      toast({
        title: 'Token copied to clipboard',
        description: 'The token was copied to your clipboard.',
      });
    } catch (error) {
      toast({
        title: 'Unable to copy token',
        description: 'We were unable to copy the token to your clipboard. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const onSubmit = async ({ tokenName, expirationDate }: TCreateTokenMutationSchema) => {
    try {
      await createTokenMutation({
        teamId,
        tokenName,
        expirationDate: noExpirationDate ? null : expirationDate,
      });

      toast({
        title: 'Token created',
        description: 'A new token was created successfully.',
        duration: 5000,
      });

      form.reset();

      startTransition(() => router.refresh());
    } catch (error) {
      if (error instanceof TRPCClientError && error.data?.code === 'BAD_REQUEST') {
        toast({
          title: 'An error occurred',
          description: error.message,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'An unknown error occurred',
          variant: 'destructive',
          duration: 5000,
          description:
            'We encountered an unknown error while attempting create the new token. Please try again later.',
        });
      }
    }
  };

  return (
    <div className={cn(className)}>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <fieldset className="mt-6 flex w-full flex-col gap-4">
            <FormField
              control={form.control}
              name="tokenName"
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormLabel className="text-muted-foreground">Token name</FormLabel>

                  <div className="flex items-center gap-x-4">
                    <FormControl className="flex-1">
                      <Input type="text" {...field} />
                    </FormControl>
                  </div>

                  <FormDescription className="text-xs italic">
                    Please enter a meaningful name for your token. This will help you identify it
                    later.
                  </FormDescription>

                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex flex-col gap-4 md:flex-row">
              <FormField
                control={form.control}
                name="expirationDate"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel className="text-muted-foreground">Token expiration date</FormLabel>

                    <div className="flex items-center gap-x-4">
                      <FormControl className="flex-1">
                        <Select onValueChange={field.onChange} disabled={noExpirationDate}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Choose..." />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(EXPIRATION_DATES).map(([key, date]) => (
                              <SelectItem key={key} value={key}>
                                {date}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                    </div>

                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="enabled"
                render={({ field }) => (
                  <FormItem className="">
                    <FormLabel className="text-muted-foreground mt-2">Never expire</FormLabel>
                    <FormControl>
                      <div className="block md:py-1.5">
                        <Switch
                          className="bg-background"
                          checked={field.value}
                          onCheckedChange={(val) => {
                            setNoExpirationDate((prev) => !prev);
                            field.onChange(val);
                          }}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Button
              type="submit"
              className="hidden md:inline-flex"
              disabled={!form.formState.isDirty}
              loading={form.formState.isSubmitting || isTransitionPending}
            >
              Create token
            </Button>

            <div className="md:hidden">
              <Button
                type="submit"
                disabled={!form.formState.isDirty}
                loading={form.formState.isSubmitting || isTransitionPending}
              >
                Create token
              </Button>
            </div>
          </fieldset>
        </form>
      </Form>

      <AnimatePresence initial={!hasNewlyCreatedToken}>
        {newlyCreatedToken && hasNewlyCreatedToken && (
          <motion.div
            className="mt-8"
            initial={{ opacity: 0, y: -40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
          >
            <Card gradient>
              <CardContent className="p-4">
                <p className="text-muted-foreground mt-2 text-sm">
                  Your token was created successfully! Make sure to copy it because you won't be
                  able to see it again!
                </p>

                <p className="bg-muted-foreground/10 my-4 rounded-md px-2.5 py-1 font-mono text-sm">
                  {newlyCreatedToken.token}
                </p>

                <Button variant="outline" onClick={() => void copyToken(newlyCreatedToken.token)}>
                  Copy token
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
