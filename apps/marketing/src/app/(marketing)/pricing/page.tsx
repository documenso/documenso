import type { Metadata } from 'next';
import Link from 'next/link';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@documenso/ui/primitives/accordion';
import { Button } from '@documenso/ui/primitives/button';

import { PricingTable } from '~/components/(marketing)/pricing-table';

export const metadata: Metadata = {
  title: 'Pricing',
};

export const dynamic = 'force-dynamic';

export type PricingPageProps = {
  searchParams?: {
    planId?: string;
    email?: string;
    name?: string;
    cancelled?: string;
  };
};

export default function PricingPage() {
  return (
    <div className="mt-6 sm:mt-12">
      <div className="text-center">
        <h1 className="text-3xl font-bold lg:text-5xl">შეარჩიე შენი პაკეტი</h1>

        <p className="text-foreground mt-4 text-lg leading-normal">
          Designed for every stage of your journey.
        </p>
        <p className="text-foreground text-lg leading-normal">დაიწყეთ დღესვე.</p>
      </div>

      <div className="mt-12">
        <PricingTable />
      </div>

      <div className="mx-auto mt-36 max-w-2xl">
        <h2 className="text-center text-2xl font-semibold">
          არცერთი მათგანი არ მუშაობს თქვენთვის? სცადეთ თვითჰოსტინგი!
        </h2>

        <p className="text-muted-foreground mt-4 text-center leading-relaxed">
          Our self-hosted option is great for small teams and individuals who need a simple
          solution. You can use our docker based setup to get started in minutes. Take control with
          full customizability and data ownership.
        </p>

        <div className="mt-4 flex justify-center">
          <Button variant="outline" size="lg" className="rounded-full hover:cursor-pointer" asChild>
            <Link href="https://github.com/documenso/documenso" target="_blank" rel="noreferrer">
              Დაიწყე
            </Link>
          </Button>
        </div>
      </div>

      <div className="mx-auto mt-36 max-w-2xl">
        {/* FAQ Section */}

        <h2 className="text-4xl font-semibold">FAQs</h2>

        <Accordion type="multiple" className="mt-8">
          <AccordionItem value="plan-differences">
            <AccordionTrigger className="text-left text-lg font-semibold">
              რა განსხვავებაა გეგმებს შორის?
            </AccordionTrigger>

            <AccordionContent className="text-muted-foreground max-w-prose text-sm leading-relaxed">
              თქვენ შეგიძლიათ თავად მოაწყოთ Documenso უფასოდ ან გამოიყენოთ ჩვენი მზა ჰოსტინგული
              ვერსია. ჰოსტინგულ ვერსიას გააჩნია დამატებითი მხარდაჭერა, უმტკივნეულო მასშტაბირება და
              სხვა. ადრეული მიმღებები მიიღებენ წვდომას ყველა ფუნქციაზე, რომელსაც ჩვენ ვაშენებთ წელს,
              დამატებითი საფასურის გარეშე! სამუდამოდ! დიახ, ეს მოიცავს რამდენიმე მომხმარებელს თითო
              ანგარიშზე მოგვიანებით. თუ გსურთ Documenso თქვენი საწარმოსთვის, მოხარული ვართ ვისაუბროთ
              თქვენს საჭიროებებზე.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="data-handling">
            <AccordionTrigger className="text-left text-lg font-semibold">
              როგორ ამუშავებ ჩემს მონაცემებს?
            </AccordionTrigger>

            <AccordionContent className="text-muted-foreground max-w-prose text-sm leading-relaxed">
              უსაფრთხოდ. ჩვენი მონაცემთა ცენტრები მდებარეობს ფრანკფურტში (გერმანია) და გვაძლევს
              საუკეთესოს კონფიდენციალურობის ადგილობრივი კანონები. ჩვენ კარგად ვაცნობიერებთ ჩვენი
              მონაცემების სენსიტიურ ხასიათს და ვიყენებთ საუკეთესო პრაქტიკებს ჩვენთვის მინდობილი
              მონაცემების უსაფრთხოებისა და მთლიანობის უზრუნველსაყოფად.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="should-use-cloud">
            <AccordionTrigger className="text-left text-lg font-semibold">
              რატომ უნდა გამოვიყენო თქვენი ჰოსტინგის სერვისი?
            </AccordionTrigger>

            <AccordionContent className="text-muted-foreground max-w-prose text-sm leading-relaxed">
              ჩვენი ჰოსტირებული ვერსიის გამოყენება დასაწყებად ყველაზე მარტივი გზაა, შეგიძლიათ
              უბრალოდ გამოიწეროთ და დაიწყეთ თქვენი დოკუმენტების ხელმოწერა. ჩვენ ვზრუნავთ
              ინფრასტრუქტურაზე, ასე რომ თქვენ შეგიძლიათ ფოკუსირება თქვენს საქმეზე. გარდა ამისა,
              ჩვენი ჰოსტირებული ვერსიის გამოყენებისას თქვენ სარგებლობთ ჩვენით სანდო ხელმოწერის
              სერთიფიკატები, რომლებიც გეხმარებათ ნდობის დამყარებაში თქვენს კლიენტებთან.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="how-to-contribute">
            <AccordionTrigger className="text-left text-lg font-semibold">
              როგორ შემიძლია წვლილი შევიტანო?
            </AccordionTrigger>

            <AccordionContent className="text-muted-foreground max-w-prose text-sm leading-relaxed">
              That's awesome. You can take a look at the current{' '}
              <Link
                className="text-documenso-700 font-bold"
                href="https://github.com/documenso/documenso/milestones"
                target="_blank"
              >
                Issues
              </Link>{' '}
              and join our{' '}
              <Link
                className="text-documenso-700 font-bold"
                href="https://documen.so/discord"
                target="_blank"
              >
                Discord Community
              </Link>{' '}
              to keep up to date, on what the current priorities are. In any case, we are an open
              community and welcome all input, technical and non-technical ❤️
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="can-i-use-documenso-commercially">
            <AccordionTrigger className="text-left text-lg font-semibold">
              შემიძლია დოკუმენსო კომერციულად გამოვიყენო?
            </AccordionTrigger>

            <AccordionContent className="text-muted-foreground max-w-prose text-sm leading-relaxed">
              დიახ! Documenso შემოთავაზებულია GNU AGPL V3 ღია კოდის ლიცენზიით. ეს ნიშნავს შენ
              შეგიძლიათ გამოიყენოთ იგი უფასოდ და შეცვალოთ იგი თქვენს საჭიროებებზე, თუ თქვენ
              გამოაქვეყნებთ თქვენს საჭიროებებს იცვლება იმავე ლიცენზიით.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="why-prefer-documenso">
            <AccordionTrigger className="text-left text-lg font-semibold">
              რატომ უნდა ვამჯობინო Documenso, ვიდრე Signify ან სხვა ხელმოწერის ინსტრუმენტი?
            </AccordionTrigger>

            <AccordionContent className="text-muted-foreground max-w-prose text-sm leading-relaxed">
              Documenso არის საზოგადოების ძალისხმევა, რათა შეიქმნას ღია და ძლიერი ეკოსისტემა
              ინსტრუმენტის გარშემო, ყველას თავისუფლად შეუძლია გამოიყენოს და მოერგოს. ჭეშმარიტად
              გახსნილობით გვინდა შევქმნათ სანდო ინფრასტრუქტურა ინტერნეტის მომავლისთვის.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="where-can-i-get-support">
            <AccordionTrigger className="text-left text-lg font-semibold">
              სად შემიძლია მივიღო მხარდაჭერა?
            </AccordionTrigger>

            <AccordionContent className="text-muted-foreground max-w-prose text-sm leading-relaxed">
              მოხარული ვართ დაგეხმაროთ{' '}
              <Link
                className="text-documenso-700 font-bold"
                target="_blank"
                rel="noreferrer"
                href="mailto:support@documenso.com"
              >
                support@documenso.com
              </Link>{' '}
              ან{' '}
              <a
                className="text-documenso-700 font-bold"
                href="https://documen.so/discord"
                target="_blank"
                rel="noreferrer"
              >
                ჩვენს Discord-ის Channel-ში
              </a>{' '}
              please message either Lucas or Timur to get added to the channel if you are not
              already a member.
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </div>
  );
}
