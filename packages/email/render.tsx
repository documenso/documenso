import * as reactEmail from '@react-email/render';

import config from '@documenso/tailwind-config';

import { Tailwind } from './components';

export const render: typeof reactEmail.render = (element, options) => {
  return reactEmail.render(
    <Tailwind
      config={{
        theme: {
          extend: {
            colors: config.theme.extend.colors,
          },
        },
      }}
    >
      {element}
    </Tailwind>,
    options,
  );
};

export const renderAsync: typeof reactEmail.renderAsync = async (element, options) => {
  return reactEmail.renderAsync(
    <Tailwind
      config={{
        theme: {
          extend: {
            colors: config.theme.extend.colors,
          },
        },
      }}
    >
      {element}
    </Tailwind>,
    options,
  );
};
