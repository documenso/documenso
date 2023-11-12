import Link from 'next/link';

import { createTranslation } from '@documenso/ui/i18n/server';
import { LocaleTypes } from '@documenso/ui/i18n/settings';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@documenso/ui/primitives/accordion';
import { Button } from '@documenso/ui/primitives/button';

import { PricingTable } from '~/components/(marketing)/pricing-table';

export type PricingPageProps = {
  searchParams?: {
    planId?: string;
    email?: string;
    name?: string;
    cancelled?: string;
  };
};

export default async function PricingPage({
  params: { locale },
}: {
  params: { locale: LocaleTypes };
}) {
  const { t } = await createTranslation(locale, 'marketing');

  return (
    <div className="mt-6 sm:mt-12">
      <div className="text-center">
        <h1 className="text-3xl font-bold lg:text-5xl">{t(`pricing`)}</h1>

        <p className="text-foreground mt-4 text-lg leading-normal">{t(`designed-for`)}</p>
        <p className="text-foreground text-lg leading-normal">{t(`get-started-today`)}</p>
      </div>

      <div className="mt-12">
        <PricingTable />
      </div>

      <div className="mx-auto mt-36 max-w-2xl">
        <h2 className="text-center text-2xl font-semibold">{t(`need-option`)}</h2>

        <p className="text-muted-foreground mt-4 text-center leading-relaxed">
          {t(`self-host-option`)}
        </p>

        <div className="mt-4 flex justify-center">
          <Button variant="outline" size="lg" className="rounded-full hover:cursor-pointer" asChild>
            <Link href="#" target="_blank">
              {t(`get-started`)}
            </Link>
          </Button>
        </div>
      </div>

      <div className="mx-auto mt-36 max-w-2xl">
        {/* FAQ Section */}

        <h2 className="text-4xl font-semibold">{t(`FAQs`)}</h2>

        <Accordion type="multiple" className="mt-8">
          <AccordionItem value="plan-differences">
            <AccordionTrigger className="text-left text-lg font-semibold">
              {t(`difference`)}
            </AccordionTrigger>

            <AccordionContent className="text-muted-foreground max-w-prose text-sm leading-relaxed">
              {t(`self-host`)}
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="data-handling">
            <AccordionTrigger className="text-left text-lg font-semibold">
              {t(`handle-data`)}
            </AccordionTrigger>

            <AccordionContent className="text-muted-foreground max-w-prose text-sm leading-relaxed">
              {t(`hosted-in`)}
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="should-use-cloud">
            <AccordionTrigger className="text-left text-lg font-semibold">
              {t(`why-self-host`)}
            </AccordionTrigger>

            <AccordionContent className="text-muted-foreground max-w-prose text-sm leading-relaxed">
              {t(`using-hosted`)}
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="how-to-contribute">
            <AccordionTrigger className="text-left text-lg font-semibold">
              {t(`contribution`)}
            </AccordionTrigger>
          </AccordionItem>

          <AccordionItem value="why-prefer-documenso">
            <AccordionTrigger className="text-left text-lg font-semibold">
              {t(`why-use`)}
            </AccordionTrigger>

            <AccordionContent className="text-muted-foreground max-w-prose text-sm leading-relaxed">
              {t(`is-a-community`)}
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="where-can-i-get-support">
            <AccordionTrigger className="text-left text-lg font-semibold">
              {t(`where-support`)}
            </AccordionTrigger>

            <AccordionContent className="text-muted-foreground max-w-prose text-sm leading-relaxed">
              {t(`happy-to-assist`)}{' '}
              <Link
                className="text-documenso-700 font-bold"
                target="_blank"
                href="mailto:info@progiciel.co"
              >
                info@progiciel.co
              </Link>{' '}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </div>
  );
}
