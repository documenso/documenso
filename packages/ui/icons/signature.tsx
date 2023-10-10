import { forwardRef } from 'react';

import type { LucideIcon } from 'lucide-react/dist/lucide-react';

export const SignatureIcon: LucideIcon = forwardRef(
  (
    { size = 24, color = 'currentColor', strokeWidth = 1.33, absoluteStrokeWidth, ...props },
    ref,
  ) => {
    return (
      <svg
        ref={ref}
        width={size}
        height={size}
        viewBox="0 0 16 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        {...props}
      >
        <path
          d="M1.5 11H14.5M1.5 14C1.5 14 8.72 2 4.86938 2H4.875C2.01 2 1.97437 14.0694 8 6.51188V6.5C8 6.5 9 11.3631 11.5 7.52375V7.5C11.5 7.5 11.5 9 14.5 9"
          stroke={color}
          strokeWidth={
            absoluteStrokeWidth ? (Number(strokeWidth) * 24) / Number(size) : strokeWidth
          }
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  },
);

SignatureIcon.displayName = 'SignatureIcon';
