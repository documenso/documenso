import type { Field } from '@prisma/client';
import { TooltipArrow } from '@radix-ui/react-tooltip';
import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';

import { cn } from '../../lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../primitives/tooltip';
import { useFieldPageCoords } from './use-field-page-coords';

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

interface EnvelopeFieldToolTipProps extends VariantProps<typeof tooltipVariants> {
  children: React.ReactNode;
  className?: string;
  field: Pick<Field, 'id' | 'inserted' | 'fieldMeta' | 'positionX' | 'positionY' | 'width' | 'height' | 'page'>;
  /**
   * Overrides whether the tooltip is shown. Defaults to showing while the field is not
   * inserted, which does not cover inserted fields that still need attention.
   */
  open?: boolean;
}

/**
 * Renders a tooltip for a given field.
 */
export function EnvelopeFieldToolTip({ children, color, className = '', field, open }: EnvelopeFieldToolTipProps) {
  const coords = useFieldPageCoords(field);

  if (!coords) {
    return null;
  }

  return (
    <div
      id="field-tooltip"
      className={cn('pointer-events-none absolute')}
      style={{
        top: `${coords.y}px`,
        left: `${coords.x}px`,
        height: `${coords.height}px`,
        width: `${coords.width}px`,
      }}
    >
      <TooltipProvider>
        <Tooltip delayDuration={0} open={open ?? (!field.inserted || !field.fieldMeta)}>
          <TooltipTrigger className="absolute inset-0 w-full"></TooltipTrigger>

          <TooltipContent className={tooltipVariants({ color, className: cn(className, 'z-40') })} sideOffset={2}>
            {children}
            <TooltipArrow />
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
