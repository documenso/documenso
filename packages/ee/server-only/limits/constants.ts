<<<<<<< HEAD
import { TLimitsSchema } from './schema';
=======
import type { TLimitsSchema } from './schema';
>>>>>>> main

export const FREE_PLAN_LIMITS: TLimitsSchema = {
  documents: 5,
  recipients: 10,
};

<<<<<<< HEAD
=======
export const TEAM_PLAN_LIMITS: TLimitsSchema = {
  documents: Infinity,
  recipients: Infinity,
};

>>>>>>> main
export const SELFHOSTED_PLAN_LIMITS: TLimitsSchema = {
  documents: Infinity,
  recipients: Infinity,
};
