'use client';

import { useRouter } from 'next/navigation';

import { useTranslation } from 'react-i18next';

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
  open: boolean;
  onOpenChange: (_open: boolean) => void;
};

export const DeleteTemplateDialog = ({ id, open, onOpenChange }: DeleteTemplateDialogProps) => {
  const router = useRouter();
  const { t } = useTranslation();
  const { toast } = useToast();

  const { mutateAsync: deleteTemplate, isLoading } = trpcReact.template.deleteTemplate.useMutation({
    onSuccess: () => {
      router.refresh();

      toast({
        title: `${t('template_deleted')}`,
        description: `${t('template_deleted_successfully')}`,
        duration: 5000,
      });

      onOpenChange(false);
    },
  });

  const onDeleteTemplate = async () => {
    try {
      await deleteTemplate({ id });
    } catch {
      toast({
        title: `${t('something_went_wrong')}`,
        description: `${t('template_could_not_be_deleted')}`,
        variant: 'destructive',
        duration: 7500,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !isLoading && onOpenChange(value)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('do_you_want_to_delete_this_template')}</DialogTitle>

          <DialogDescription>{t('template_permanently_deleted')}</DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <div className="flex w-full flex-1 flex-nowrap gap-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              {t('cancel')}
            </Button>

            <Button type="button" loading={isLoading} onClick={onDeleteTemplate} className="flex-1">
              {t('delete')}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
