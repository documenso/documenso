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
          <Link className="text-[#6414DB]" href="https://app.businesskitz.com">
            Businesskitz.
          </Link>
        </Text>
      )}

      <Text className="my-8 text-sm text-slate-400">
        Businesskitz, Inc.
        <br />
        Level 2/310 Edward St, Brisbane City QLD 4000, Australia
      </Text>
    </Section>
  );
};

export default TemplateFooter;
