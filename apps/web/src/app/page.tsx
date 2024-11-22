import { setupI18nSSR } from '@documenso/lib/client-only/providers/i18n.server';

export default async function DashboardPage() {
  await setupI18nSSR();

  return <div>Documenso</div>;
}
