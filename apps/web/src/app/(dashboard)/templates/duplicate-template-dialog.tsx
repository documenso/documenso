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
  teamId?: number;
  open: boolean;
  onOpenChange: (_open: boolean) => void;
};

export const DuplicateTemplateDialog = ({
  id,
  teamId,
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
      onError: () => {
        toast({
          title: 'Error',
          description: 'An error occurred while duplicating template.',
          variant: 'destructive',
        });
      },
    });

  return (
    <Dialog open={open} onOpenChange={(value) => !isLoading && onOpenChange(value)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Do you want to duplicate this template?</DialogTitle>

          <DialogDescription className="pt-2">Your template will be duplicated.</DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button
            type="button"
            disabled={isLoading}
            variant="secondary"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>

          <Button
            type="button"
            loading={isLoading}
            onClick={async () =>
              duplicateTemplate({
                templateId: id,
                teamId,
              })
            }
          >
            Duplicate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
