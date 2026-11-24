import { ADMIN_RULE_MATCH_RETENTION_DAYS } from '@documenso/lib/constants/admin-rules';
import { Plural, Trans, useLingui } from '@lingui/react/macro';
import { DateTime } from 'luxon';

export type AdminRuleLastMatchProps = {
  lastMatchedAt: Date | null;
  /**
   * When the rule was created, to tell a rule that never matched apart from one whose matches have
   * been pruned.
   */
  ruleCreatedAt: Date;
};

/**
 * When a rule last matched. Matches are deleted after `ADMIN_RULE_MATCH_RETENTION_DAYS`, so a rule
 * older than that with no recorded match may still have matched before then.
 */
export const AdminRuleLastMatch = ({ lastMatchedAt, ruleCreatedAt }: AdminRuleLastMatchProps) => {
  const { i18n } = useLingui();

  if (lastMatchedAt) {
    return DateTime.fromJSDate(lastMatchedAt).setLocale(i18n.locale).toRelative();
  }

  const retentionDays = ADMIN_RULE_MATCH_RETENTION_DAYS;

  if (DateTime.fromJSDate(ruleCreatedAt) < DateTime.now().minus({ days: retentionDays })) {
    return <Plural value={retentionDays} one="Not in the last # day" other="Not in the last # days" />;
  }

  return <Trans>Never</Trans>;
};
