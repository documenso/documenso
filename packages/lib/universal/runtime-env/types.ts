import { PickStartsWith } from '../../types/pick-starts-with';

export type PublicEnv = PickStartsWith<typeof process.env, 'NEXT_PUBLIC_'>;
