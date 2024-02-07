import { findDocuments } from '@documenso/lib/server-only/admin/get-all-documents';

import initTranslations from '~/app/i18n';

import { DocumentsDataTable } from './data-table';

export type DocumentsPageProps = {
  searchParams?: {
    page?: string;
    perPage?: string;
  };
};

export default async function Documents({
  searchParams = {},
  params: { locale },
}: {
  searchParams: DocumentsPageProps['searchParams'];
  params: { locale: string };
}) {
  const { t } = await initTranslations(locale);
  const page = Number(searchParams.page) || 1;
  const perPage = Number(searchParams.perPage) || 20;

  const results = await findDocuments({
    page,
    perPage,
  });

  return (
    <div>
      <h2 className="text-4xl font-semibold">{t('manage_documents')}</h2>
      <div className="mt-8">
        <DocumentsDataTable locale={locale} results={results} />
      </div>
    </div>
  );
}
