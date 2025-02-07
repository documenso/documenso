import { useState } from 'react';

import { Trans } from '@lingui/react/macro';
import type { Recipient, Template, TemplateDirectLink } from '@prisma/client';
import { LinkIcon } from 'lucide-react';

import { Button } from '@documenso/ui/primitives/button';

import { TemplateDirectLinkDialog } from '~/components/dialogs/template-direct-link-dialog';

export type TemplateDirectLinkDialogWrapperProps = {
  template: Template & { directLink?: TemplateDirectLink | null; recipients: Recipient[] };
};

export const TemplateDirectLinkDialogWrapper = ({
  template,
}: TemplateDirectLinkDialogWrapperProps) => {
  const [isTemplateDirectLinkOpen, setTemplateDirectLinkOpen] = useState(false);

  return (
    <div>
      <Button
        variant="outline"
        className="px-3"
        onClick={(e) => {
          e.preventDefault();
          setTemplateDirectLinkOpen(true);
        }}
      >
        <LinkIcon className="mr-1.5 h-3.5 w-3.5" />

        {template.directLink ? (
          <Trans>Manage Direct Link</Trans>
        ) : (
          <Trans>Create Direct Link</Trans>
        )}
      </Button>

      <TemplateDirectLinkDialog
        template={template}
        open={isTemplateDirectLinkOpen}
        onOpenChange={setTemplateDirectLinkOpen}
      />
    </div>
  );
};
