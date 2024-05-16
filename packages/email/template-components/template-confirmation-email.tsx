import { Button, Section, Text } from '../components';
import { TemplateDocumentImage } from './template-document-image';

export type TemplateConfirmationEmailProps = {
  confirmationLink: string;
  assetBaseUrl: string;
};

export const TemplateConfirmationEmail = ({
  confirmationLink,
  assetBaseUrl,
}: TemplateConfirmationEmailProps) => {
  return (
    <>
      <TemplateDocumentImage className="mt-6" assetBaseUrl={assetBaseUrl} />

      <Section className="flex-row items-center justify-center">
        <Text className="text-primary mx-auto mb-0 max-w-[80%] text-center text-lg font-semibold">
          Welcome to Documenso!
        </Text>

        <Text className="my-1 text-center text-base text-slate-400">
          სანამ დაიწყებთ, გთხოვთ, დაადასტუროთ თქვენი ელფოსტის მისამართი ქვემოთ მოცემულ ღილაკზე
          დაჭერით:
        </Text>

        <Section className="mb-6 mt-8 text-center">
          <Button
            className="bg-documenso-500 inline-flex items-center justify-center rounded-lg px-6 py-3 text-center text-sm font-medium text-black no-underline"
            href={confirmationLink}
          >
            დაადასტურეთ ელ.ფოსტა
          </Button>
          <Text className="mt-8 text-center text-sm italic text-slate-400">
            თქვენ ასევე შეგიძლიათ დააკოპიროთ და ჩასვათ ეს ბმული თქვენს ბრაუზერში: {confirmationLink}{' '}
            (ბმულს ვადა ეწურება 1 საათში)
          </Text>
        </Section>
      </Section>
    </>
  );
};
