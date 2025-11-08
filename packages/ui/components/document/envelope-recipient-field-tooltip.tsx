import { useCallback, useEffect, useState } from 'react';

import { Trans, useLingui } from '@lingui/react/macro';
import { SigningStatus } from '@prisma/client';
import type { Field, Recipient } from '@prisma/client';
import { ClockIcon, EyeOffIcon, LockIcon } from 'lucide-react';

import { getBoundingClientRect } from '@documenso/lib/client-only/get-bounding-client-rect';
import { PDF_VIEWER_PAGE_SELECTOR } from '@documenso/lib/constants/pdf-viewer';

import { isTemplateRecipientEmailPlaceholder } from '../../../lib/constants/template';
import { extractInitials } from '../../../lib/utils/recipient-formatter';
import { SignatureIcon } from '../../icons/signature';
import { cn } from '../../lib/utils';
import { Avatar, AvatarFallback } from '../../primitives/avatar';
import { Badge } from '../../primitives/badge';
import { FRIENDLY_FIELD_TYPE } from '../../primitives/document-flow/types';
import { PopoverHover } from '../../primitives/popover';

interface EnvelopeRecipientFieldTooltipProps {
  field: Pick<
    Field,
    | 'id'
    | 'inserted'
    | 'positionX'
    | 'positionY'
    | 'width'
    | 'height'
    | 'page'
    | 'type'
    | 'fieldMeta'
  > & {
    recipient: Pick<Recipient, 'name' | 'email' | 'signingStatus'>;
  };
  showFieldStatus?: boolean;
  showRecipientTooltip?: boolean;
  showRecipientColors?: boolean;
}

const getRecipientDisplayText = (recipient: { name: string; email: string }) => {
  if (recipient.name && !isTemplateRecipientEmailPlaceholder(recipient.email)) {
    return `${recipient.name} (${recipient.email})`;
  }

  if (recipient.name && isTemplateRecipientEmailPlaceholder(recipient.email)) {
    return recipient.name;
  }

  return recipient.email;
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

  const [hideField, setHideField] = useState<boolean>(!showRecipientTooltip);

  const [coords, setCoords] = useState({
    x: 0,
    y: 0,
    height: 0,
    width: 0,
  });

  const calculateCoords = useCallback(() => {
    const $page = document.querySelector<HTMLElement>(
      `${PDF_VIEWER_PAGE_SELECTOR}[data-page-number="${field.page}"]`,
    );

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
    const $page = document.querySelector<HTMLElement>(
      `${PDF_VIEWER_PAGE_SELECTOR}[data-page-number="${field.page}"]`,
    );

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
          <Avatar className="absolute -left-3 -top-3 z-50 h-6 w-6 border-2 border-solid border-gray-200/50 transition-colors hover:border-gray-200">
            <AvatarFallback className="bg-neutral-50 text-xs text-gray-400">
              {extractInitials(field.recipient.name || field.recipient.email)}
            </AvatarFallback>
          </Avatar>
        }
        contentProps={{
          className: 'relative flex mb-4 w-fit flex-col p-4 text-sm',
        }}
      >
        {showFieldStatus && (
          <Badge
            className="mx-auto mb-1 py-0.5"
            variant={
              field?.fieldMeta?.readOnly
                ? 'neutral'
                : field.recipient.signingStatus === SigningStatus.SIGNED
                  ? 'default'
                  : 'secondary'
            }
          >
            {field?.fieldMeta?.readOnly ? (
              <>
                <LockIcon className="mr-1 h-3 w-3" />
                <Trans>Read Only</Trans>
              </>
            ) : field.recipient.signingStatus === SigningStatus.SIGNED ? (
              <>
                <SignatureIcon className="mr-1 h-3 w-3" />
                <Trans>Signed</Trans>
              </>
            ) : (
              <>
                <ClockIcon className="mr-1 h-3 w-3" />
                <Trans>Pending</Trans>
              </>
            )}
          </Badge>
        )}

        <p className="text-center font-semibold">
          <span>{t(FRIENDLY_FIELD_TYPE[field.type])} field</span>
        </p>

        <p className="text-muted-foreground mt-1 text-center text-xs">
          {getRecipientDisplayText(field.recipient)}
        </p>

        <button
          className="absolute right-0 top-0 my-1 p-2 focus:outline-none focus-visible:ring-0"
          onClick={() => setHideField(true)}
          title="Hide field"
        >
          <EyeOffIcon className="h-3 w-3" />
        </button>
      </PopoverHover>
    </div>
  );
}
