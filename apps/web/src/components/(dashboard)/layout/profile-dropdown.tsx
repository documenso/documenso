'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';

import {
  CreditCard,
  Key,
  LogOut,
  User as LucideUser,
  Monitor,
  Moon,
  Palette,
  Sun,
  UserCog,
} from 'lucide-react';
import { signOut } from 'next-auth/react';
import { useTheme } from 'next-themes';

import { useFeatureFlags } from '@documenso/lib/client-only/providers/feature-flag';
import { isAdmin } from '@documenso/lib/next-auth/guards/is-admin';
import { recipientInitials } from '@documenso/lib/utils/recipient-formatter';
import { User } from '@documenso/prisma/client';
import { useTranslation } from '@documenso/ui/i18n/client';
import { LocaleTypes } from '@documenso/ui/i18n/settings';
import { Avatar, AvatarFallback } from '@documenso/ui/primitives/avatar';
import { Button } from '@documenso/ui/primitives/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@documenso/ui/primitives/dropdown-menu';

export type ProfileDropdownProps = {
  user: User;
};

export const ProfileDropdown = ({ user }: ProfileDropdownProps) => {
  const { getFlag } = useFeatureFlags();
  const { theme, setTheme } = useTheme();
  const isUserAdmin = isAdmin(user);
  const locale = useParams()?.locale as LocaleTypes;
  const { t } = useTranslation(locale, 'dashboard');
  const isBillingEnabled = getFlag('app_billing');

  const avatarFallback = user.name
    ? recipientInitials(user.name)
    : user.email.slice(0, 1).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-10 w-10 rounded-full">
          <Avatar className="h-10 w-10">
            <AvatarFallback>{avatarFallback}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel>{t(`account`)}</DropdownMenuLabel>

        {isUserAdmin && (
          <>
            <DropdownMenuItem asChild>
              <Link href={`/${locale}/admin`} className="cursor-pointer">
                <UserCog className="mr-2 h-4 w-4" />
                {t(`admin`)}
              </Link>
            </DropdownMenuItem>

            <DropdownMenuSeparator />
          </>
        )}

        <DropdownMenuItem asChild>
          <Link href={`/${locale}/settings/profile`} className="cursor-pointer">
            <LucideUser className="mr-2 h-4 w-4" />
            {t(`profile`)}
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem asChild>
          <Link href={`/${locale}/settings/password`} className="cursor-pointer">
            <Key className="mr-2 h-4 w-4" />
            {t(`password`)}
          </Link>
        </DropdownMenuItem>

        {isBillingEnabled && (
          <DropdownMenuItem asChild>
            <Link href={`/${locale}/settings/billing`} className="cursor-pointer">
              <CreditCard className="mr-2 h-4 w-4" />
              {t(`billing`)}
            </Link>
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />

        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Palette className="mr-2 h-4 w-4" />
            {t(`themes`)}
          </DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent>
              <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
                <DropdownMenuRadioItem value="light">
                  <Sun className="mr-2 h-4 w-4" /> Light
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="dark">
                  <Moon className="mr-2 h-4 w-4" />
                  Dark
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="system">
                  <Monitor className="mr-2 h-4 w-4" />
                  System
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>
        <DropdownMenuSeparator />

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onSelect={() =>
            void signOut({
              callbackUrl: '/',
            })
          }
        >
          <LogOut className="mr-2 h-4 w-4" />
          {t(`sign-out`)}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
