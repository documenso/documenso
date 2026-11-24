/**
 * `SelectTrigger` renders its value inside a flex `<section>` whose `<span>` has no `min-width`,
 * so long values (field keys, action labels) overflow the trigger instead of truncating.
 * These utilities constrain the inner span and keep the chevron visible.
 */
export const ADMIN_RULE_SELECT_TRIGGER_CLASS =
  '[&>section]:min-w-0 [&>section>span]:min-w-0 [&>section>span]:truncate [&>section>svg]:shrink-0';

/**
 * Columns shared by every row of the condition builder: the joiner ("where" / "and" / "or"), the
 * row's content (a condition or a nested group) and its remove button. Sharing them keeps
 * conditions and nested groups aligned at every depth.
 */
export const ADMIN_RULE_CONDITION_ROW_CLASS = 'grid grid-cols-[3.75rem_minmax(0,1fr)_2rem] items-start gap-2';

/**
 * The static joiner label, sized to line up with the 38px inputs and the joiner select.
 */
export const ADMIN_RULE_JOINER_LABEL_CLASS =
  'flex h-[38px] items-center pl-2.5 font-semibold text-[11px] text-muted-foreground uppercase tracking-wider';
