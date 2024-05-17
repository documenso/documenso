'use client';

import React, { useState } from 'react';

import { LinkIcon } from 'lucide-react';

import type { Recipient, Template, TemplateDirectAccess } from '@documenso/prisma/client';
import { Button } from '@documenso/ui/primitives/button';

import { DirectTemplateAccessDialog } from '../direct-template-access-dialog';

export type TemplatePageViewProps = {
  template: Template & { access?: TemplateDirectAccess | null; Recipient: Recipient[] };
};

export const DirectTemplateAccessDialogWrapper = ({ template }: TemplatePageViewProps) => {
  const [isDirectTemplateAccessOpen, setDirectTemplateAccessOpen] = useState(false);

  return (
    <div>
      <Button
        variant="outline"
        className="px-3"
        onClick={(e) => {
          e.preventDefault();
          setDirectTemplateAccessOpen(true);
        }}
      >
        <LinkIcon className="mr-1.5 h-3.5 w-3.5" />
        {template.access ? 'Manage' : 'Create'} Direct link
      </Button>

      <DirectTemplateAccessDialog
        template={template}
        open={isDirectTemplateAccessOpen}
        onOpenChange={setDirectTemplateAccessOpen}
      />
    </div>
  );
};
