import { Trans } from '@lingui/react/macro';

import { Section, Text } from '../components';
import { useBranding } from '../providers/branding';

export type TemplateFooterProps = {
  isDocument?: boolean;
};

export const TemplateFooter = ({ isDocument = true }: TemplateFooterProps) => {
  const branding = useBranding();

  return (
    <Section>
      {isDocument && !branding.brandingHidePoweredBy && (
        <Text className="my-4 text-base text-slate-400">
          <Trans>This document was sent using RJUSL Signing .</Trans>
        </Text>
      )}

      {branding.brandingEnabled && branding.brandingCompanyDetails && (
        <Text className="my-8 text-sm text-slate-400">
          {branding.brandingCompanyDetails.split('\n').map((line, idx) => {
            return (
              <>
                {idx > 0 && <br />}
                {line}
              </>
            );
          })}
        </Text>
      )}

      {!branding.brandingEnabled && (
        <Text className="my-8 text-sm text-slate-400">RJ Utility Services Ltd</Text>
      )}
    </Section>
  );
};

export default TemplateFooter;
