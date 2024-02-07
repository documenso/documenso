import { Bird } from 'lucide-react';

import initTranslations from '~/app/i18n';

export const EmptyTemplateState = async ({ locale }: { locale: string }) => {
  const { t } = await initTranslations(locale);
  return (
    <div className="text-muted-foreground/60 flex h-96 flex-col items-center justify-center gap-y-4">
      <Bird className="h-12 w-12" strokeWidth={1.5} />

      <div className="text-center">
        <h3 className="text-lg font-semibold">{t('all_empty')}</h3>

        <p className="mt-2 max-w-[50ch]">{t('have_not_craeted_any_template')}</p>
      </div>
    </div>
  );
};
