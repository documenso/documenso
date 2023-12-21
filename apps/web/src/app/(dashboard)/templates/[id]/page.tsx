import React from 'react';

import Link from 'next/link';
import { redirect } from 'next/navigation';

import { ChevronLeft } from 'lucide-react';

import { getRequiredServerComponentSession } from '@documenso/lib/next-auth/get-server-component-session';
import { getFieldsForTemplate } from '@documenso/lib/server-only/field/get-fields-for-template';
import { getRecipientsForTemplate } from '@documenso/lib/server-only/recipient/get-recipients-for-template';
import { getTemplateById } from '@documenso/lib/server-only/template/get-template-by-id';

import { TemplateType } from '~/components/formatter/template-type';

import { EditTemplateForm } from './edit-template';

export type TemplatePageProps = {
  params: {
    id: string;
  };
};

export default async function TemplatePage({ params }: TemplatePageProps) {
  const { id } = params;

  const templateId = Number(id);

  if (!templateId || Number.isNaN(templateId)) {
    redirect('/documents');
  }

  const { user } = await getRequiredServerComponentSession();

  const template = await getTemplateById({
    id: templateId,
    userId: user.id,
  }).catch(() => null);

  if (!template || !template.templateDocumentData) {
    redirect('/documents');
  }

  const { templateDocumentData } = template;

  const [templateRecipients, templateFields] = await Promise.all([
    getRecipientsForTemplate({
      templateId,
      userId: user.id,
    }),
    getFieldsForTemplate({
      templateId,
      userId: user.id,
    }),
  ]);

  return (
    <div className="mx-auto max-w-screen-xl px-4 md:px-8">
      <Link href="/templates" className="flex items-center text-[#7AC455] hover:opacity-80">
        <ChevronLeft className="mr-2 inline-block h-5 w-5" />
        Templates
      </Link>

      <h1 className="mt-4 truncate text-2xl font-semibold md:text-3xl" title={template.title}>
        {template.title}
      </h1>

      <div className="mt-2.5 flex items-center gap-x-6">
        <TemplateType inheritColor type={template.type} className="text-muted-foreground" />
      </div>

      <EditTemplateForm
        className="mt-8"
        template={template}
        user={user}
        recipients={templateRecipients}
        fields={templateFields}
        documentData={templateDocumentData}
      />
    </div>
  );
}
