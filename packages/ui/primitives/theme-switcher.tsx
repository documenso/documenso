import { motion } from 'framer-motion';
import { Monitor, MoonStar, Sun } from 'lucide-react';

import { useIsMounted } from '@documenso/lib/client-only/hooks/use-is-mounted';
import { cn } from '@documenso/ui/lib/utils';

type ThemeSwitcherProps = {
  theme?: string;
  setTheme: (_theme: string) => void;
};

export const ThemeSwitcher = ({ theme, setTheme }: ThemeSwitcherProps) => {
  const isMounted = useIsMounted();

  const variants = {
    light: { x: 0 },
    dark: { x: 'calc((2.15rem + 0.30rem) * 1)' },
    system: { x: 'calc((2rem + 0.5rem) * 2)' },
  };

  const getButtonClass = (currentTheme: 'light' | 'dark' | 'system') =>
    cn('z-10 flex h-8 w-10 items-center justify-center rounded-full text-gray-400', {
      'text-black dark:text-white': theme === currentTheme && isMounted,
    });

  return (
    <div className="relative flex items-center rounded-full bg-gray-200 p-1 dark:bg-stone-700">
      {isMounted && (
        <motion.div
          className="absolute h-8 w-10 rounded-full bg-white shadow-sm dark:bg-stone-600"
          initial={false}
          animate={theme}
          variants={variants}
          transition={{ duration: 0.2, ease: 'backInOut' }}
        ></motion.div>
      )}

      <button className={getButtonClass('light')} onClick={() => setTheme('light')}>
        <Sun className="h-5 w-5" />
      </button>

      <button className={getButtonClass('dark')} onClick={() => setTheme('dark')}>
        <MoonStar className="h-5 w-5" />
      </button>

      <button className={getButtonClass('system')} onClick={() => setTheme('system')}>
        <Monitor className="h-5 w-5" />
      </button>
    </div>
  );
};
