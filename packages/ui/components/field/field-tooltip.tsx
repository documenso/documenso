import { TooltipArrow } from '@radix-ui/react-tooltip';
import { VariantProps, cva } from 'class-variance-authority';
import { createPortal } from 'react-dom';

import { useFieldPageCoords } from '@documenso/lib/client-only/hooks/use-field-page-coords';
import { cn } from '@documenso/ui/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@documenso/ui/primitives/tooltip';

import { Field } from '.prisma/client';

const tooltipVariants = cva('font-semibold', {
  variants: {
    color: {
      default: 'border-2 fill-white',
      warning: 'border-0 bg-orange-300 fill-orange-300 text-orange-900',
    },
  },
  defaultVariants: {
    color: 'default',
  },
});

interface FieldToolTipProps extends VariantProps<typeof tooltipVariants> {
  children: React.ReactNode;
  className?: string;
  field: Field;
}

/**
 * Renders a tooltip for a given field.
 */
export function FieldToolTip({ children, color, className = '', field }: FieldToolTipProps) {
  const coords = useFieldPageCoords(field);

  return createPortal(
    <div
      className={cn('absolute')}
      style={{
        top: `${coords.y}px`,
        left: `${coords.x}px`,
        height: `${coords.height}px`,
        width: `${coords.width}px`,
      }}
    >
      <TooltipProvider>
        <Tooltip delayDuration={0} open={!field.inserted}>
          <TooltipTrigger className="absolute inset-0 w-full"></TooltipTrigger>

          <TooltipContent className={tooltipVariants({ color, className })} sideOffset={2}>
            {children}
            <TooltipArrow />
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>,
    document.body,
  );
}
