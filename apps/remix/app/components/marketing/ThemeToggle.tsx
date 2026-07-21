import { Button } from '@documenso/ui/primitives/button';
import { Moon, Sun } from 'lucide-react';
import { Theme, useTheme } from 'remix-themes';

export function ThemeToggle() {
  const [theme, setTheme] = useTheme();
  const isDark = theme === Theme.DARK;

  return (
    <Button
      variant="outline"
      size="default"
      className="h-9 w-9 px-0"
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={() => setTheme(isDark ? Theme.LIGHT : Theme.DARK)}
    >
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  );
}
