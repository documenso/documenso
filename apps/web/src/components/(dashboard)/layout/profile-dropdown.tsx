'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { usePathname } from 'next/navigation';

import i18nConfig from 'i18nConfig';
import {
  CreditCard,
  FileSpreadsheet,
  Languages,
  Lock,
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
import { useTranslation } from 'react-i18next';
import { LuGithub } from 'react-icons/lu';

import { useFeatureFlags } from '@documenso/lib/client-only/providers/feature-flag';
import { isAdmin } from '@documenso/lib/next-auth/guards/is-admin';
import { recipientInitials } from '@documenso/lib/utils/recipient-formatter';
import type { User } from '@documenso/prisma/client';
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
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const currentPathname = usePathname();

  const isBillingEnabled = getFlag('app_billing');

  const avatarFallback = user.name
    ? recipientInitials(user.name)
    : user.email.slice(0, 1).toUpperCase();

  const handleLocaleChange = (value: string) => {
    const newLocale = value;
    const currentLocale = i18n.language;
    const days = 30;
    const date = new Date();
    date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
    const expires = date.toUTCString();
    document.cookie = `NEXT_LOCALE=${newLocale};expires=${expires};path=/`;
    if (currentPathname) {
      if (currentLocale === i18nConfig.defaultLocale) {
        router.push('/' + newLocale + currentPathname);
      } else {
        router.push(currentPathname.replace(`/${currentLocale}`, `/${newLocale}`));
      }
    }

    router.refresh();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          title="Profile Dropdown"
          className="relative h-10 w-10 rounded-full"
        >
          <Avatar className="h-10 w-10">
            <AvatarFallback>{avatarFallback}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent className="z-[60] w-56" align="end" forceMount>
        <DropdownMenuLabel>{t('account')}</DropdownMenuLabel>

        {isUserAdmin && (
          <>
            <DropdownMenuItem asChild>
              <Link href="/admin" className="cursor-pointer">
                <UserCog className="mr-2 h-4 w-4" />
                {t('admin')}
              </Link>
            </DropdownMenuItem>

            <DropdownMenuSeparator />
          </>
        )}

        <DropdownMenuItem asChild>
          <Link href="/settings/profile" className="cursor-pointer">
            <LucideUser className="mr-2 h-4 w-4" />
            {t('profile')}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings/security" className="cursor-pointer">
            <Lock className="mr-2 h-4 w-4" />
            {t('security')}
          </Link>
        </DropdownMenuItem>

        {isBillingEnabled && (
          <DropdownMenuItem asChild>
            <Link href="/settings/billing" className="cursor-pointer">
              <CreditCard className="mr-2 h-4 w-4" />
              {t('billing')}
            </Link>
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/templates" className="cursor-pointer">
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            {t('templates')}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />

        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Palette className="mr-2 h-4 w-4" />
            {t('themes')}
          </DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent className="z-[60]">
              <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
                <DropdownMenuRadioItem value="light">
                  <Sun className="mr-2 h-4 w-4" /> {t('light')}
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="dark">
                  <Moon className="mr-2 h-4 w-4" />
                  {t('dark"')}
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="system">
                  <Monitor className="mr-2 h-4 w-4" />
                  {t('system')}
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Languages className="mr-2 h-4 w-4" />
            {t('language')}
          </DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent className="z-[60]">
              <DropdownMenuRadioGroup value={i18n.language} onValueChange={handleLocaleChange}>
                <DropdownMenuRadioItem value="en">English</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="es">Spanish</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="de">German</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="fr">French</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="it">Italian</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="pt">Portuguese</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link
            href="https://github.com/documenso/documenso"
            className="cursor-pointer"
            target="_blank"
          >
            <LuGithub className="mr-2 h-4 w-4" />
            {t('star_on_github')}
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onSelect={() =>
            void signOut({
              callbackUrl: '/',
            })
          }
        >
          <LogOut className="mr-2 h-4 w-4" />
          {t('sign_out')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
