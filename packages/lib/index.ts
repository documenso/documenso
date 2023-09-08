import { Role, User } from '@documenso/prisma/client';

const isAdmin = (user: User) => user.roles.includes(Role.ADMIN);

export { isAdmin };
