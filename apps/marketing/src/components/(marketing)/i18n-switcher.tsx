import { useState } from 'react';

import { msg } from '@lingui/macro';
import { useLingui } from '@lingui/react';
import { CheckIcon } from 'lucide-react';
import { LuLanguages } from 'react-icons/lu';

import { SUPPORTED_LANGUAGES } from '@documenso/lib/constants/i18n';
import { switchI18NLanguage } from '@documenso/lib/server-only/i18n/switch-i18n-language';
import { dynamicActivate } from '@documenso/lib/utils/i18n';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import {
  CommandDialog,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@documenso/ui/primitives/command';

type I18nSwitcherProps = {
  className?: string;
};

export const I18nSwitcher = ({ className }: I18nSwitcherProps) => {
  const { i18n, _ } = useLingui();

  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(i18n.locale);

  const setLanguage = async (lang: string) => {
    setValue(lang);
    setOpen(false);

    await dynamicActivate(i18n, lang);
    await switchI18NLanguage(lang);
  };

  return (
    <>
      <Button className={className} variant="ghost" onClick={() => setOpen(true)}>
        <LuLanguages className="mr-1.5 h-4 w-4" />
        {SUPPORTED_LANGUAGES[value]?.full || i18n.locale}
      </Button>

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
                    value === language.short ? 'opacity-100' : 'opacity-0',
                  )}
                />
                {SUPPORTED_LANGUAGES[language.short].full}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
};
