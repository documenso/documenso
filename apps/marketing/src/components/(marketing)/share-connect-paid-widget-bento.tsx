import { HTMLAttributes } from 'react';

import Image from 'next/image';

import { cn } from '@documenso/ui/lib/utils';
import { Card, CardContent } from '@documenso/ui/primitives/card';

import backgroundPattern from '~/assets/background-pattern.png';
import cardConnectionsFigure from '~/assets/card-connections-figure.png';
import cardPaidFigure from '~/assets/card-paid-figure.png';
import cardSharingFigure from '~/assets/card-sharing-figure.png';
import cardWidgetFigure from '~/assets/card-widget-figure.png';

export type ShareConnectPaidWidgetBentoProps = HTMLAttributes<HTMLDivElement>;

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
        Integrates with all your favourite tools.
        <span className="block md:mt-0">Send, connect, receive and embed everywhere.</span>
      </h2>

      <div className="mt-6 grid grid-cols-2 gap-8 md:mt-8">
        <Card className="col-span-2 lg:col-span-1" degrees={120} gradient>
          <CardContent className="grid grid-cols-1 gap-8 p-6">
            <p className="text-foreground/80 leading-relaxed">
              <strong className="block">Easy Sharing (Soon).</strong>
              Receive your personal link to share with everyone you care about.
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
              <strong className="block">Connections (Soon).</strong>
              Create connections and automations with Zapier and more to integrate with your
              favorite tools.
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
              <strong className="block">Get paid (Soon).</strong>
              Integrated payments with stripe so you don’t have to worry about getting paid.
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
              <strong className="block">React Widget (Soon).</strong>
              Easily embed Documenso into your product. Simply copy and paste our react widget into
              your application.
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
