import { useHeldValue } from '@documenso/lib/client-only/hooks/use-held-value';
import { getSigningItems, type SigningItem } from '@documenso/lib/utils/signing-items';
import { FIELD_GROUP_BAR_DATA_ATTRIBUTE } from '@documenso/ui/components/field/envelope-field-group-bar';
import { type Field, RecipientRole } from '@prisma/client';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { useRequiredEnvelopeSigningContext } from '../document-signing/envelope-signing-provider';

/**
 * How long the group bar lingers after the pointer leaves, so it can be reached.
 */
const GROUP_BAR_HOLD_MS = 500;

export type TGroupPointerTarget = {
  fieldId: number;
  source: 'field' | 'bar';
};

export type TCanvasPointerTarget = {
  fieldId: number;
  /**
   * Whether the field belongs to a group the recipient can navigate.
   */
  isGrouped: boolean;
};

export type TFieldGroupNavigation = {
  /**
   * Every field in the group in document order.
   */
  fields: Field[];
  /**
   * One based position of the field within the group.
   */
  position: number;
  previousField: Field;
  nextField: Field;
};

export type EnvelopeSigningFieldGroupContextValue = {
  /**
   * The grouped field or group bar the pointer is currently over.
   */
  groupPointerTarget: TGroupPointerTarget | null;

  /**
   * The grouped field whose navigation bar is shown. Lingers briefly after the pointer
   * leaves so the bar can be reached.
   */
  groupBarFieldId: number | null;

  /**
   * The grouped field whose group is highlighted. Follows the pointer immediately.
   */
  groupHighlightFieldId: number | null;

  /**
   * Reports what the pointer is over on the canvas. Moving off a grouped field onto empty
   * space keeps its bar for a moment so it can be reached, while moving onto any other
   * field dismisses it straight away.
   */
  onCanvasPointer: (_target: TCanvasPointerTarget | null) => void;

  /**
   * Reports the pointer entering or leaving the group bar shown for a field.
   */
  onGroupBarPointer: (_fieldId: number, _event: 'enter' | 'leave') => void;

  /**
   * Resolves the position of a field within its group and its neighbours, ordered the
   * same way as the next pending field.
   */
  getFieldGroupNavigation: (_fieldId: number) => TFieldGroupNavigation | null;

  /**
   * Moves the group bar to the previous or next field in the same group and keeps
   * it open there until the group is valid, the recipient clicks elsewhere or hovers
   * another grouped field.
   */
  navigateFieldGroup: (_fieldId: number, _direction: 'previous' | 'next') => Field | null;
};

const EnvelopeSigningFieldGroupContext = createContext<EnvelopeSigningFieldGroupContextValue | null>(null);

export const useEnvelopeSigningFieldGroups = () => {
  const context = useContext(EnvelopeSigningFieldGroupContext);

  if (!context) {
    throw new Error('useEnvelopeSigningFieldGroups must be used within a EnvelopeSigningFieldGroupProvider');
  }

  return context;
};

/**
 * Hover, highlight and navigation state for grouped fields on the signing page.
 */
