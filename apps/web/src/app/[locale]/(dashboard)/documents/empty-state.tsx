import { Bird, CheckCircle2 } from 'lucide-react';
import { match } from 'ts-pattern';

import { ExtendedDocumentStatus } from '@documenso/prisma/types/extended-document-status';

import initTranslations from '~/app/i18n';

export const EmptyDocumentState = async ({
  status,
  locale,
}: {
  status: ExtendedDocumentStatus;
  locale: string;
}) => {
  const { t } = await initTranslations(locale);
  const {
    title,
    message,
    icon: Icon,
  } = match(status)
    .with(ExtendedDocumentStatus.COMPLETED, () => ({
      title: `${t('nothing_to_do')}`,
      message: `${t('no_completed_documents_yet')}`,
      icon: CheckCircle2,
    }))
    .with(ExtendedDocumentStatus.DRAFT, () => ({
      title: `${t('no_active_drafts')}`,
      message: `${t('no_active_drafts_at_the_moment')}`,
      icon: CheckCircle2,
    }))
    .with(ExtendedDocumentStatus.ALL, () => ({
      title: `${t('we_are_all_empty')}`,
      message: `${t('not_yet_created_any_document')}`,
      icon: Bird,
    }))
    .otherwise(() => ({
      title: `${t('nothing_to_do')}`,
      message: `${t('all_document_have_been_processed')}`,
      icon: CheckCircle2,
    }));

  return (
    <div className="text-muted-foreground/60 flex h-60 flex-col items-center justify-center gap-y-4">
      <Icon className="h-12 w-12" strokeWidth={1.5} />

      <div className="text-center">
        <h3 className="text-lg font-semibold">{title}</h3>

        <p className="mt-2 max-w-[60ch]">{message}</p>
      </div>
    </div>
  );
};
