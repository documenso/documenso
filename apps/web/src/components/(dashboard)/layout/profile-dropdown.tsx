'use client';

import Link from 'next/link';

import { CreditCard, Github, Key, LogOut, User as LucideUser } from 'lucide-react';
import { signOut } from 'next-auth/react';

import { IS_SUBSCRIPTIONS_ENABLED } from '@documenso/lib/constants/features';
import { User } from '@documenso/prisma/client';
import { Avatar, AvatarFallback } from '@documenso/ui/primitives/avatar';
import { Button } from '@documenso/ui/primitives/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@documenso/ui/primitives/dropdown-menu';

export type ProfileDropdownProps = {
  user: User;
};

export const ProfileDropdown = ({ user }: ProfileDropdownProps) => {
  const initials =
    user.name
      ?.split(' ')
      .map((name) => name.slice(0, 1).toUpperCase())
      .slice(0, 2)
      .join('') ?? 'UK';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-10 w-10 rounded-full">
          <Avatar className="h-10 w-10">
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel>Account</DropdownMenuLabel>

        <DropdownMenuItem asChild>
          <Link href="/settings/profile" className="cursor-pointer">
            <LucideUser className="mr-2 h-4 w-4" />
            Profile
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem asChild>
          <Link href="/settings/password" className="cursor-pointer">
            <Key className="mr-2 h-4 w-4" />
            Password
          </Link>
        </DropdownMenuItem>

        {IS_SUBSCRIPTIONS_ENABLED && (
          <DropdownMenuItem asChild>
            <Link href="/settings/billing" className="cursor-pointer">
              <CreditCard className="mr-2 h-4 w-4" />
              Billing
            </Link>
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link href="https://github.com/documenso/documenso" className="cursor-pointer">
            <Github className="mr-2 h-4 w-4" />
            Star on Github
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onSelect={() =>
            signOut({
              callbackUrl: '/',
            })
          }
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