export const EnvelopeSigningFieldGroupProvider = ({ children }: { children: React.ReactNode }) => {
  const { recipient, recipientSigningItems, pendingRecipientSigningItems, assistantFields, showPendingFieldTooltip } =
    useRequiredEnvelopeSigningContext();

  const [groupPointerTarget, setGroupPointerTarget] = useState<TGroupPointerTarget | null>(null);
  const [pinnedGroupFieldId, setPinnedGroupFieldId] = useState<number | null>(null);

  // The bar lingers after the pointer leaves so it can be reached; the highlight does not.
  const [heldGroupPointerTarget, dropHeldGroupPointerTarget] = useHeldValue(groupPointerTarget, GROUP_BAR_HOLD_MS);

  /**
   * Signing items for every recipient the current recipient may act for, so assistants
   * can navigate the groups of the recipient they are prefilling for.
   */
  const navigableSigningItems = useMemo(() => {
    if (recipient.role !== RecipientRole.ASSISTANT) {
      return recipientSigningItems;
    }

    return getSigningItems(assistantFields);
  }, [recipient.role, recipientSigningItems, assistantFields]);

  const groupItemByFieldId = useMemo(() => {
    const map = new Map<number, SigningItem>();

    for (const item of navigableSigningItems) {
      if (!item.groupId) {
        continue;
      }

      for (const field of item.fields) {
        map.set(field.id, item);
      }
    }

    return map;
  }, [navigableSigningItems]);

  const getFieldGroupNavigation = useCallback(
    (fieldId: number): TFieldGroupNavigation | null => {
      const item = groupItemByFieldId.get(fieldId);

      if (!item) {
        return null;
      }

      const index = item.fields.findIndex((field) => field.id === fieldId);
      const count = item.fields.length;

      return {
        fields: item.fields,
        position: index + 1,
        previousField: item.fields[(index - 1 + count) % count],
        nextField: item.fields[(index + 1) % count],
      };
    },
    [groupItemByFieldId],
  );

  const onCanvasPointer = (target: TCanvasPointerTarget | null) => {
    if (target?.isGrouped) {
      const { fieldId } = target;

      setGroupPointerTarget((current) =>
        current?.source === 'field' && current.fieldId === fieldId ? current : { fieldId, source: 'field' },
      );

      // Hovering a different grouped field moves the focus there for good.
      setPinnedGroupFieldId((current) => (current === fieldId ? current : null));

      return;
    }

    // The canvas reports the pointer leaving after the bar reports it entering, so a bar
    // target is left alone.
    setGroupPointerTarget((current) => (current?.source === 'field' ? null : current));

    if (target) {
      dropHeldGroupPointerTarget();
    }
  };

  const onGroupBarPointer = (fieldId: number, event: 'enter' | 'leave') => {
    if (event === 'enter') {
      setGroupPointerTarget({ fieldId, source: 'bar' });
      return;
    }

    setGroupPointerTarget((current) => (current?.source === 'bar' && current.fieldId === fieldId ? null : current));
  };

  const navigateFieldGroup = (fieldId: number, direction: 'previous' | 'next'): Field | null => {
    const navigation = getFieldGroupNavigation(fieldId);

    if (!navigation) {
      return null;
    }

    const targetField = direction === 'previous' ? navigation.previousField : navigation.nextField;

    // The bar moves away from under the pointer, so it will not report the pointer leaving.
    // The lingering hover is dropped too, otherwise the old bar comes back if the pin is
    // released within the hold.
    setGroupPointerTarget(null);
    dropHeldGroupPointerTarget();
    setPinnedGroupFieldId(targetField.id);

    return targetField;
  };

  // Clicking anywhere other than the bar itself releases the pinned bar, and ends any
  // lingering hover since the pointer is clearly no longer on its way to the bar.
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const isBarClick = event.target instanceof Element && event.target.closest(`[${FIELD_GROUP_BAR_DATA_ATTRIBUTE}]`);

      if (isBarClick) {
        return;
      }

      setPinnedGroupFieldId(null);
      dropHeldGroupPointerTarget();
    };

    document.addEventListener('pointerdown', onPointerDown, true);

    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
    };
  }, [dropHeldGroupPointerTarget]);

  /**
   * The pinned group's validity when last checked. The pin is released only when the group
   * becomes valid while pinned, since a group which is already complete would otherwise
   * drop its bar the moment the recipient navigates through it.
   */
  const pinnedGroupValidityRef = useRef<{ groupId: string; isValid: boolean } | null>(null);

  // Release the pinned bar once the recipient completes its group. An optional group which
  // has not been touched yet is not considered valid, so the bar stays until the recipient
  // acts on it.
  useEffect(() => {
    if (pinnedGroupFieldId === null) {
      pinnedGroupValidityRef.current = null;
      return;
    }

    const item = groupItemByFieldId.get(pinnedGroupFieldId);

    if (!item?.groupId) {
      pinnedGroupValidityRef.current = null;
      setPinnedGroupFieldId(null);
      return;
    }

    const isValid = item.isInserted && item.validationError === null;
    const previousValidity = pinnedGroupValidityRef.current;

    const hasBecomeValid = isValid && previousValidity?.groupId === item.groupId && !previousValidity.isValid;

    pinnedGroupValidityRef.current = { groupId: item.groupId, isValid };

    if (hasBecomeValid) {
      setPinnedGroupFieldId(null);
    }
  }, [pinnedGroupFieldId, groupItemByFieldId]);

  /**
   * The next pending grouped field while it is being pointed out, so touch devices,
   * which cannot hover, can still reach its bar.
   */
  const nextPendingGroupFieldId = useMemo(() => {
    const nextPendingSigningItem = pendingRecipientSigningItems[0];

    if (showPendingFieldTooltip && nextPendingSigningItem?.groupId) {
      return nextPendingSigningItem.primaryField.id;
    }

    return null;
  }, [showPendingFieldTooltip, pendingRecipientSigningItems]);

  // A pin always wins: hovering another field releases it, so a pin can only coexist
  // with a hover on its own field or a hover which is merely lingering.
  const groupBarFieldId = pinnedGroupFieldId ?? heldGroupPointerTarget?.fieldId ?? nextPendingGroupFieldId;
  const groupHighlightFieldId = pinnedGroupFieldId ?? groupPointerTarget?.fieldId ?? nextPendingGroupFieldId;

  return (
    <EnvelopeSigningFieldGroupContext.Provider
      value={{
        groupPointerTarget,
        groupBarFieldId,
        groupHighlightFieldId,
        onCanvasPointer,
        onGroupBarPointer,
        getFieldGroupNavigation,
        navigateFieldGroup,
      }}
    >
      {children}
    </EnvelopeSigningFieldGroupContext.Provider>
  );
};
