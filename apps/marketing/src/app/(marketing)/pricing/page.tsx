import type { Metadata } from 'next';
import Link from 'next/link';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@documenso/ui/primitives/accordion';

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
        <h1 className="text-3xl font-bold lg:text-5xl">შეარჩიეთ თქვენი პაკეტი</h1>

        <p className="text-foreground mt-4 text-lg leading-normal">
          გამოცადეთ ჩვენი ფუნქციონალი სრულიად უფასოდ 14 დღის განმავლობაში.
        </p>
        <p className="text-foreground text-lg leading-normal">დაიწყეთ დღესვე!</p>
      </div>

      <div className="mt-12">
        <PricingTable />
      </div>

      {/* <div className="mx-auto mt-36 max-w-2xl">
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
              დაიწყეთ
            </Link>
          </Button>
        </div>
      </div> */}

      <div className="mx-auto mt-36 max-w-2xl">
        <h2 className="text-4xl font-semibold">ხშირად დასმული კითხვები</h2>

        <Accordion type="multiple" className="mt-8">
          <AccordionItem value="plan-differences">
            <AccordionTrigger className="text-left text-lg font-semibold">
              რა განსხვავებაა პაკეტებს შორის?
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
              როგორ ამუშავებთ ჩემს მონაცემებს?
            </AccordionTrigger>

            <AccordionContent className="text-muted-foreground max-w-prose text-sm leading-relaxed">
              ჩვენ სერიოზულად ვუდგებით უსაფრთხოების ზომებს. ვაგროვებთ მხოლოდ აუცილებელ მონაცემებს,
              როგორიცაა თქვენი სახელი, ელ.ფოსტის მისამართი და თქვენ მიერ ატვირთული დოკუმენტები,
              ჩვენი სერვისების უზრუნველსაყოფად. თქვენი მონაცემები უსაფრთხოდ ინახება დაშიფვრის
              გამოყენებით და მუშავდება მხოლოდ დოკუმენტის ხელმოწერისა და თქვენი ანგარიშის
              მართვისთვის. ჩვენ არ ვუზიარებთ თქვენს ინფორმაციას მესამე მხარეებს თქვენი თანხმობის
              გარეშე, გარდა იმ შემთხვევისა, როდესაც კანონიერად არის საჭირო. ჩვენი პრაქტიკა
              რეგულარულად განიხილება უსაფრთხოების უმაღლესი სტანდარტების უზრუნველსაყოფად.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="should-use-cloud">
            <AccordionTrigger className="text-left text-lg font-semibold">
              შემიძლია დოკუმენტებზე ხელის მოწერა ნებისმიერი მოწყობილობიდან?
            </AccordionTrigger>

            <AccordionContent className="text-muted-foreground max-w-prose text-sm leading-relaxed">
              დიახ, ჩვენი პლატფორმა შექმნილია ისე, რომ იყოს სრულად თავსებადი ყველა ძირითად
              მოწყობილობასთან, მათ შორის დესკტოპებთან, ლეპტოპებთან, ტაბლეტებთან და სმარტფონებთან.
              სანამ ინტერნეტთან კავშირი გაქვთ, დოკუმენტების ხელმოწერა შეგიძლიათ ნებისმიერ დროს,
              ნებისმიერ ადგილას.
            </AccordionContent>
          </AccordionItem>

          {/* <AccordionItem value="how-to-contribute">
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
          </AccordionItem> */}

          <AccordionItem value="can-i-use-documenso-commercially">
            <AccordionTrigger className="text-left text-lg font-semibold">
              რა ტიპის დოკუმენტების ატვირთვა და ხელმოწერა შემიძლია?
            </AccordionTrigger>

            <AccordionContent className="text-muted-foreground max-w-prose text-sm leading-relaxed">
              ჩვენს პლატფორმაზე შეგიძლიათ PDF ფორმატის ფაილების ატვირთვა და მათზე ხელმოწერა.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="why-prefer-documenso">
            <AccordionTrigger className="text-left text-lg font-semibold">
              საჭიროა თუ არა, რომ ხელმომწერი პირი რეგისტრირებული იყოს CHIKOVANI-ზე?
            </AccordionTrigger>

            <AccordionContent className="text-muted-foreground max-w-prose text-sm leading-relaxed">
              დოკუმენტზე ხელმოსაწერად არ არის საჭირო რეგისტრაციის გავლა. ხელის მოწერა შესაძლებელი
              იქნება ჩვეულებრივად, როგორც კომპიუტერიდან, ისევე მობილურიდან.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="gurantee-of-signer">
            <AccordionTrigger className="text-left text-lg font-semibold">
              რა გარანტიაა, რომ დოკუმენტზე ნამდვილად სასურველმა ადამიანმა მოაწერა ხელი?
            </AccordionTrigger>

            <AccordionContent className="text-muted-foreground max-w-prose text-sm leading-relaxed">
              ამის დასადასტურებლად ყოველ ხელმოწერილ დოკუმენტზე ვქმნით ცნობას, რომელიც შეიცავს:
              <br />
              <br />
              <ul>
                <li>
                  <span>&#8226;</span> ხელმომწერის ელ.ფოსტის მისამართს
                </li>
                <li>
                  <span>&#8226;</span> ხელმომწერის სრულ სახელსა და გვარს
                </li>
                <li>
                  <span>&#8226;</span> ხელმოწერის ID-ს
                </li>
                <li>
                  <span>&#8226;</span> მოწყობილობის IP მისამართსა და ბრაუზერს, რომლიდანაც დოკუმენტს
                  ხელი მოეწერა
                </li>
                <li>
                  <span>&#8226;</span> დოკუმენტის გაგზავნის, ნახვის და ხელმოწერის ზუსტი დროსა და
                  თარიღს
                </li>
              </ul>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="where-can-i-get-support">
            <AccordionTrigger className="text-left text-lg font-semibold">
              სად შემიძლია მივიღო მხარდაჭერა?
            </AccordionTrigger>

            <AccordionContent className="text-muted-foreground max-w-prose text-sm leading-relaxed">
              მოხარული ვართ დაგეხმაროთ და ვუპასუხოთ თქვენს ნებისმიერ კითხვას. მოგვწერეთ{' '}
              <Link
                className="text-documenso-700 font-bold"
                target="_blank"
                rel="noreferrer"
                href="mailto:support@documenso.com"
              >
                support@documenso.com
              </Link>{' '}
              {/* ან{' '}  */}
              {/* <a
                className="text-documenso-700 font-bold"
                href="https://documen.so/discord"
                target="_blank"
                rel="noreferrer"
              >
                ჩვენს Discord-ის Channel-ში
              </a>{' '}
              please message either Lucas or Timur to get added to the channel if you are not
              already a member. */}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </div>
  );
}
