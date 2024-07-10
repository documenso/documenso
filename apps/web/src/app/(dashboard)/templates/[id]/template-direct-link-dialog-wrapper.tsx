'use client';

import React, { useState } from 'react';

import { LinkIcon } from 'lucide-react';

import type { Recipient, Template, TemplateDirectLink } from '@documenso/prisma/client';
import { Button } from '@documenso/ui/primitives/button';

import { TemplateDirectLinkDialog } from '../template-direct-link-dialog';

export type TemplatePageViewProps = {
  template: Template & { directLink?: TemplateDirectLink | null; Recipient: Recipient[] };
};

export const TemplateDirectLinkDialogWrapper = ({ template }: TemplatePageViewProps) => {
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
        {template.directLink ? 'Manage' : 'Create'} Direct Link
      </Button>

      <TemplateDirectLinkDialog
        template={template}
        open={isTemplateDirectLinkOpen}
        onOpenChange={setTemplateDirectLinkOpen}
      />
    </div>
  );
};
