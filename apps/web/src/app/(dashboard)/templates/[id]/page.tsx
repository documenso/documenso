import React from 'react';

export type TemplatePageProps = {
  params: {
    id: string;
  };
};

export default function TemplatePage({ params }: TemplatePageProps) {
  const { id } = params;

  return <div>Template, {id}</div>;
}
