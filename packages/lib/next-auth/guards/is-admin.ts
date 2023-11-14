import { Role, User } from '@documenso/prisma/client';

export const isAdmin = (user: User) => user.roles.includes(Role.ADMIN);
