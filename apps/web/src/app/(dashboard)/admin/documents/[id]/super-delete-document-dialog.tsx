'use client';

import { useState } from 'react';

import { useRouter } from 'next/navigation';

import type { Document } from '@documenso/prisma/client';
import { TRPCClientError } from '@documenso/trpc/client';
import { trpc } from '@documenso/trpc/react';
import { Alert, AlertDescription, AlertTitle } from '@documenso/ui/primitives/alert';
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
import { Input } from '@documenso/ui/primitives/input';
import { useToast } from '@documenso/ui/primitives/use-toast';

export type SuperDeleteDocumentDialogProps = {
  document: Document;
};

export const SuperDeleteDocumentDialog = ({ document }: SuperDeleteDocumentDialogProps) => {
  const { toast } = useToast();
  const router = useRouter();

  const [reason, setReason] = useState('');

  const { mutateAsync: deleteDocument, isLoading: isDeletingDocument } =
    trpc.admin.deleteDocument.useMutation();

  const handleDeleteDocument = async () => {
    try {
      if (!reason) {
        return;
      }

      await deleteDocument({ id: document.id, reason });

      toast({
        title: 'დოკუმენტი წაშლილია',
        description: 'დოკუმენტი წარმატებით წაიშალა!',
        duration: 5000,
      });

      router.push('/admin/documents');
    } catch (err) {
      if (err instanceof TRPCClientError && err.data?.code === 'BAD_REQUEST') {
        toast({
          title: 'დაფიქსირდა ხარვეზი',
          description: err.message,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'დაფიქსირდა ხარვეზი',
          variant: 'destructive',
          description:
            err.message ??
            'დოკუმენტის წაშლისას დაფიქსირდა ხარვეზი. გთხოვთ სცადოთ თავიდან ან დაგვიკავშირდეთ.',
        });
      }
    }
  };

  return (
    <div>
      <div>
        <Alert
          className="flex flex-col items-center justify-between gap-4 p-6 md:flex-row "
          variant="neutral"
        >
          <div>
            <AlertTitle>დოკუმენტის წაშლა</AlertTitle>
            <AlertDescription className="mr-2">
              გაითვალისწინეთ, რომ დოკუემენტის წაშლა შეუქცევადია.
            </AlertDescription>
          </div>

          <div className="flex-shrink-0">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="destructive">დოკუმენტის წაშლა</Button>
              </DialogTrigger>

              <DialogContent>
                <DialogHeader className="space-y-4">
                  <DialogTitle>დოკუმენტის წაშლა</DialogTitle>

                  <Alert variant="destructive">
                    <AlertDescription className="selection:bg-red-100">
                      ეს ქმედება შეუქცევადია, დარწმუნდით სანამ განაგრძობთ.
                    </AlertDescription>
                  </Alert>
                </DialogHeader>

                <div>
                  <DialogDescription>დადასტურებისთვის გთხოვთ მიუთითოთ მიზეზი:</DialogDescription>

                  <Input
                    className="mt-2"
                    type="text"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </div>

                <DialogFooter>
                  <Button
                    onClick={handleDeleteDocument}
                    loading={isDeletingDocument}
                    variant="destructive"
                    disabled={!reason}
                  >
                    {isDeletingDocument ? 'დოკუმენტი იშლება...' : 'დოკუმენტის წაშლა'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </Alert>
      </div>
    </div>
  );
};
