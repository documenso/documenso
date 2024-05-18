/* eslint-disable no-unused-vars, @typescript-eslint/no-unused-vars */
import type { Metadata } from 'next';
import { Caveat } from 'next/font/google';
// import { ShareConnectPaidWidgetBento } from '~/components/(marketing)/share-connect-paid-widget-bento';
import Link from 'next/link';

import { cn } from '@documenso/ui/lib/utils';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@documenso/ui/primitives/accordion';

import { Callout } from '~/components/(marketing)/callout';
import { FasterSmarterBeautifulBento } from '~/components/(marketing)/faster-smarter-beautiful-bento';
import { Hero } from '~/components/(marketing)/hero';
import { OpenBuildTemplateBento } from '~/components/(marketing)/open-build-template-bento';

export const revalidate = 600;
export const metadata: Metadata = {
  title: {
    absolute: 'Documenso - The Open Source DocuSign Alternative',
  },
};

const fontCaveat = Caveat({
  weight: ['500'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-caveat',
});

export default async function IndexPage() {
  const starCount = await fetch('https://api.github.com/repos/documenso/documenso', {
    headers: {
      accept: 'application/vnd.github.v3+json',
    },
  })
    .then(async (res) => res.json())
    .then((res) => (typeof res.stargazers_count === 'number' ? res.stargazers_count : undefined))
    .catch(() => undefined);

  return (
    <div className={cn('mt-12', fontCaveat.variable)}>
      <Hero starCount={starCount} />

      <FasterSmarterBeautifulBento className="my-48" />
      {/* <ShareConnectPaidWidgetBento className="my-48" /> */}
      <OpenBuildTemplateBento className="my-48" />

      <div className="mx-auto mt-36 max-w-4xl">
        <h2 className="text-4xl font-semibold">ხშირად დასმული კითხვები</h2>

        <Accordion type="multiple" className="mt-8">
          <AccordionItem value="plan-differences">
            <AccordionTrigger className="text-left text-lg font-semibold">
              რა არის ელექტრონული ხელმოწერა?
            </AccordionTrigger>

            <AccordionContent className="text-muted-foreground max-w-prose text-sm leading-relaxed">
              ელექტრონული ხელმოწერა, ან eSignature, არის ფიზიკური პირის ხელმოწერის ციფრული ვერსია.
              იგი გამოიყენება ელექტრონული დოკუმენტების გადამოწმებისა და ავთენტიფიკაციისთვის,
              როგორიცაა PDF-ები. Signed.ge-ით შექმნილი ელექტრონული ხელმოწერები იურიდიულად მოქმედებს
              და აღიარებულია მთელ ევროკავშირში და მსოფლიოს მზარდ ქვეყნებში.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="data-handling">
            <AccordionTrigger className="text-left text-lg font-semibold">
              რამდენად უსაფრთხოა ელექტრონული ხელმოწეერები?
            </AccordionTrigger>

            <AccordionContent className="text-muted-foreground max-w-prose text-sm leading-relaxed">
              ჩვენ სერიოზულად ვუდგებით უსაფრთხოების ზომებს, როდესაც Signed.ge-სთან ელექტრონულ
              ხელმოწერას ქმნით, მთელი პროცესი დაცულია TLS დაშიფვრით. თქვენი დოკუმენტები სრულიად
              დაცულია ატვირთვიდან ჩამოტვირთვამდე. შეგიძლიათ დარწმუნებული იყოთ, რომ თქვენი მონაცემები
              უსაფრთხო და დაცვულია. ჩვენ სერიოზულად ვუდგებით უსაფრთხოების ზომებს. ვაგროვებთ მხოლოდ
              აუცილებელ მონაცემებს, როგორიცაა თქვენი სახელი, ელ.ფოსტის მისამართი და თქვენ მიერ
              ატვირთული დოკუმენტები, ჩვენი სერვისების უზრუნველსაყოფად. თქვენი მონაცემები უსაფრთხოდ
              ინახება დაშიფვრის გამოყენებით და მუშავდება მხოლოდ დოკუმენტის ხელმოწერისა და თქვენი
              ანგარიშის მართვისთვის. ჩვენ არ ვუზიარებთ თქვენს ინფორმაციას მესამე მხარეებს თქვენი
              თანხმობის გარეშე, გარდა იმ შემთხვევისა, როდესაც კანონიერად არის საჭირო. ჩვენი პრაქტიკა
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
              სანამ ინტერნეტთან კავშირი გაქვთ, შეგიძლიათ დოკუმენტების ხელმოწერა ნებისმიერ დროს,
              ნებისმიერ ადგილას.
            </AccordionContent>
          </AccordionItem>

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
              საჭიროა თუ არა, რომ ხელმომწერი პირი რეგისტრირებული იყოს Signed.ge-ზე?
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
      <Callout starCount={starCount} />
    </div>
  );
}
