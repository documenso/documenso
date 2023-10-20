import React, { FC } from 'react';

import { motion } from 'framer-motion';
import { Monitor, MoonStar, Sun } from 'lucide-react';

interface ThemeSwitcherProps {
  theme?: string;
  // eslint-disable-next-line no-unused-vars
  setTheme: (theme: string) => void;
}

const ThemeSwitcher: FC<ThemeSwitcherProps> = ({ theme, setTheme }) => {
  const variants = {
    light: { x: 0 },
    dark: { x: 'calc((2.15rem + 0.30rem) * 1)' },
    system: { x: 'calc((2rem + 0.5rem) * 2)' },
  };

  const getIconColor = (currentTheme: 'light' | 'dark' | 'system') =>
    theme === currentTheme ? 'text-black dark:text-white' : 'text-gray-400';

  return (
    <div
      className={`relative flex items-center rounded-full bg-gray-200 p-1 dark:bg-stone-700 ${
        theme === 'dark' ? 'dark' : ''
      }`}
    >
      <motion.div
        className="absolute h-8 w-10 rounded-full bg-white shadow-sm dark:bg-stone-600"
        initial={false}
        animate={theme}
        variants={variants}
        transition={{ duration: 0.2 }}
      ></motion.div>
      <button
        className={`z-10 flex h-8 w-10 items-center justify-center rounded-full ${getIconColor(
          'light',
        )}`}
        onClick={() => setTheme('light')}
      >
        <Sun className="h-5 w-5" />
      </button>
      <button
        className={`z-10 flex h-8 w-10 items-center justify-center rounded-full ${getIconColor(
          'dark',
        )}`}
        onClick={() => setTheme('dark')}
      >
        <MoonStar className="h-5 w-5" />
      </button>
      <button
        className={`z-10 flex h-8 w-10 items-center justify-center rounded-full ${getIconColor(
          'system',
        )}`}
        onClick={() => setTheme('system')}
      >
        <Monitor className="h-5 w-5" />
      </button>
    </div>
  );
};

export default ThemeSwitcher;
