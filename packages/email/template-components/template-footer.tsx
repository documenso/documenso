import { Link, Section, Text } from '../components';

export type TemplateFooterProps = {
  isDocument?: boolean;
};

export const TemplateFooter = ({ isDocument = true }: TemplateFooterProps) => {
  return (
    <Section>
      {isDocument && (
        <Text className="my-4 text-base text-slate-400">
          ეს დოკუმენტი გამოგზავნილია{' '}
          <Link className="text-[#7AC455]" href="https://documen.so/mail-footer">
            Ipografi-ს
          </Link>{' '}
          გამოყენებით
        </Text>
      )}

      <Text className="my-8 text-sm text-slate-400">
        შპს Ipografi
        <br />
        {/* 2261 Market Street, #5211, San Francisco, CA 94114, USA */}
        თბილისი, საქართველო
      </Text>
    </Section>
  );
};

export default TemplateFooter;
