import { type TCssVarsSchema, toNativeCssVars } from './css-vars';

export const injectCss = (options: { css?: string; cssVars?: TCssVarsSchema }) => {
  const { css, cssVars } = options;

  if (css) {
    const style = document.createElement('style');
    style.innerHTML = css;

    document.head.appendChild(style);
  }

  if (cssVars) {
    const nativeVars = toNativeCssVars(cssVars);

    for (const [key, value] of Object.entries(nativeVars)) {
      document.documentElement.style.setProperty(key, value);
    }
  }
};
