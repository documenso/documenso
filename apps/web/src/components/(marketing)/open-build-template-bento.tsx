import { HTMLAttributes } from 'react';

import Image from 'next/image';

import { cn } from '@documenso/ui/lib/utils';
import { Card, CardContent } from '@documenso/ui/primitives/card';

import backgroundPattern from '~/assets/background-pattern.png';
import cardBuildFigure from '~/assets/card-build-figure.png';
import cardOpenFigure from '~/assets/card-open-figure.png';
import cardTemplateFigure from '~/assets/card-template-figure.png';

export type OpenBuildTemplateBentoProps = HTMLAttributes<HTMLDivElement>;

export const OpenBuildTemplateBento = ({ className, ...props }: OpenBuildTemplateBentoProps) => {
  const cardData = [
    {
      title: 'Build on top.',
      description: 'Make it your own through advanced customization and adjustability.',
      image: cardBuildFigure,
      imageSize: 'max-w-xs',
    },
    {
      title: 'Template Store (Soon).',
      description:
        'Choose a template from the community app store. Or submit your own template for others to use.',
      image: cardTemplateFigure,
      imageSize: 'max-w-sm',
    },
  ];

  return (
    <div className={cn('relative', className)} {...props}>
      <div className="absolute inset-0 -z-10 flex items-center justify-center">
        <Image
          src={backgroundPattern}
          alt="background pattern"
          className="h-full scale-125 object-cover md:scale-150 lg:scale-[175%]"
        />
      </div>
      <h2 className="px-0 text-[22px] font-semibold md:px-12 md:text-4xl lg:px-24">
        Truly your own.
        <span className="block md:mt-0">Customise and expand.</span>
      </h2>

      <div className="mt-6 grid grid-cols-2 gap-8 md:mt-8">
        <Card className="col-span-2" degrees={45} gradient>
          <CardContent className="grid grid-cols-12 gap-8 overflow-hidden p-6 lg:aspect-[2.5/1]">
            <p className="col-span-12 leading-relaxed text-[#555E67] lg:col-span-6">
              <strong className="block">Open Source or Hosted.</strong>
              It’s up to you. Either clone our repository or rely on our easy to use hosting
              solution.
            </p>

            <div className="col-span-12 -my-6 -mr-6 flex items-end justify-end pt-12 lg:col-span-6">
              <Image src={cardOpenFigure} alt="its fast" className="max-w-[80%] lg:max-w-full" />
            </div>
          </CardContent>
        </Card>

        {cardData.map((card, index) => (
          <Card key={index} className="col-span-2 lg:col-span-1" spotlight>
            <CardContent className="grid grid-cols-1 gap-8 p-6">
              <p className="leading-relaxed text-[#555E67]">
                <strong className="block">{card.title}</strong>
                {card.description}
              </p>
              <div className="flex items-center justify-center p-8">
                <Image src={card.image} alt="Its fast" className={`w-full ${card.imageSize}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
