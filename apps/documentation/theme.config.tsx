import type { DocsThemeConfig } from 'nextra-theme-docs';
import { useConfig } from 'nextra-theme-docs';

const themeConfig: DocsThemeConfig = {
  logo: <span>Maddocs</span>,
  head: function useHead() {
    const config = useConfig<{ title?: string; description?: string }>();

    const title = `${config.frontMatter.title} | Maddocs Docs` || 'Maddocs Docs';
    const description = config.frontMatter.description || 'The official Maddocs documentation';

    return (
      <>
        <meta httpEquiv="Content-Language" content="en" />
        <meta name="title" content={title} />
        <meta name="og:title" content={title} />
        <meta name="description" content={description} />
        <meta name="og:description" content={description} />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
      </>
    );
  },
  project: {
    link: 'https://documen.so/github',
  },
  chat: {
    link: 'https://documen.so/discord',
  },
  docsRepositoryBase: 'https://github.com/documenso/documenso/tree/main/apps/documentation',
  footer: {
    text: (
      <span>
        {new Date().getFullYear()} ©{' '}
        <a href="https://documen.so" target="_blank">
          Maddocs
        </a>
        .
      </span>
    ),
  },
  primaryHue: 75,
  primarySaturation: 100,
  useNextSeoProps() {
    return {
      titleTemplate: '%s | Maddocs Docs',
    };
  },
};

export default themeConfig;
