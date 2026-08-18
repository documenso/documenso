const FIELD_ROOT_CONTAINER_SHARED_CLASS_NAME =
  'field--FieldRootContainer field-card-container dark-mode-disabled group rounded-[2px] bg-white/90 ring-2 ring-gray-200 transition-all';

// [container-type:inline-size] makes the cqw font units used by field text
// resolve against the field box itself; without it they resolve against the
// nearest ancestor container (the page), so pre-filled readOnly TEXT fields
// wrapped past the field border in the signing preview (#2669). The editor's
// field-item sets the same containment for the same reason.
export const FIELD_ROOT_CONTAINER_CLASS_NAME = `${FIELD_ROOT_CONTAINER_SHARED_CLASS_NAME} relative z-20 flex h-full w-full items-center [container-type:inline-size]`;

export const FIELD_ROOT_CONTAINER_PROBE_CLASS_NAME = `field--FieldRootContainerProbe ${FIELD_ROOT_CONTAINER_SHARED_CLASS_NAME}`;

/**
 * Selector for the element the probe is appended into when reading computed
 * field styles. It must be an ancestor of where real fields render so the probe
 * inherits the same CSS cascade (custom embed CSS is commonly scoped under
 * `.embed--Root` / `.embed--DocumentContainer`).
 */
export const FIELD_PROBE_ANCHOR_SELECTOR = '.embed--DocumentContainer';
