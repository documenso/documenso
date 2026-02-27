import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { LLMCopyButton, ViewOptions } from '@/components/ai/page-actions';
import { getPageImage, source } from '@/lib/source';
import { getMDXComponents } from '@/mdx-components';
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from 'fumadocs-ui/layouts/docs/page';

const gitConfig = {
  user: 'documenso',
  repo: 'documenso',
  branch: 'main',
  contentPath: 'apps/docs/content/docs',
};

export default async function Page(props: PageProps<'/docs/[[...slug]]'>) {
  const params = await props.params;
  const page = source.getPage(params.slug);

  if (!page) {
    notFound();
  }

  const MDX = page.data.body;

  return (
    <DocsPage toc={page.data.toc} full={page.data.full}>
      {!page.data.full && (
        <>
          <DocsTitle>{page.data.title}</DocsTitle>
          <DocsDescription className="mb-0">{page.data.description}</DocsDescription>
          <div className="flex flex-row items-center gap-2 border-b pb-6">
            <LLMCopyButton markdownUrl={`${page.url}.mdx`} />
            <ViewOptions
              markdownUrl={`${page.url}.mdx`}
              githubUrl={`https://github.com/${gitConfig.user}/${gitConfig.repo}/blob/${gitConfig.branch}/${gitConfig.contentPath}/${page.path}`}
            />
          </div>
        </>
      )}
      <DocsBody>
        <MDX components={getMDXComponents()} />
      </DocsBody>
    </DocsPage>
  );
}

export function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata(props: PageProps<'/docs/[[...slug]]'>): Promise<Metadata> {
  const params = await props.params;
  const page = source.getPage(params.slug);

  if (!page) {
    notFound();
  }

  return {
    title: page.data.title,
    description: page.data.description,
    openGraph: {
      images: getPageImage(page).url,
    },
  };
}
