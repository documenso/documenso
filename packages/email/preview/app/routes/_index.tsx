import { redirect } from 'react-router';

import { templates } from '../lib/templates';

/**
 * The index has no UI of its own — redirect to the first template so the
 * preview always opens on something.
 */
export const loader = () => {
  const firstSlug = Object.keys(templates)[0];

  return redirect(`/${firstSlug}`);
};
