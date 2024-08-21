import type { HTMLAttributes } from 'react';

import Image from 'next/image';

import { Trans } from '@lingui/macro';

import backgroundPattern from '@documenso/assets/images/background-pattern.png';
import cardConnectionsFigure from '@documenso/assets/images/card-connections-figure.png';
import cardPaidFigure from '@documenso/assets/images/card-paid-figure.png';
import cardSharingFigure from '@documenso/assets/images/card-sharing-figure.png';
import cardWidgetFigure from '@documenso/assets/images/card-widget-figure.png';
import { cn } from '@documenso/ui/lib/utils';
import { Card, CardContent } from '@documenso/ui/primitives/card';

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
          style={{
            mask: 'radial-gradient(rgba(255, 255, 255, 1) 0%, transparent 80%)',
            WebkitMask: 'radial-gradient(rgba(255, 255, 255, 1) 0%, transparent 80%)',
          }}
        />
      </div>
      <h2 className="px-0 text-[22px] font-semibold md:px-12 md:text-4xl lg:px-24">
        <Trans>Integrates with all your favourite tools.</Trans>
        <span className="block md:mt-0">
          <Trans>Send, connect, receive and embed everywhere.</Trans>
        </span>
      </h2>

      <div className="mt-6 grid grid-cols-2 gap-8 md:mt-8">
        <Card className="col-span-2 lg:col-span-1" degrees={120} gradient>
          <CardContent className="grid grid-cols-1 gap-8 p-6">
            <p className="text-foreground/80 leading-relaxed">
              <strong className="block">
                <Trans>Easy Sharing.</Trans>
              </strong>
              <Trans>Receive your personal link to share with everyone you care about.</Trans>
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
              <strong className="block">
                <Trans>Connections</Trans>
              </strong>
              <Trans>
                Create connections and automations with Zapier and more to integrate with your
                favorite tools.
              </Trans>
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
              <strong className="block">
                <Trans>Get paid (Soon).</Trans>
              </strong>
              <Trans>
                Integrated payments with Stripe so you don’t have to worry about getting paid.
              </Trans>
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
              <strong className="block">
                <Trans>React Widget (Soon).</Trans>
              </strong>
              <Trans>
                Easily embed Documenso into your product. Simply copy and paste our react widget
                into your application.
              </Trans>
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
