import type { HTMLAttributes } from 'react';

import Image from 'next/image';

import backgroundPattern from '@documenso/assets/images/background-pattern.png';
import browserBasedPattern from '@documenso/assets/images/browser-based.svg';
import legallyRecognizedPattern from '@documenso/assets/images/legally-recognized.svg';
import mobileFriendlyPattern from '@documenso/assets/images/mobile-friendly.svg';
import noLearningCurvePattern from '@documenso/assets/images/no-lerning-curve.svg';
import { cn } from '@documenso/ui/lib/utils';
import { Card, CardContent } from '@documenso/ui/primitives/card';

export type OpenBuildTemplateBentoProps = HTMLAttributes<HTMLDivElement>;

export const OpenBuildTemplateBento = ({ className, ...props }: OpenBuildTemplateBentoProps) => {
  return (
    <div className={cn('relative', className)} {...props}>
      <div className="absolute inset-0 -z-10 flex items-center justify-center">
        <Image
          src={backgroundPattern}
          alt="background pattern"
          className="h-full scale-125 object-cover dark:contrast-[70%] dark:invert dark:sepia md:scale-150 lg:scale-[175%]"
        />
      </div>
      <h2 className="px-0 text-center text-[22px] font-semibold md:px-12 md:text-4xl lg:px-24">
        გაამარტივე დაკნტრაქტების პროცესი
        {/* <span className="block md:mt-0">Customise and expand.</span> */}
      </h2>

      <div className="mt-6 grid grid-cols-4 gap-8 md:mt-8">
        <Card className="col-span-2 lg:col-span-1" spotlight>
          <CardContent className="grid grid-cols-1 gap-4 px-6 py-9">
            <Image
              src={mobileFriendlyPattern}
              alt="its fast"
              className=" dark:contrast-[70%] dark:hue-rotate-180 dark:invert"
            />

            <p className="text-foreground/80 leading-relaxed">
              <strong className="block">ყველა მოწყობილობაზე მორგებული</strong>
              თქვენს მომხმარებლებს ტელეფონებიდანაც კი შეუძლიათ მოაწერონ ხელი
            </p>
          </CardContent>
        </Card>

        <Card className="col-span-2 lg:col-span-1" spotlight>
          <CardContent className="grid grid-cols-1 gap-4 px-6 py-9">
            <Image
              src={browserBasedPattern}
              alt="its fast"
              className=" dark:contrast-[70%] dark:hue-rotate-180 dark:invert"
            />

            <p className="text-foreground/80 leading-relaxed">
              <strong className="block">ბრაუზერის გამოყენებით</strong>
              არ საჭიროებს აპლიკაციის ინსტალაციას, ბრაუზერშივე შესაძლებელია ატვირთოთ ფაილი, მოაწეროთ
              ხელი და გააზიაროთ
              {/* არ საჭიროებს აპლიკაციის ინსტალაციას, ბრაუზერშივე შესაძლებელია მოაწეროთ ხელი*/}
            </p>
          </CardContent>
        </Card>

        <Card className="col-span-2 lg:col-span-1" spotlight>
          <CardContent className="grid grid-cols-1 gap-4 px-6 py-9">
            <Image
              src={noLearningCurvePattern}
              alt="its fast"
              className=" dark:contrast-[70%] dark:hue-rotate-180 dark:invert"
            />

            <p className="text-foreground/80 leading-relaxed">
              <strong className="block">არ საჭიროებს სწავლას</strong>
              თუ თქვენ შეგიძლიათ ინტერნეტის გამოყენება, მაშინ თქვენ შეძლებთ მოაწეროთ დოკუმენტს ხელი
            </p>
          </CardContent>
        </Card>

        <Card className="col-span-2 lg:col-span-1" spotlight>
          <CardContent className="grid grid-cols-1 gap-4 px-6 py-9">
            <Image
              src={legallyRecognizedPattern}
              alt="its fast"
              className=" dark:contrast-[70%] dark:hue-rotate-180 dark:invert"
            />

            <p className="text-foreground/80 leading-relaxed">
              <strong className="block">იურიდიულად აღიარებული</strong>
              არ ინერვიულოთ, თქვენი ხელმოწერები იურიდიულად დაცვულია eIDAS სტანდარტების მიხედვით
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
