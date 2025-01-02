import { createThemeAction } from 'remix-themes';

import { themeSessionResolver } from '~/storage/theme-session.server';

export const action = createThemeAction(themeSessionResolver);
