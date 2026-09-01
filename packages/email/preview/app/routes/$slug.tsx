import { data } from 'react-router';

import { EmailPlayground } from '../components/playground';
import { getDefaultProps, getTemplate } from '../lib/templates';
import type { Route } from './+types/$slug';

export const loader = ({ params }: Route.LoaderArgs) => {
  const { slug } = params;
  const template = getTemplate(slug);

  if (!template) {
    throw data(`Unknown template: ${slug}`, { status: 404 });
  }

  return {
    slug,
    templateName: template.name,
    fields: template.fields,
    defaultProps: getDefaultProps(template.fields),
  };
};

export const meta = ({ data: loaderData }: Route.MetaArgs) => {
  if (!loaderData) {
    return [{ title: 'Not found — Email Preview' }];
  }

  return [{ title: `${loaderData.templateName} — Email Preview` }];
};

const TemplatePage = ({ loaderData }: Route.ComponentProps) => {
  return <EmailPlayground slug={loaderData.slug} fields={loaderData.fields} defaultProps={loaderData.defaultProps} />;
};

export default TemplatePage;
