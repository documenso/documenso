import type { HTMLAttributes } from 'react';

import Image from 'next/image';

import backgroundPattern from '@documenso/assets/images/background-pattern.png';
import cardBuildFigure from '@documenso/assets/images/card-build-figure.png';
import cardOpenFigure from '@documenso/assets/images/card-open-figure.png';
import cardTemplateFigure from '@documenso/assets/images/card-template-figure.png';
import { cn } from '@documenso/ui/lib/utils';
import { Card, CardContent } from '@documenso/ui/primitives/card';

import initTranslations from '~/app/i18n';

export interface OpenBuildTemplateBentoProps extends HTMLAttributes<HTMLDivElement> {
  locale: string;
}

export const OpenBuildTemplateBento = async ({
  locale,
  className,
  ...props
}: OpenBuildTemplateBentoProps) => {
  const { t } = await initTranslations(locale);
  return (
    <div className={cn('relative', className)} {...props}>
      <div className="absolute inset-0 -z-10 flex items-center justify-center">
        <Image
          src={backgroundPattern}
          alt="background pattern"
          className="h-full scale-125 object-cover dark:contrast-[70%] dark:invert dark:sepia md:scale-150 lg:scale-[175%]"
        />
      </div>
      <h2 className="px-0 text-[22px] font-semibold md:px-12 md:text-4xl lg:px-24">
        {t('truly_your_own')}
        <span className="block md:mt-0">{t('customise_and_expand')}</span>
      </h2>

      <div className="mt-6 grid grid-cols-2 gap-8 md:mt-8">
        <Card className="col-span-2" degrees={45} gradient>
          <CardContent className="grid grid-cols-12 gap-8 overflow-hidden p-6 lg:aspect-[2.5/1]">
            <p className="text-foreground/80 col-span-12 leading-relaxed lg:col-span-6">
              <strong className="block">{t('open_source_or_hosted')}</strong>
              {t('either_clone_our_repository')}
            </p>

            <div className="col-span-12 -my-6 -mr-6 flex items-end justify-end pt-12 lg:col-span-6">
              <Image
                src={cardOpenFigure}
                alt="its fast"
                className="max-w-[80%] dark:contrast-[70%] dark:hue-rotate-180 dark:invert lg:max-w-full"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-2 lg:col-span-1" spotlight>
          <CardContent className="grid grid-cols-1 gap-8 p-6">
            <p className="text-foreground/80 leading-relaxed">
              <strong className="block">{t('build_on_top')}</strong>
              {t('advanced_customization_and_adjustability')}
            </p>

            <div className="flex items-center justify-center p-8">
              <Image
                src={cardBuildFigure}
                alt="its fast"
                className="w-full max-w-xs dark:contrast-[70%] dark:hue-rotate-180 dark:invert"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-2 lg:col-span-1" spotlight>
          <CardContent className="grid grid-cols-1 gap-8 p-6">
            <p className="text-foreground/80 leading-relaxed">
              <strong className="block">{t('template_store_soon')}</strong>
              {t('choose_a_template_from_the_community_app_store')}
            </p>

            <div className="flex items-center justify-center p-8">
              <Image
                src={cardTemplateFigure}
                alt="its fast"
                className="w-full max-w-sm dark:contrast-[70%] dark:hue-rotate-180 dark:invert"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
