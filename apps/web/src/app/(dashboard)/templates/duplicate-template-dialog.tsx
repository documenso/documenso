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

type DuplicateTemplateDialogProps = {
  id: number;
  open: boolean;
  onOpenChange: (_open: boolean) => void;
};

export const DuplicateTemplateDialog = ({
  id,
  open,
  onOpenChange,
}: DuplicateTemplateDialogProps) => {
  const router = useRouter();

  const { toast } = useToast();

  const { mutateAsync: duplicateTemplate, isLoading } =
    trpcReact.template.duplicateTemplate.useMutation({
      onSuccess: () => {
        router.refresh();

        toast({
          title: 'Template duplicated',
          description: 'Your template has been duplicated successfully.',
          duration: 5000,
        });

        onOpenChange(false);
      },
    });

  const onDuplicate = async () => {
    try {
      await duplicateTemplate({
        templateId: id,
      });
    } catch (err) {
      toast({
        title: 'Error',
        description: 'An error occurred while duplicating template.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !isLoading && onOpenChange(value)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Do you want to duplicate this template?</DialogTitle>

          <DialogDescription className="pt-2">Your template will be duplicated.</DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <div className="flex w-full flex-1 flex-nowrap gap-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancel
            </Button>

            <Button type="button" loading={isLoading} onClick={onDuplicate} className="flex-1">
              Duplicate
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
