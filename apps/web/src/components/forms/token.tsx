'use client';

import { useState } from 'react';

import { useRouter } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader } from 'lucide-react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

import { useCopyToClipboard } from '@documenso/lib/client-only/hooks/use-copy-to-clipboard';
import { TRPCClientError } from '@documenso/trpc/client';
import { trpc } from '@documenso/trpc/react';
import { ZCreateTokenMutationSchema } from '@documenso/trpc/server/api-token-router/schema';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
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

import DeleteTokenDialog from '~/components/(dashboard)/settings/token/delete-token-dialog';

export type ApiTokenFormProps = {
  className?: string;
};

type TCreateTokenMutationSchema = z.infer<typeof ZCreateTokenMutationSchema>;

export const ApiTokenForm = ({ className }: ApiTokenFormProps) => {
  const router = useRouter();
  const [, copy] = useCopyToClipboard();
  const { toast } = useToast();
  const [newlyCreatedToken, setNewlyCreatedToken] = useState({ id: 0, token: '' });
  const [showNewToken, setShowNewToken] = useState(false);

  const { data: tokens, isLoading: isTokensLoading } = trpc.apiToken.getTokens.useQuery();
  const { mutateAsync: createTokenMutation } = trpc.apiToken.createToken.useMutation({
    onSuccess(data) {
      setNewlyCreatedToken({ id: data.id, token: data.token });
    },
  });

  const form = useForm<TCreateTokenMutationSchema>({
    resolver: zodResolver(ZCreateTokenMutationSchema),
    values: {
      tokenName: '',
    },
  });

  const onDelete = (tokenId: number) => {
    if (tokenId === newlyCreatedToken.id) {
      setShowNewToken((prev) => !prev);
    }
  };

  const copyToken = (token: string) => {
    void copy(token).then(() => {
      toast({
        title: 'Token copied to clipboard',
        description: 'The token was copied to your clipboard.',
      });
    });
  };

  const onSubmit = async ({ tokenName }: TCreateTokenMutationSchema) => {
    try {
      await createTokenMutation({
        tokenName,
      });

      toast({
        title: 'Token created',
        description: 'A new token was created successfully.',
        duration: 5000,
      });

      setShowNewToken(true);
      form.reset();
      router.refresh();
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
      <h2 className="mt-6 text-xl">Your existing tokens</h2>
      {!tokens && isTokensLoading ? (
        <div className="absolute inset-0 flex items-center justify-center bg-white/50">
          <Loader className="h-8 w-8 animate-spin text-gray-500" />
        </div>
      ) : (
        <ul className="mb-4 flex flex-col gap-2">
          {tokens?.map((token) => (
            <li
              className="border-muted mb-4 mt-4 break-words rounded-sm border-2 p-4"
              key={token.id}
            >
              <div>
                <p className="mb-4">
                  {token.name} <span className="text-sm italic">({token.algorithm})</span>
                </p>
                <p className="text-sm">
                  Created:{' '}
                  {token.createdAt
                    ? new Date(token.createdAt).toLocaleDateString(undefined, {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })
                    : 'N/A'}
                </p>
                <p className="mb-4 text-sm">
                  Expires:{' '}
                  {token.expires
                    ? new Date(token.expires).toLocaleDateString(undefined, {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })
                    : 'N/A'}
                </p>
                <DeleteTokenDialog
                  tokenId={token.id}
                  tokenName={token.name}
                  onDelete={() => onDelete(token.id)}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
      {newlyCreatedToken.token && showNewToken && (
        <div className="border-primary mb-8 break-words rounded-sm border p-4">
          <p className="text-muted-foreground mt-2 text-sm italic">
            Your token was created successfully! Make sure to copy it because you won't be able to
            see it again!
          </p>
          <p className="mb-4 mt-4 font-mono text-sm font-light">{newlyCreatedToken.token}</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => copyToken(newlyCreatedToken.token)}
          >
            Copy token
          </Button>
        </div>
      )}
      <h2 className="text-xl">Create a new token</h2>
      <p className="text-muted-foreground mt-2 text-sm italic">
        Enter a representative name for your new token.
      </p>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <fieldset className="mt-6 flex w-full flex-col gap-y-4">
            <FormField
              control={form.control}
              name="tokenName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-muted-foreground">Token Name</FormLabel>
                  <FormControl>
                    <Input type="text" {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="mt-4">
              <Button
                type="submit"
                disabled={!form.formState.isDirty}
                loading={form.formState.isSubmitting}
              >
                Create token
              </Button>
            </div>
          </fieldset>
        </form>
      </Form>
    </div>
  );
};
