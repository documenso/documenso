import { index, type RouteConfig, route } from '@react-router/dev/routes';

export default [
  index('routes/_index.tsx'),
  route('api/render', 'routes/api.render.tsx'),
  route(':slug', 'routes/$slug.tsx'),
] satisfies RouteConfig;
