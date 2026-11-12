import { cn } from '@documenso/ui/lib/utils';
import { useNavigation } from 'react-router';

export const NavigationProgress = () => {
  const navigation = useNavigation();

  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none fixed inset-x-0 top-0 z-[70] h-0.5 origin-left bg-primary',
        // The delay keeps the bar out of sight on navigations that finish quickly.
        navigation.state === 'idle'
          ? 'scale-x-0 transition-none'
          : 'scale-x-90 transition-transform delay-150 ease-out',
      )}
      // Tailwind cannot generate `duration-[10s]`: tailwindcss-animate also defines `duration-*`.
      style={{ transitionDuration: '10s' }}
    />
  );
};
