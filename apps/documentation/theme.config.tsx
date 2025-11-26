import type { DocsThemeConfig } from 'nextra-theme-docs';
import { useConfig } from 'nextra-theme-docs';

const themeConfig: DocsThemeConfig = {
  logo: <span>Documenso</span>,
  head: function useHead() {
    const config = useConfig();

    const title = `${config.frontMatter.title} | Documenso Docs` || 'Documenso Docs';
    const description = config.frontMatter.description || 'The official Documenso documentation';

    return (
      <>
        <meta httpEquiv="Content-Language" content="en" />
        <title>{title}</title>
        <meta name="title" content={title} />
        <meta name="og:title" content={title} />
        <meta name="description" content={description} />
        <meta name="og:description" content={description} />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
            !function(){
             if (location.hostname === 'localhost') return;
              var e="6c236490c9a68c1",
                  t=function(){Reo.init({ clientID: e })},
                  n=document.createElement("script");
              n.src="https://static.reo.dev/"+e+"/reo.js";
              n.defer=true;
              n.onload=t;
              document.head.appendChild(n);
            }();
          `,
          }}
        />
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
    content: (
      <span>
        {new Date().getFullYear()} ©{' '}
        <a href="https://documen.so" target="_blank">
          Documenso
        </a>
        .
      </span>
    ),
  },
  color: {
    hue: 100,
    saturation: 48.47,
  },
};

export default themeConfig;
