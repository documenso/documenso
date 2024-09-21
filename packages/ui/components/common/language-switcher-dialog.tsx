import { msg } from '@lingui/macro';
import { useLingui } from '@lingui/react';
import { CheckIcon } from 'lucide-react';

import { SUPPORTED_LANGUAGES } from '@documenso/lib/constants/i18n';
import { switchI18NLanguage } from '@documenso/lib/server-only/i18n/switch-i18n-language';
import { dynamicActivate } from '@documenso/lib/utils/i18n';
import { cn } from '@documenso/ui/lib/utils';
import {
  CommandDialog,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@documenso/ui/primitives/command';

type LanguageSwitcherDialogProps = {
  open: boolean;
  setOpen: (_open: boolean) => void;
};

export const LanguageSwitcherDialog = ({ open, setOpen }: LanguageSwitcherDialogProps) => {
  const { i18n, _ } = useLingui();

  const setLanguage = async (lang: string) => {
    setOpen(false);

    await dynamicActivate(i18n, lang);
    await switchI18NLanguage(lang);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder={_(msg`Search languages...`)} />

      <CommandList>
        <CommandGroup>
          {Object.values(SUPPORTED_LANGUAGES).map((language) => (
            <CommandItem
              key={language.short}
              value={language.full}
              onSelect={async () => setLanguage(language.short)}
            >
              <CheckIcon
                className={cn(
                  'mr-2 h-4 w-4',
                  i18n.locale === language.short ? 'opacity-100' : 'opacity-0',
                )}
              />
              {SUPPORTED_LANGUAGES[language.short].full}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
};
