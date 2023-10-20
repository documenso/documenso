import * as ToggleGroup from '@radix-ui/react-toggle-group';
import { Monitor, MoonStar, Sun } from 'lucide-react';

interface IProps {
  theme?: string;
  // eslint-disable-next-line no-unused-vars
  setTheme: (theme: string) => void;
}

export const ThemeSwitcher = (props: IProps) => {
  const { theme, setTheme } = props;

  return (
    <ToggleGroup.Root
      className="themeSwitcher"
      type="single"
      value={theme}
      onValueChange={setTheme}
      aria-label="theme toggle"
      data-value={theme}
    >
      <ToggleGroup.Item className="themeSwitchButton" value="light" aria-label="light mode">
        <Sun className="h-5 w-5" />
      </ToggleGroup.Item>
      <ToggleGroup.Item className="themeSwitchButton" value="dark" aria-label="dark mode">
        <MoonStar className="h-5 w-5" />
      </ToggleGroup.Item>
      <ToggleGroup.Item className="themeSwitchButton" value="system" aria-label="system">
        <Monitor className="h-5 w-5" />
      </ToggleGroup.Item>
    </ToggleGroup.Root>
  );
};
