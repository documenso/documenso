import { AppError } from '@documenso/lib/errors/app-error';
import { disableUser } from '@documenso/lib/server-only/user/disable-user';
import type {
  TAdminRuleAction,
  TAdminRuleActionRun,
  TAdminRuleContext,
  TAdminRuleDefinition,
  TAdminRuleTrigger,
} from '@documenso/lib/types/admin-rules';
import { ZAdminRuleDefinitionSchema } from '@documenso/lib/types/admin-rules';
import { ZClaimFlagsSchema } from '@documenso/lib/types/subscription';
import type { ApiRequestMetadata, RequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { generateDatabaseId } from '@documenso/lib/universal/id';
import { evaluateAdminRuleWithLoaders } from '@documenso/lib/utils/admin-rules';
import { logger } from '@documenso/lib/utils/logger';
import { prisma } from '@documenso/prisma';
import type { AdminRule } from '@prisma/client';
import { AdminRuleMode } from '@prisma/client';
import { match } from 'ts-pattern';
import type { AdminRuleEvent, AdminRuleSubject } from './admin-rule-event';
import { buildAdminRuleContext, getAdminRuleEventSubject, getAdminRuleFieldLoaders } from './build-admin-rule-context';

export type AdminRuleEvaluationMatch = {
  rule: AdminRule;
  actions: TAdminRuleAction[];
};

/**
 * The outcome of evaluating an event. Nothing has been persisted yet.
 */
export type AdminRuleEvaluation = {
  trigger: TAdminRuleTrigger;
  subject: AdminRuleSubject;
  context: TAdminRuleContext;
  matches: AdminRuleEvaluationMatch[];
  isBlocked: boolean;
  blockedByRuleId: string | null;
};

/**
 * The outcome of applying an evaluation: match rows written and actions run.
 */
export type AdminRuleRunResult = {
  trigger: TAdminRuleTrigger;
  isBlocked: boolean;
  blockedByRuleId: string | null;
  matchIds: string[];
  hasFailedActions: boolean;
};

export type AdminRuleEngineOptions = {
  /**
   * The request's IP address and user agent, for the `request.ip` and `request.user_agent` fields.
   */
  requestMetadata?: RequestMetadata;

  /**
   * Where the request came from, for the `request.source` and `envelope.source` fields.
   */
  requestSource?: ApiRequestMetadata['source'];
};

type ExecuteActionOptions = {
  action: TAdminRuleAction;
  subject: AdminRuleSubject;
  /**
   * The rule this action belongs to, so records it creates can link back to it.
   */
  ruleId: string;
};

/**
 * Runs admin rules against platform events.
 *
 * Create one instance per request and reuse it for every event in it: the active rules are looked
 * up on the first event and shared with the rest, so a document send's two checks cost one query.
 * Don't keep an instance beyond the request, or it won't see rule changes. Never call `run` inside a
 * `$transaction`: the match rows and what the actions write would not roll back with it.
 */
export class AdminRuleEngine {
  private readonly requestMetadata: RequestMetadata | undefined;
  private readonly requestSource: ApiRequestMetadata['source'] | undefined;

  /**
   * Every trigger's active rules, loaded on the first event. There are few rules, so loading them
   * all costs about the same as loading one trigger's.
   */
  private activeRules: Promise<AdminRule[]> | null = null;

  public constructor(options: AdminRuleEngineOptions = {}) {
    const { requestMetadata, requestSource } = options;

    this.requestMetadata = requestMetadata;
    this.requestSource = requestSource;
  }

  /**
   * Evaluates the event against its trigger's active rules, in priority order. Nothing is persisted.
   *
   * The rule lookup is the only query that always runs, once per instance. Fields that need a query
   * are only loaded when the others can't settle a rule.
   *
   * Returns `null` when there's nothing to apply. Fails open: an error, including while loading a
   * field, also returns `null`, so a broken rule can never break the underlying flow.
   */
  private async evaluate(event: AdminRuleEvent): Promise<AdminRuleEvaluation | null> {
    const { trigger } = event;

    try {
      const rules: { rule: AdminRule; definition: TAdminRuleDefinition }[] = [];

      // Set before the first await, so events run at the same time share one lookup.
      this.activeRules ??= findActiveAdminRules();

      const activeRules = (await this.activeRules).filter((rule) => rule.trigger === trigger);

      for (const rule of activeRules) {
        const definition = ZAdminRuleDefinitionSchema.safeParse(rule.definition);

        if (!definition.success) {
          logger.warn({ ruleId: rule.id }, 'Skipping admin rule with an invalid definition');
          continue;
        }

        rules.push({ rule, definition: definition.data });
      }

      if (rules.length === 0) {
        return null;
      }

      const subject = getAdminRuleEventSubject(event);
      const now = new Date();

      const evaluation: AdminRuleEvaluation = {
        trigger,
        subject,
        context: buildAdminRuleContext({
          event,
          requestMetadata: this.requestMetadata,
          requestSource: this.requestSource,
          now,
        }),
        matches: [],
        isBlocked: false,
        blockedByRuleId: null,
      };

      for (const { rule, definition } of rules) {
        // Exempt organisations skip the rule entirely, so no match is recorded either.
        if (subject.organisationId && rule.exemptOrganisationIds.includes(subject.organisationId)) {
          continue;
        }

        const isMatch = await evaluateAdminRuleWithLoaders({
          definition,
          context: evaluation.context,
          fieldLoaders: getAdminRuleFieldLoaders({ event, now }),
        });

        if (!isMatch) {
          continue;
        }

        const { actions } = definition;

        evaluation.matches.push({
          rule,
          actions,
        });

        // Monitor rules only observe, they never influence the outcome or stop other rules.
        if (rule.mode === AdminRuleMode.MONITOR) {
          continue;
        }

        const blockAction = actions.find((action) => action.type === 'block_event');

        if (blockAction && !evaluation.isBlocked) {
          evaluation.isBlocked = true;
          evaluation.blockedByRuleId = rule.id;
        }

        if (rule.stopOnMatch || evaluation.isBlocked) {
          break;
        }
      }

      return evaluation;
    } catch (error) {
      logger.error({ error, trigger }, 'Failed to evaluate admin rules');

      return null;
    }
  }

  /**
   * Runs the actions of enforced rules, then records a match row for every matched rule.
   */
  private async apply(evaluation: AdminRuleEvaluation): Promise<AdminRuleRunResult> {
    const { subject } = evaluation;

    const result: AdminRuleRunResult = {
      trigger: evaluation.trigger,
      isBlocked: evaluation.isBlocked,
      blockedByRuleId: evaluation.blockedByRuleId,
      matchIds: [],
      hasFailedActions: false,
    };

    for (const { rule, actions } of evaluation.matches) {
      try {
        const isEnforced = rule.mode === AdminRuleMode.ENFORCE;

        const actionsRun: TAdminRuleActionRun[] = [];

        for (const action of actions) {
          if (!isEnforced) {
            actionsRun.push({ type: action.type, status: 'would_run' });
            continue;
          }

          try {
            await this.executeAction({ action, subject, ruleId: rule.id });

            actionsRun.push({ type: action.type, status: 'ran' });
          } catch (error) {
            result.hasFailedActions = true;

            actionsRun.push({
              type: action.type,
              status: 'failed',
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }

        const adminRuleMatch = await prisma.adminRuleMatch.create({
          data: {
            id: generateDatabaseId('admin_rule_match'),
            ruleId: rule.id,
            mode: rule.mode,
            trigger: evaluation.trigger,
            actorUserId: subject.userId,
            organisationId: subject.organisationId,
            envelopeId: subject.envelopeId,
            eventSnapshot: evaluation.context,
            actionsRun,
          },
        });

        result.matchIds.push(adminRuleMatch.id);
      } catch (error) {
        logger.error({ error, ruleId: rule.id }, 'Failed to apply admin rule match');
      }
    }

    return result;
  }

  /**
   * Applies a single rule action to the subject of the event. Decision actions (`block_event`,
   * `log_only`) have no side effects.
   *
   * Throws when the action cannot be applied, for example a user action on an event without a user.
   */
  private async executeAction({ action, subject, ruleId }: ExecuteActionOptions) {
    await match(action.type)
      .with('block_event', 'log_only', async () => {
        // Nothing to apply, these are handled by the engine itself.
      })
      .with('flag_account_for_review', async () => {
        const userId = getSubjectUserId(subject);

        // A rule flags a user once. Later matches are still recorded, but don't add more tags.
        const existingTag = await prisma.adminTag.findFirst({
          where: {
            userId,
            type: 'flagged_for_review',
            adminRuleId: ruleId,
          },
          select: {
            id: true,
          },
        });

        if (existingTag) {
          return;
        }

        await prisma.adminTag.create({
          data: {
            id: generateDatabaseId('admin_tag'),
            type: 'flagged_for_review',
            description: action.params.reason || 'Flagged by an admin rule',
            userId,
            adminRuleId: ruleId,
          },
        });
      })
      .with('disable_user', async () => {
        const userId = getSubjectUserId(subject);

        await disableUser({ id: userId });
      })
      .with('disable_emails', async () => {
        const organisationId = getSubjectOrganisationId(subject);

        const organisation = await prisma.organisation.findFirstOrThrow({
          where: {
            id: organisationId,
          },
          select: {
            organisationClaim: {
              select: {
                id: true,
                flags: true,
              },
            },
          },
        });

        const flags = ZClaimFlagsSchema.parse(organisation.organisationClaim.flags);

        await prisma.organisationClaim.update({
          where: {
            id: organisation.organisationClaim.id,
          },
          data: {
            flags: {
              ...flags,
              disableEmails: true,
            },
          },
        });
      })
      .exhaustive();
  }

  /**
   * Evaluates the event against its trigger's active rules, records the matches and runs the actions
   * of enforced rules against the subject derived from the event.
   */
  public async run(event: AdminRuleEvent): Promise<AdminRuleRunResult> {
    const evaluation = await this.evaluate(event);

    if (!evaluation) {
      return {
        trigger: event.trigger,
        isBlocked: false,
        blockedByRuleId: null,
        matchIds: [],
        hasFailedActions: false,
      };
    }

    return await this.apply(evaluation);
  }

  /**
   * Runs the rules like `run`, then throws `ADMIN_RULE_BLOCKED` when a rule blocked the event.
   */
  public async runAndAssert(event: AdminRuleEvent): Promise<AdminRuleRunResult> {
    const result = await this.run(event);

    assertAdminRulesNotBlocked(result);

    return result;
  }
}

/**
 * Throws `ADMIN_RULE_BLOCKED` when a rule blocked the event. Only the code reaches the client, which
 * shows its own message for it. For results from `run`; `runAndAssert` runs the rules and calls this.
 */
export const assertAdminRulesNotBlocked = ({ isBlocked }: Pick<AdminRuleRunResult, 'isBlocked'>) => {
  if (!isBlocked) {
    return;
  }

  throw new AppError('ADMIN_RULE_BLOCKED', {
    message: 'This action was blocked by a platform rule.',
    statusCode: 403,
  });
};

/**
 * Every rule that isn't disabled, across all triggers, in the order they run.
 */
const findActiveAdminRules = async () =>
  await prisma.adminRule.findMany({
    where: {
      mode: {
        not: AdminRuleMode.DISABLED,
      },
    },
    // Rules created at the same moment can share a priority, so ties go to the older rule. The
    // rules list uses the same order.
    orderBy: [
      {
        priority: 'asc',
      },
      {
        createdAt: 'asc',
      },
      {
        id: 'asc',
      },
    ],
  });

const getSubjectUserId = (subject: AdminRuleSubject) => {
  if (subject.userId === null) {
    throw new Error('This action requires a user but the event has none');
  }

  return subject.userId;
};

const getSubjectOrganisationId = (subject: AdminRuleSubject) => {
  if (subject.organisationId === null) {
    throw new Error('This action requires an organisation but the event has none');
  }

  return subject.organisationId;
};
