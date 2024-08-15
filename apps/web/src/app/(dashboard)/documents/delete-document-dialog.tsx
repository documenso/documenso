import { useEffect, useState } from 'react';

import { useRouter } from 'next/navigation';

import { match } from 'ts-pattern';

import { useLimits } from '@documenso/ee/server-only/limits/provider/client';
import { DocumentStatus } from '@documenso/prisma/client';
import { trpc as trpcReact } from '@documenso/trpc/react';
import { Alert, AlertDescription } from '@documenso/ui/primitives/alert';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@documenso/ui/primitives/dialog';
import { Input } from '@documenso/ui/primitives/input';
import { useToast } from '@documenso/ui/primitives/use-toast';

type DeleteDocumentDialogProps = {
  id: number;
  open: boolean;
  onOpenChange: (_open: boolean) => void;
  status: DocumentStatus;
  documentTitle: string;
  teamId?: number;
  canManageDocument: boolean;
};

export const DeleteDocumentDialog = ({
  id,
  open,
  onOpenChange,
  status,
  documentTitle,
  teamId,
  canManageDocument,
}: DeleteDocumentDialogProps) => {
  const router = useRouter();

  const { toast } = useToast();
  const { refreshLimits } = useLimits();

  const [inputValue, setInputValue] = useState('');
  const [isDeleteEnabled, setIsDeleteEnabled] = useState(status === DocumentStatus.DRAFT);

  const { mutateAsync: deleteDocument, isLoading } = trpcReact.document.deleteDocument.useMutation({
    onSuccess: () => {
      router.refresh();
      void refreshLimits();

      toast({
        title: 'დოკუმენტი წაშლილია',
        description: `"${documentTitle}" წარმატებით წაიშალა!`,
        duration: 5000,
      });

      onOpenChange(false);
    },
  });

  useEffect(() => {
    if (open) {
      setInputValue('');
      setIsDeleteEnabled(status === DocumentStatus.DRAFT);
    }
  }, [open, status]);

  const onDelete = async () => {
    try {
      await deleteDocument({ id, teamId });
    } catch {
      toast({
        title: 'დაფიქსირდა ხარვეზი',
        description: 'ამ დოკუმენტის წაშლისას დაფიქსირდა ხარვეზი. გთხოვთ თავიდან სცადეთ.',
        variant: 'destructive',
        duration: 7500,
      });
    }
  };

  const onInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(event.target.value);
    setIsDeleteEnabled(event.target.value === 'delete');
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !isLoading && onOpenChange(value)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>დარწმუნებული ხართ?</DialogTitle>

          <DialogDescription>
            თქვენ ახლა {canManageDocument ? 'წაშლით' : 'დაფარავთ'}{' '}
            <strong>"{documentTitle}"</strong>-ს
          </DialogDescription>
        </DialogHeader>

        {canManageDocument ? (
          <Alert variant="warning" className="-mt-1">
            {match(status)
              .with(DocumentStatus.DRAFT, () => (
                <AlertDescription>
                  გთხოვთ გაითვალისწინოთ, რომ ეს ქმედება <strong>შეუქცევადია</strong>. დადასტურების
                  შემდეგ, ეს დოკუმენტი სამუდამოდ წაიშლება.
                </AlertDescription>
              ))
              .with(DocumentStatus.PENDING, () => (
                <AlertDescription>
                  <p>
                    გთხოვთ გაითვალისწინოთ, რომ ეს ქმედება <strong>შეუქცევადია</strong>.
                  </p>

                  <p className="mt-1">დადასტურების შემდეგ მოხდება შემდეგი:</p>

                  <ul className="mt-0.5 list-inside list-disc">
                    <li>დოკუმენტი სამუდამოდ წაიშლება</li>
                    <li>დოკუმენტის ხელმოწერის პროცესი გაუქმდება</li>
                    <li>ყველა ჩასმული ხელმოწერა გაუქმდება</li>
                    <li>ყველა მიმღებს მიუვა შეტყობინება</li>
                  </ul>
                </AlertDescription>
              ))
              .with(DocumentStatus.COMPLETED, () => (
                <AlertDescription>
                  <p>ამ დოკუმენტის წაშლით, მოხდება შემდეგი:</p>

                  <ul className="mt-0.5 list-inside list-disc">
                    <li>დოკუმენტი დაიფარება თქვენი ანგარიშიდან</li>
                    <li>მიმღებები კვლავ შეინარჩუნებენ დოკუმენტის ასლს</li>
                  </ul>
                </AlertDescription>
              ))
              .exhaustive()}
          </Alert>
        ) : (
          <Alert variant="warning" className="-mt-1">
            <AlertDescription>
              გთხოვთ დაგვიკავშირდეთ, თუ გსურთ ამ ქმედების დაბრუნება.
            </AlertDescription>
          </Alert>
        )}

        {status !== DocumentStatus.DRAFT && canManageDocument && (
          <Input
            type="text"
            value={inputValue}
            onChange={onInputChange}
            placeholder="დაწერეთ 'delete' დადასტურებისთვის"
          />
        )}

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            დახურვა
          </Button>

          <Button
            type="button"
            loading={isLoading}
            onClick={onDelete}
            disabled={!isDeleteEnabled && canManageDocument}
            variant="destructive"
          >
            {canManageDocument ? 'წაშლა' : 'დაფარვა'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
