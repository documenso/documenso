import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { CheckIcon } from 'lucide-react';

import { SUPPORTED_LANGUAGES } from '@documenso/lib/constants/i18n';
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

    await dynamicActivate(lang);

    const formData = new FormData();

    formData.append('lang', lang);

    await fetch('/api/locale', {
      method: 'post',
      body: formData,
    });
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder={_(msg`Search languages...`)} />

      <CommandList>
        <CommandGroup>
          {Object.entries(SUPPORTED_LANGUAGES).map(([code, language]) => (
            <CommandItem
              key={code}
              value={language.nativeName || _(language.name)}
              onSelect={async () => setLanguage(code)}
            >
              <CheckIcon
                className={cn(
                  'mr-2 h-4 w-4',
                  i18n.locale === code ? 'opacity-100' : 'opacity-0',
                )}
              />
              {language.nativeName || _(language.name)}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
};
