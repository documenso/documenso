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
          title: 'შაბლონის დუბლირებულია',
          description: 'თქვენი შაბლონი წარმატებით იქნა დუბლირებული!',
          duration: 5000,
        });

        onOpenChange(false);
      },
      onError: () => {
        toast({
          title: 'დაფიქსირდა ხარვეზი',
          description:
            'შაბლონის დუბლირებისას დაფიქსირდა ხარვეზი. გთხოვთ თავიდან სცადოთ ან დაგვიკავშირდეთ.',
          variant: 'destructive',
        });
      },
    });

  return (
    <Dialog open={open} onOpenChange={(value) => !isLoading && onOpenChange(value)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>გნებავთ ამ შაბლონის დუბლირება?</DialogTitle>

          <DialogDescription className="pt-2">{''}</DialogDescription>
          {/* <DialogDescription className="pt-2">თქვენი შაბლონი დუბლირებული იქნება.</DialogDescription> */}
        </DialogHeader>

        <DialogFooter>
          <Button
            type="button"
            disabled={isLoading}
            variant="secondary"
            onClick={() => onOpenChange(false)}
          >
            დახურვა
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
            დუბლირება
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
