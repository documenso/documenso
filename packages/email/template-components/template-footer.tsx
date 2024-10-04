import { Link, Section, Text } from '../components';

export type TemplateFooterProps = {
  isDocument?: boolean;
};

export const TemplateFooter = ({ isDocument = true }: TemplateFooterProps) => {
  return (
    <Section>
      {isDocument && (
        <Text className="my-4 text-base text-slate-400">
          This document was sent using{' '}
          <Link className="text-[#7AC455]" href="https://law.sarvam.ai">
            A1.
          </Link>
        </Text>
      )}

      <Text className="my-8 text-sm text-slate-400">
        Sarvam AI (Axonwise Private Limited), Bengaluru
      </Text>
    </Section>
  );
};

export default TemplateFooter;
