'use client';

import Link from 'next/link';

import { type Document, DocumentStatus } from '@documenso/prisma/client';
import { trpc } from '@documenso/trpc/react';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@documenso/ui/primitives/tooltip';
import { useToast } from '@documenso/ui/primitives/use-toast';

export type AdminActionsProps = {
  className?: string;
  document: Document;
};

export const AdminActions = ({ className, document }: AdminActionsProps) => {
  const { toast } = useToast();

  const { mutate: resealDocument, isLoading: isResealDocumentLoading } =
    trpc.admin.resealDocument.useMutation({
      onSuccess: () => {
        toast({
          title: 'Success',
          description: 'Document resealed',
        });
      },
      onError: () => {
        toast({
          title: 'Error',
          description: 'Failed to reseal document',
          variant: 'destructive',
        });
      },
    });

  return (
    <div className={cn('flex gap-x-4', className)}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              loading={isResealDocumentLoading}
              disabled={document.status !== DocumentStatus.COMPLETED}
              onClick={() => resealDocument({ id: document.id })}
            >
              Reseal document
            </Button>
          </TooltipTrigger>

          <TooltipContent className="max-w-[40ch]">
            Attempts sealing the document again, useful for after a code change has occurred to
            resolve an erroneous document.
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Button variant="outline" asChild>
        <Link href={`/admin/users/${document.userId}`}>Go to owner</Link>
      </Button>
    </div>
  );
};
