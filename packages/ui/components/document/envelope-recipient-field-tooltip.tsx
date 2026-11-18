import { getBoundingClientRect } from '@documenso/lib/client-only/get-bounding-client-rect';
import { PDF_VIEWER_PAGE_SELECTOR } from '@documenso/lib/constants/pdf-viewer';
import { Trans, useLingui } from '@lingui/react/macro';
import type { Field, Recipient } from '@prisma/client';
import { FieldType, SigningStatus } from '@prisma/client';
import {
  CalendarDaysIcon,
  CheckSquareIcon,
  ChevronDownIcon,
  ContactIcon,
  DiscIcon,
  EyeOffIcon,
  HashIcon,
  LockIcon,
  MailIcon,
  TypeIcon,
  UserIcon,
} from 'lucide-react';
import { type ElementType, useCallback, useEffect, useState } from 'react';

import { isTemplateRecipientEmailPlaceholder } from '../../../lib/constants/template';
import { extractInitials } from '../../../lib/utils/recipient-formatter';
import { SignatureIcon } from '../../icons/signature';
import { cn } from '../../lib/utils';
import { Avatar, AvatarFallback } from '../../primitives/avatar';
import { FRIENDLY_FIELD_TYPE } from '../../primitives/document-flow/types';
import { PopoverHover } from '../../primitives/popover';

interface EnvelopeRecipientFieldTooltipProps {
  field: Pick<
    Field,
    'id' | 'inserted' | 'positionX' | 'positionY' | 'width' | 'height' | 'page' | 'type' | 'fieldMeta'
  > & {
    recipient: Pick<Recipient, 'name' | 'email' | 'signingStatus'>;
  };
  showFieldStatus?: boolean;
  showRecipientTooltip?: boolean;
  showRecipientColors?: boolean;
}

const FIELD_TYPE_ICONS: Record<FieldType, ElementType> = {
  [FieldType.SIGNATURE]: SignatureIcon,
  [FieldType.FREE_SIGNATURE]: SignatureIcon,
  [FieldType.INITIALS]: ContactIcon,
  [FieldType.TEXT]: TypeIcon,
  [FieldType.DATE]: CalendarDaysIcon,
  [FieldType.EMAIL]: MailIcon,
  [FieldType.NAME]: UserIcon,
  [FieldType.NUMBER]: HashIcon,
  [FieldType.RADIO]: DiscIcon,
  [FieldType.CHECKBOX]: CheckSquareIcon,
  [FieldType.DROPDOWN]: ChevronDownIcon,
};

/**
 * Renders a tooltip for a given field.
 */
export function EnvelopeRecipientFieldTooltip({
  field,
  showFieldStatus = false,
  showRecipientTooltip = false,
  showRecipientColors = false,
}: EnvelopeRecipientFieldTooltipProps) {
  const { t } = useLingui();

  const FieldIcon = FIELD_TYPE_ICONS[field.type];

  const [hideField, setHideField] = useState<boolean>(!showRecipientTooltip);

  const [coords, setCoords] = useState({
    x: 0,
    y: 0,
    height: 0,
    width: 0,
  });

  const calculateCoords = useCallback(() => {
    const $page = document.querySelector<HTMLElement>(`${PDF_VIEWER_PAGE_SELECTOR}[data-page-number="${field.page}"]`);

    if (!$page) {
      return;
    }

    const { height, width } = getBoundingClientRect($page);

    const fieldHeight = (Number(field.height) / 100) * height;
    const fieldWidth = (Number(field.width) / 100) * width;

    const fieldX = (Number(field.positionX) / 100) * width + Number(fieldWidth);
    const fieldY = (Number(field.positionY) / 100) * height;

    setCoords({
      x: fieldX,
      y: fieldY,
      height: fieldHeight,
      width: fieldWidth,
    });
  }, [field.height, field.page, field.positionX, field.positionY, field.width]);

  useEffect(() => {
    calculateCoords();
  }, [calculateCoords]);

  useEffect(() => {
    const onResize = () => {
      calculateCoords();
    };

    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
    };
  }, [calculateCoords]);

  useEffect(() => {
    const $page = document.querySelector<HTMLElement>(`${PDF_VIEWER_PAGE_SELECTOR}[data-page-number="${field.page}"]`);

    if (!$page) {
      return;
    }

    const observer = new ResizeObserver(() => {
      calculateCoords();
    });

    observer.observe($page);

    return () => {
      observer.disconnect();
    };
  }, [calculateCoords, field.page]);

  if (hideField) {
    return null;
  }

  return (
    <div
      id="field-recipient-tooltip"
      className={cn('absolute z-40')}
      style={{
        top: `${coords.y}px`,
        left: `${coords.x}px`,
      }}
    >
      <PopoverHover
        trigger={
          <Avatar className="absolute -top-3 -left-3 z-50 h-6 w-6 border-2 border-gray-200/50 border-solid transition-colors hover:border-gray-200">
            <AvatarFallback className="bg-neutral-50 text-gray-400 text-xs">
              {extractInitials(field.recipient.name || field.recipient.email)}
            </AvatarFallback>
          </Avatar>
        }
        contentProps={{
          className: 'flex w-64 flex-col overflow-hidden p-0 text-sm',
          sideOffset: 20,
          onOpenAutoFocus: (event) => event.preventDefault(),
        }}
      >
        <div className="flex items-center gap-2 p-3">
          <FieldIcon className="h-4 w-4 shrink-0 text-muted-foreground" />

          <p className="min-w-0 flex-1 truncate font-medium">
            <Trans>{t(FRIENDLY_FIELD_TYPE[field.type])} field</Trans>
          </p>

          {showFieldStatus && (
            <div className="flex shrink-0 items-center gap-1.5 text-xs">
              {field?.fieldMeta?.readOnly ? (
                <>
                  <LockIcon className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    <Trans>Read Only</Trans>
                  </span>
                </>
              ) : field.recipient.signingStatus === SigningStatus.SIGNED ? (
                <>
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                  <span className="text-green-600 dark:text-green-400">
                    <Trans>Signed</Trans>
                  </span>
                </>
              ) : (
                <>
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                  <span className="text-amber-600 dark:text-amber-400">
                    <Trans>Pending</Trans>
                  </span>
                </>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 border-border/50 border-t bg-muted/50 px-3 py-2.5">
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-xs">{field.recipient.name || field.recipient.email}</p>

            {!isTemplateRecipientEmailPlaceholder(field.recipient.email) && field.recipient.name && (
              <p className="truncate text-muted-foreground text-xs">{field.recipient.email}</p>
            )}
          </div>

          <button
            type="button"
            className="-m-1 shrink-0 rounded-sm p-1 text-muted-foreground hover:bg-background hover:text-foreground"
            onClick={() => setHideField(true)}
            title={t`Hide field`}
          >
            <EyeOffIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      </PopoverHover>
    </div>
  );
}
