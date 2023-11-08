import handlerFeatureFlagGet from '@documenso/lib/server-only/feature-flags/get';

export const config = {
  runtime: 'edge',
};

export default handlerFeatureFlagGet;
