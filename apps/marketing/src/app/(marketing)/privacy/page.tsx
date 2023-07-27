import { useMDXComponent } from 'next-contentlayer/hooks';

import privacy from '~/../.contentlayer/generated/Privacy/privacy.mdx.json';

export const generateMetadata = () => {
  return { title: `Documenso - ${privacy.title}` };
};

export default function PrivacyPage() {
  const MDXContent = useMDXComponent(privacy.body.code);

  return <MDXContent />;
}
