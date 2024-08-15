import { useRouter } from 'next/navigation';

import { trpc as trpcReact } from '@documenso/trpc/react';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@documenso/ui/primitives/dialog';
import { useToast } from '@documenso/ui/primitives/use-toast';

type DeleteTemplateDialogProps = {
  id: number;
  teamId?: number;
  open: boolean;
  onOpenChange: (_open: boolean) => void;
};

export const DeleteTemplateDialog = ({ id, open, onOpenChange }: DeleteTemplateDialogProps) => {
  const router = useRouter();

  const { toast } = useToast();

  const { mutateAsync: deleteTemplate, isLoading } = trpcReact.template.deleteTemplate.useMutation({
    onSuccess: () => {
      router.refresh();

      toast({
        title: 'შაბლონი წაშლილია',
        description: 'თქვენი შაბლონი წარმატებით წაიშალა!',
        duration: 5000,
      });

      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: 'დაფიქსირდა ხარვეზი',
        description:
          'სამწუხაროდ შაბლონის წაშლა ვერ მოხერხდა. გთხოვთ თავიდან სცადოთ ან დაგვიკავშირდეთ.',
        variant: 'destructive',
        duration: 7500,
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={(value) => !isLoading && onOpenChange(value)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>გნებავთ ამ შაბლონის წაშლა?</DialogTitle>

          <DialogDescription>
            გთხოვთ გაითვალისწინოთ, რომ ეს ქმედება შეუქცევადია. დადასტურების შემდეგ თქვენი შაბლონი
            სამუდამოდ წაიშლება.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            disabled={isLoading}
            onClick={() => onOpenChange(false)}
          >
            დახურვა
          </Button>

          <Button type="button" loading={isLoading} onClick={async () => deleteTemplate({ id })}>
            წაშლა
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
