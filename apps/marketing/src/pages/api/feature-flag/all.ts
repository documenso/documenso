import handlerFeatureFlagAll from '@documenso/lib/server-only/feature-flags/all';

export const config = {
  runtime: 'edge',
};

export default handlerFeatureFlagAll;
