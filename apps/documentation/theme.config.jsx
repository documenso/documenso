const themeConfig = {
  logo: <span>Documenso Documentation</span>,
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
          Documenso
        </a>
        .
      </span>
    ),
  },
  primaryHue: 100,
  primarySaturation: 48.47,
};

export default themeConfig;
