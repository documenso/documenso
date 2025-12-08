import { useEffect, useState } from 'react';

import { SearchIcon } from 'lucide-react';

import { cn } from '@documenso/ui/lib/utils';

export type AnimatedDocumentScannerProps = {
  className?: string;
  interval?: number;
};

export const AnimatedDocumentScanner = ({
  className,
  interval = 2500,
}: AnimatedDocumentScannerProps) => {
  const [magPosition, setMagPosition] = useState({ x: 0, y: 0, page: 0 });

  useEffect(() => {
    const moveInterval = setInterval(() => {
      setMagPosition({
        x: Math.random() * 60 - 30,
        y: Math.random() * 50 - 25,
        page: Math.random() > 0.5 ? 1 : 0,
      });
    }, interval);

    return () => clearInterval(moveInterval);
  }, [interval]);

  return (
    <div className={cn('relative mx-auto h-36 w-56', className)}>
      {/* Magnifying glass */}
      <div
        className="pointer-events-none absolute z-50 transition-all duration-1000 ease-in-out"
        style={{
          left: magPosition.page === 0 ? '25%' : '75%',
          top: '50%',
          transform: `translate(calc(-50% + ${magPosition.x}px), calc(-50% + ${magPosition.y}px))`,
        }}
      >
        <SearchIcon className="h-8 w-8 text-foreground" />
      </div>

      {/* Book container */}
      <div className="relative h-full w-full animate-pulse" style={{ perspective: '800px' }}>
        <div className="relative h-full w-full" style={{ transformStyle: 'preserve-3d' }}>
          {/* Left page */}
          <div
            className="absolute left-0 top-0 h-full w-[calc(50%)] origin-right overflow-hidden rounded-l-md border border-border bg-card shadow-md"
            style={{ transform: 'rotateY(15deg) skewY(-1deg)' }}
          >
            <div className="absolute inset-3 space-y-2">
              <div className="h-1.5 w-3/4 rounded-sm bg-muted" />
              <div className="h-1.5 w-full rounded-sm bg-muted" />
              <div className="h-1.5 w-5/6 rounded-sm bg-muted" />
              <div className="h-1.5 w-2/3 rounded-sm bg-muted" />
              <div className="mt-3 h-6 w-3/4 rounded border border-dashed border-primary" />
            </div>
          </div>

          {/* Right page */}
          <div
            className="absolute right-0 top-0 h-full w-[calc(50%)] origin-left overflow-hidden rounded-r-md border border-border bg-card shadow-md"
            style={{ transform: 'rotateY(-15deg) skewY(1deg)' }}
          >
            <div className="absolute inset-3 space-y-2">
              <div className="h-1.5 w-full rounded-sm bg-muted" />
              <div className="h-1.5 w-4/5 rounded-sm bg-muted" />
              <div className="h-1.5 w-full rounded-sm bg-muted" />
              <div className="h-1.5 w-3/5 rounded-sm bg-muted" />
              <div className="mt-3 h-6 w-2/3 rounded border border-dashed border-primary" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
