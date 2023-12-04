'use client';

import { useState } from 'react';

import { useRouter } from 'next/navigation';

import { trpc } from '@documenso/trpc/react';
import { Button } from '@documenso/ui/primitives/button';
import { useToast } from '@documenso/ui/primitives/use-toast';

type SemanticSearchProps = {
  semSearchEnabled: boolean;
};

export const SemanticSearchApp = ({ semSearchEnabled }: SemanticSearchProps) => {
  const [semState, setSemState] = useState<'enabled' | 'disabled'>(
    semSearchEnabled ? 'enabled' : 'disabled',
  );
  const router = useRouter();
  const { toast } = useToast();
  const { mutateAsync: enableSemSearch } = trpc.semSearch.enable.useMutation();
  const { mutateAsync: disableSemSearch } = trpc.semSearch.disable.useMutation();

  const onClickToggleSemSearch = async () => {
    if (semState === 'disabled') {
      console.log('Enable Semantic Search');
      setSemState('enabled');
      try {
        await enableSemSearch();

        toast({
          title: 'Semantic search enabled',
          description:
            'Semantic search has been enabled for your account. You will now be able to perform semantic search.',
        });

        router.refresh();
      } catch (_err) {
        toast({
          title: 'Unable to enable semantic search',
          description:
            'We were unable to enable semantic search for your account. Please try again.',
          variant: 'destructive',
        });
      }
    } else {
      console.log('Disable Semantic Search');
      setSemState('disabled');
      try {
        await disableSemSearch();

        toast({
          title: 'Semantic search disabled',
          description:
            'Semantic search has been disabled for your account. You will now default to keyword search.',
        });

        router.refresh();
      } catch (_err) {
        toast({
          title: 'Unable to disable semantic search.',
          description:
            'We were unable to disable semantic search for your account. Please try again.',
          variant: 'destructive',
        });
      }
    }
  };

  return (
    <>
      <div className="mt-4 flex flex-col justify-between gap-4 rounded-lg border p-4 md:flex-row md:items-center md:gap-8">
        <div className="flex-1">
          <p>Semantic Search</p>

          <p className="text-muted-foreground mt-2 max-w-[50ch] text-sm">
            Search through your documents semantically rather than using keywords.
          </p>
        </div>

        <div>
          {semSearchEnabled ? (
            <Button
              variant="destructive"
              onClick={() => {
                onClickToggleSemSearch();
              }}
              size="sm"
            >
              Disable Semantic Search
            </Button>
          ) : (
            <Button
              onClick={() => {
                onClickToggleSemSearch();
              }}
              size="sm"
            >
              Enable Semantic Search
            </Button>
          )}
        </div>
      </div>
    </>
  );
};
