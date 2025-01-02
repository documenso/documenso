import { remixRoutesOptionAdapter } from '@react-router/remix-routes-option-adapter';
import { flatRoutes } from 'remix-flat-routes';

export default remixRoutesOptionAdapter((defineRoutes) => {
  return flatRoutes('routes', defineRoutes, {
    ignoredRouteFiles: ['**/.*'], // Ignore dot files (like .DS_Store)
    //appDir: 'app',
    //routeDir: 'routes',
    //basePath: '/',
    //paramPrefixChar: '$',
    //routeRegex: /(([+][\/\\][^\/\\:?*]+)|[\/\\]((index|route|layout|page)|(_[^\/\\:?*]+)|([^\/\\:?*]+\.route)))\.(ts|tsx|js|jsx|md|mdx)$$/,
  });
});
