import { Link, Section, Text } from '@react-email/components';

export type TemplateFooterProps = {
  isDocument?: boolean;
};

export const TemplateFooter = ({ isDocument = true }: TemplateFooterProps) => {
  return (
    <Section>
      {isDocument && (
        <Text className="my-4 text-base text-slate-400">
          This document was sent using{' '}
          <Link className="text-[#7AC455]" href="https://documenso.com">
            Documenso.
          </Link>
        </Text>
      )}

      <Text className="my-8 text-sm text-slate-400">
        Documenso, Inc.
        <br />
        2261 Market Street, #5211, San Francisco, CA 94114, USA
      </Text>
    </Section>
  );
};

export default TemplateFooter;
