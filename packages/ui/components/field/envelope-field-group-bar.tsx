import { Trans } from '@lingui/react/macro';
import type { Field } from '@prisma/client';
import { motion } from 'framer-motion';
import { ChevronDownIcon, ChevronUpIcon, Link2Icon } from 'lucide-react';

import { getRecipientColorStyles, type TRecipientColor } from '../../lib/recipient-colors';
import { cn } from '../../lib/utils';

const BAR_OFFSET_PX = 4;

/**
 * Marks the bar so clicks inside it can be told apart from clicks elsewhere on the page.
 */
export const FIELD_GROUP_BAR_DATA_ATTRIBUTE = 'data-field-group-bar';

export type EnvelopeFieldGroupBarProps = {
  field: Pick<Field, 'id' | 'positionX' | 'positionY' | 'width'>;
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
 * Render inside the field's page box, and inside an `AnimatePresence` so it fades out
 * when removed.
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
  const ringColor = getRecipientColorStyles(color).baseRing;

  return (
    <div
      className={cn('pointer-events-none absolute z-40', className)}
      style={{
        left: `${Number(field.positionX)}%`,
        top: `${Number(field.positionY)}%`,
        width: `${Number(field.width)}%`,
        height: 0,
      }}
    >
      <motion.div
        data-testid="field-group-bar"
        data-field-id={field.id}
        {...{ [FIELD_GROUP_BAR_DATA_ATTRIBUTE]: '' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: { duration: 0 } }}
        exit={{ opacity: 0, transition: { duration: 0.15 } }}
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
