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
    dark: { x: 'calc((2.15rem + 0.25rem) * 1)' },
    system: { x: 'calc((2rem + 0.5rem) * 2)' },
  };

  return (
    <div
      className={`relative flex items-center rounded-full p-1 ${
        theme === 'dark' ? 'bg-gray-300' : 'bg-gray-200'
      }`}
    >
      <motion.div
        className="absolute h-8 w-10 rounded-full bg-white shadow-sm"
        initial={false}
        animate={theme}
        variants={variants}
        transition={{ duration: 0.15 }}
      ></motion.div>
      <button
        className="z-10 flex h-8 w-10 items-center justify-center rounded-full"
        onClick={() => setTheme('light')}
      >
        <Sun className="h-5 w-5" />
      </button>
      <button
        className="z-10 flex h-8 w-10 items-center justify-center rounded-full"
        onClick={() => setTheme('dark')}
      >
        <MoonStar className="h-5 w-5" />
      </button>
      <button
        className="z-10 flex h-8 w-10 items-center justify-center rounded-full"
        onClick={() => setTheme('system')}
      >
        <Monitor className="h-5 w-5" />
      </button>
    </div>
  );
};

export default ThemeSwitcher;
