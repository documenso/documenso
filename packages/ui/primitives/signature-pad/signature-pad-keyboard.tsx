import { useEffect, useMemo, useRef, useState } from 'react';

import { cn } from '../../lib/utils';
import { KeyboardLayout, StrokeStyle, generatePath, getKeyboardLayout } from './keyboard-utils';

export type SignaturePadKeyboardProps = {
  className?: string;
  onChange: (_value: string) => void;
};

export const SignaturePadKeyboard = ({ className, onChange }: SignaturePadKeyboardProps) => {
  const [name, setName] = useState('');
  const [currentKeyboardLayout] = useState<KeyboardLayout>(KeyboardLayout.QWERTY);

  const curveType = 'linear';
  const includeNumbers = false;
  const strokeConfig = {
    style: StrokeStyle.SOLID,
    color: '#000000',
    gradientStart: '#ff6b6b',
    gradientEnd: '#4ecdc4',
    width: 3,
  };

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInputFocused = document.activeElement === inputRef.current;
      const isAnyInputFocused = document.activeElement?.tagName === 'INPUT';

      if (!isInputFocused && !isAnyInputFocused) {
        const regex = includeNumbers ? /^[a-zA-Z0-9]$/ : /^[a-zA-Z]$/;
        if (regex.test(e.key) || e.key === 'Backspace') {
          inputRef.current?.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [includeNumbers]);

  // Generate signature path
  const signaturePath = useMemo(() => {
    if (!name) return '';

    const points = [];
    const currentLayout = getKeyboardLayout(currentKeyboardLayout, includeNumbers);

    for (const char of name.toUpperCase()) {
      if (char in currentLayout) {
        const { x, y } = currentLayout[char];
        const yOffset = includeNumbers ? 100 : 40;
        points.push({ x: x * 60 + 28, y: y * 60 + yOffset });
      }
    }

    if (points.length === 0) return '';
    return generatePath(points, curveType);
  }, [name, currentKeyboardLayout, curveType, includeNumbers]);

  // Update parent component when signature changes
  useEffect(() => {
    if (signaturePath && name) {
      // Convert SVG to data URL for consistency with other signature types
      const svgData = generateSVGDataURL(signaturePath);
      onChange(svgData);
    } else {
      onChange('');
    }
  }, [signaturePath, name, onChange]);

  const generateSVGDataURL = (path: string): string => {
    const height = includeNumbers ? 260 : 200;
    const gradients =
      strokeConfig.style === StrokeStyle.GRADIENT
        ? `<linearGradient id="pathGradient" x1="0%" y1="0%" x2="100%" y2="0%">
           <stop offset="0%" style="stop-color:${strokeConfig.gradientStart};stop-opacity:1" />
           <stop offset="100%" style="stop-color:${strokeConfig.gradientEnd};stop-opacity:1" />
         </linearGradient>`
        : '';
    const strokeColor =
      strokeConfig.style === StrokeStyle.SOLID ? strokeConfig.color : 'url(#pathGradient)';

    const svgContent = `<svg width="650" height="${height}" xmlns="http://www.w3.org/2000/svg">
          <defs>${gradients}</defs>
          <path d="${path}" stroke="${strokeColor}" stroke-width="${strokeConfig.width}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>`;

    return `data:image/svg+xml;base64,${btoa(svgContent)}`;
  };

  return (
    <div className={cn('flex h-full w-full flex-col items-center justify-center', className)}>
      <input
        ref={inputRef}
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="sr-only"
        autoFocus
      />

      <div className="relative w-full max-w-lg">
        <svg
          className="pointer-events-none w-full"
          viewBox="0 0 650 200"
          preserveAspectRatio="xMidYMid meet"
          style={{ height: '150px' }}
        >
          <defs>
            {strokeConfig.style === StrokeStyle.GRADIENT && (
              <linearGradient id="pathGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor={strokeConfig.gradientStart} stopOpacity={1} />
                <stop offset="100%" stopColor={strokeConfig.gradientEnd} stopOpacity={1} />
              </linearGradient>
            )}
          </defs>

          {signaturePath && (
            <path
              d={signaturePath}
              stroke={
                strokeConfig.style === StrokeStyle.SOLID ? strokeConfig.color : 'url(#pathGradient)'
              }
              strokeWidth={strokeConfig.width}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
        </svg>
      </div>

      <div className="mt-4 w-full max-w-lg">
        <div className="text-muted-foreground/70 font-mono text-xs">{name}</div>
      </div>
    </div>
  );
};
