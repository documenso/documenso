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
  const { t } = useTranslation();

  const { toast } = useToast();

  const { mutateAsync: duplicateTemplate, isLoading } =
    trpcReact.template.duplicateTemplate.useMutation({
      onSuccess: () => {
        router.refresh();

        toast({
          title: `${t('template_duplicated')}`,
          description: `${t('template_duplicated_successfully')}`,
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
        title: `${t('error')}`,
        description: `${t('error_occured_while_duplicating_template')}`,
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !isLoading && onOpenChange(value)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('do_you_want_to_duplicate_this_template')}</DialogTitle>

          <DialogDescription className="pt-2">{t('template_will_be_duplicated')}</DialogDescription>
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

            <Button type="button" loading={isLoading} onClick={onDuplicate} className="flex-1">
              {t('duplicate')}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
