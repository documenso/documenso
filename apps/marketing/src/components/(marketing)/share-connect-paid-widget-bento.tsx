import type { HTMLAttributes } from 'react';

import Image from 'next/image';

import type { getDictionary } from 'get-dictionary';

import backgroundPattern from '@documenso/assets/images/background-pattern.png';
import cardConnectionsFigure from '@documenso/assets/images/card-connections-figure.png';
import cardPaidFigure from '@documenso/assets/images/card-paid-figure.png';
import cardSharingFigure from '@documenso/assets/images/card-sharing-figure.png';
import cardWidgetFigure from '@documenso/assets/images/card-widget-figure.png';
import { cn } from '@documenso/ui/lib/utils';
import { Card, CardContent } from '@documenso/ui/primitives/card';

export type ShareConnectPaidWidgetBentoProps = HTMLAttributes<HTMLDivElement> & {
  dictionary: Awaited<ReturnType<typeof getDictionary>>['bento']['share_connect_paid_widget'];
};

export const ShareConnectPaidWidgetBento = ({
  className,
  ...props
}: ShareConnectPaidWidgetBentoProps) => {
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
        {props.dictionary.integrate}
        <span className="block md:mt-0">{props.dictionary.everywhere}</span>
      </h2>

      <div className="mt-6 grid grid-cols-2 gap-8 md:mt-8">
        <Card className="col-span-2 lg:col-span-1" degrees={120} gradient>
          <CardContent className="grid grid-cols-1 gap-8 p-6">
            <p className="text-foreground/80 leading-relaxed">
              <strong className="block">{props.dictionary.sharing}</strong>
              {props.dictionary.personal_link}
            </p>

            <div className="flex items-center justify-center p-8">
              <Image
                src={cardSharingFigure}
                alt="its fast"
                className="w-full max-w-xs dark:contrast-[70%] dark:hue-rotate-180 dark:invert"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-2 lg:col-span-1" spotlight>
          <CardContent className="grid grid-cols-1 gap-8 p-6">
            <p className="text-foreground/80 leading-relaxed">
              <strong className="block">{props.dictionary.connections}</strong>
              {props.dictionary.create_connections}
            </p>

            <div className="flex items-center justify-center p-8">
              <Image
                src={cardConnectionsFigure}
                alt="its fast"
                className="w-full max-w-sm dark:contrast-[70%] dark:hue-rotate-180 dark:invert"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-2 lg:col-span-1" spotlight>
          <CardContent className="grid grid-cols-1 gap-8 p-6">
            <p className="text-foreground/80 leading-relaxed">
              <strong className="block">{props.dictionary.paid}</strong>
              {props.dictionary.integrated_payments}
            </p>

            <div className="flex items-center justify-center p-8">
              <Image
                src={cardPaidFigure}
                alt="its fast"
                className="w-full max-w-[14rem] dark:contrast-[70%] dark:hue-rotate-180 dark:invert"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-2 lg:col-span-1" spotlight>
          <CardContent className="grid grid-cols-1 gap-8 p-6">
            <p className="text-foreground/80 leading-relaxed">
              <strong className="block">{props.dictionary.react_widget}</strong>
              {props.dictionary.embed}
            </p>

            <div className="flex items-center justify-center p-8">
              <Image
                src={cardWidgetFigure}
                alt="its fast"
                className="w-full max-w-xs dark:contrast-[70%] dark:hue-rotate-180 dark:invert"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
