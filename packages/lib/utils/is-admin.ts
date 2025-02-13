import type { User } from '@prisma/client';
import { Role } from '@prisma/client';

export const isAdmin = (user: Pick<User, 'roles'>) => user.roles.includes(Role.ADMIN);
