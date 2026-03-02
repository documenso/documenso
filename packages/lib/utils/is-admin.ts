import type { User } from '@documenso/prisma/client';
import { Role } from '@documenso/prisma/client';

export const isAdmin = (user: Pick<User, 'roles'>) => user.roles.includes(Role.ADMIN);
