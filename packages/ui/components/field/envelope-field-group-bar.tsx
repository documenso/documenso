import { Trans } from '@lingui/react/macro';
import type { Field } from '@prisma/client';
import { motion } from 'framer-motion';
import { ChevronDownIcon, ChevronUpIcon, Link2Icon } from 'lucide-react';

import { getRecipientColorStyles, type TRecipientColor } from '../../lib/recipient-colors';
import { cn } from '../../lib/utils';
import { useFieldPageCoords } from './use-field-page-coords';

const BAR_OFFSET_PX = 8;

/**
 * Marks the bar so clicks inside it can be told apart from clicks elsewhere on the page.
 */
export const FIELD_GROUP_BAR_DATA_ATTRIBUTE = 'data-field-group-bar';

export type EnvelopeFieldGroupBarProps = {
  field: Pick<Field, 'id' | 'positionX' | 'positionY' | 'width' | 'height' | 'page'>;
  /**
   * One based position of the field within its group.
   */
  position: number;
  /**
   * Number of fields in the group.
   */
  count: number;
  color: TRecipientColor;
  onPrevious: () => void;
  onNext: () => void;
  /**
   * Called when the pointer enters or leaves the bar, so the owner can keep it open
   * while it is being used.
   */
  onHoverChange?: (isHovering: boolean) => void;
  className?: string;
};

/**
 * A floating bar anchored above a grouped field, showing its position within the
 * group and arrows to move between the group's fields.
 *
 * Render inside an `AnimatePresence` so it fades out when removed.
 */
export const EnvelopeFieldGroupBar = ({
  field,
  position,
  count,
  color,
  onPrevious,
  onNext,
  onHoverChange,
  className,
}: EnvelopeFieldGroupBarProps) => {
  const coords = useFieldPageCoords(field);

  if (!coords) {
    return null;
  }

  const ringColor = getRecipientColorStyles(color).baseRing;

  return (
    // A zero height anchor at the field's top left corner. The bar hangs above it so it
    // lines up with the field's left edge and never overlaps the field. Framer Motion
    // owns the bar's transform, so the offset is done with positioning here.
    <div
      className={cn('pointer-events-none absolute z-40', className)}
      style={{
        left: `${coords.x}px`,
        top: `${coords.y}px`,
        width: `${coords.width}px`,
        height: 0,
      }}
    >
      <motion.div
        data-testid="field-group-bar"
        data-field-id={field.id}
        {...{ [FIELD_GROUP_BAR_DATA_ATTRIBUTE]: '' }}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0, transition: { duration: 0.35 } }}
        exit={{ opacity: 0, y: 4, transition: { duration: 0.15 } }}
        className="pointer-events-auto absolute left-0 flex items-center gap-1 whitespace-nowrap rounded-md bg-neutral-900 py-0.5 pr-0.5 pl-2.5 text-white text-xs shadow-lg"
        style={{ bottom: `${BAR_OFFSET_PX}px` }}
        onMouseEnter={() => onHoverChange?.(true)}
        onMouseLeave={() => onHoverChange?.(false)}
      >
        <Link2Icon className="mr-1.5 h-4 w-4 shrink-0" style={{ color: ringColor }} aria-hidden="true" />

        <span>
          <Trans>Grouped field</Trans>
        </span>

        <span className="mr-1 text-neutral-400">
          {position} of {count}
        </span>

        <button
          type="button"
          data-testid="field-group-bar-previous"
          className="rounded p-1 transition-colors hover:bg-white/10"
          onClick={onPrevious}
        >
          <ChevronUpIcon className="h-4 w-4" />
          <span className="sr-only">
            <Trans>Previous field in group</Trans>
          </span>
        </button>

        <button
          type="button"
          data-testid="field-group-bar-next"
          className="rounded p-1 transition-colors hover:bg-white/10"
          onClick={onNext}
        >
          <ChevronDownIcon className="h-4 w-4" />
          <span className="sr-only">
            <Trans>Next field in group</Trans>
          </span>
        </button>
      </motion.div>
    </div>
  );
};
