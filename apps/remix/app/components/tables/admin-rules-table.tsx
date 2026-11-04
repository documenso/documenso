import { ADMIN_RULE_MODES } from '@documenso/lib/constants/admin-rules';
import { ADMIN_RULE_MODE_MAP } from '@documenso/lib/constants/admin-rules-translations';
import type { TAdminRuleMode } from '@documenso/lib/types/admin-rules';
import { trpc } from '@documenso/trpc/react';
import type { TAdminRuleListItem } from '@documenso/trpc/server/admin-router/rules/get-admin-rules.types';
import { Button } from '@documenso/ui/primitives/button';
import type { DataTableColumnDef } from '@documenso/ui/primitives/data-table';
import { DataTable } from '@documenso/ui/primitives/data-table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@documenso/ui/primitives/dropdown-menu';
import { Skeleton } from '@documenso/ui/primitives/skeleton';
import { Switch } from '@documenso/ui/primitives/switch';
import { TableCell } from '@documenso/ui/primitives/table';
import { useToast } from '@documenso/ui/primitives/use-toast';
import { Plural, Trans, useLingui } from '@lingui/react/macro';
import { ArrowDownIcon, ArrowUpIcon, MoreHorizontalIcon, PencilIcon, Trash2Icon } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router';

import { AdminRuleDeleteDialog } from '~/components/dialogs/admin-rule-delete-dialog';
import { AdminRuleModeBadge, AdminRuleTriggerBadge } from '~/components/general/admin-rules/admin-rule-badges';
import { AdminRuleLastMatch } from '~/components/general/admin-rules/admin-rule-last-match';

export type AdminRulesTableProps = {
  /**
   * The rules to show, already filtered by the page.
   */
  rules: TAdminRuleListItem[];
  /**
   * Every rule id in priority order, including rules the filters hide.
   */
  allRuleIds: string[];
  isLoading: boolean;
  isLoadingError: boolean;
  hasFilters: boolean;
  onClearFilters: () => void;
};

export const AdminRulesTable = ({
  rules,
  allRuleIds,
  isLoading,
  isLoadingError,
  hasFilters,
  onClearFilters,
}: AdminRulesTableProps) => {
  const { t } = useLingui();
  const { toast } = useToast();

  const trpcUtils = trpc.useUtils();

  const { mutateAsync: updateRule } = trpc.admin.rule.update.useMutation({
    onSuccess: async () => {
      await trpcUtils.admin.rule.getMany.invalidate();
    },
  });

  const { mutateAsync: reorderRules, isPending: isReordering } = trpc.admin.rule.reorder.useMutation({
    onSuccess: async () => {
      await trpcUtils.admin.rule.getMany.invalidate();
    },
  });

  const onModeChange = async (rule: TAdminRuleListItem, nextMode: TAdminRuleMode) => {
    try {
      await updateRule({ ruleId: rule.id, data: { mode: nextMode } });

      toast({
        title: t`Rule updated`,
        description: t`"${rule.name}" is now set to ${t(ADMIN_RULE_MODE_MAP[nextMode])}.`,
        duration: 3000,
      });
    } catch {
      toast({
        title: t`Something went wrong`,
        description: t`We were unable to update the rule. Please try again.`,
        variant: 'destructive',
      });
    }
  };

  // Swaps the rule with its visible neighbour within the full order, so moving also works in a
  // filtered list. Filtering by trigger is where it matters, since only rules on the same trigger
  // run against each other.
  const onMoveRule = async (ruleId: string, direction: 'up' | 'down') => {
    const visibleIndex = rules.findIndex((rule) => rule.id === ruleId);

    if (visibleIndex === -1) {
      return;
    }

    const neighbour = direction === 'up' ? rules[visibleIndex - 1] : rules[visibleIndex + 1];

    // The first rule can't move up, and the last can't move down.
    if (!neighbour) {
      return;
    }

    const ruleIds = [...allRuleIds];
    const index = ruleIds.indexOf(ruleId);
    const neighbourIndex = ruleIds.indexOf(neighbour.id);

    if (index === -1 || neighbourIndex === -1) {
      return;
    }

    [ruleIds[index], ruleIds[neighbourIndex]] = [ruleIds[neighbourIndex], ruleIds[index]];

    try {
      await reorderRules({ ruleIds });
    } catch {
      toast({
        title: t`Something went wrong`,
        description: t`We were unable to reorder the rules. Please try again.`,
        variant: 'destructive',
      });
    }
  };

  const columns = useMemo(() => {
    return [
      {
        header: t`Rule`,
        cell: ({ row }) => (
          <div className="flex max-w-[12rem] flex-col gap-1 md:max-w-[18rem]">
            <Link
              to={`/admin/rules/${row.original.id}`}
              className="truncate font-semibold text-foreground/80 hover:underline"
              title={row.original.name}
            >
              {row.original.name}
            </Link>

            {row.original.description && (
              <span className="truncate text-muted-foreground text-xs" title={row.original.description}>
                {row.original.description}
              </span>
            )}
          </div>
        ),
      },
      {
        header: t`Trigger`,
        cell: ({ row }) => (
          <div className="flex flex-col items-start gap-1">
            <AdminRuleTriggerBadge trigger={row.original.trigger} />

            {row.original.exemptOrganisations.length > 0 && (
              <span
                className="text-muted-foreground text-xs"
                title={row.original.exemptOrganisations.map((organisation) => organisation.name).join(', ')}
              >
                <Plural
                  value={row.original.exemptOrganisations.length}
                  one="# exempt organisation"
                  other="# exempt organisations"
                />
              </span>
            )}
          </div>
        ),
      },
      {
        header: t`Mode`,
        cell: ({ row }) => <AdminRuleModeBadge mode={row.original.mode} />,
      },
      {
        header: t`Matches (7d)`,
        cell: ({ row }) => <span className="tabular-nums">{row.original.matchCountLast7Days}</span>,
      },
      {
        header: t`Last match`,
        cell: ({ row }) => (
          <AdminRuleLastMatch lastMatchedAt={row.original.lastMatchedAt} ruleCreatedAt={row.original.createdAt} />
        ),
      },
      {
        header: t`Enabled`,
        // Switching a rule back on starts it in monitor mode, so it never starts enforcing by accident.
        cell: ({ row }) => (
          <Switch
            checked={row.original.mode !== 'DISABLED'}
            onCheckedChange={async (checked) => onModeChange(row.original, checked ? 'MONITOR' : 'DISABLED')}
            aria-label={t`Toggle rule`}
          />
        ),
      },
      {
        header: t`Actions`,
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              disabled={row.index === 0 || isReordering}
              onClick={async () => onMoveRule(row.original.id, 'up')}
              title={t`Move up`}
            >
              <ArrowUpIcon className="h-4 w-4" />
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              disabled={row.index === rules.length - 1 || isReordering}
              onClick={async () => onMoveRule(row.original.id, 'down')}
              title={t`Move down`}
            >
              <ArrowDownIcon className="h-4 w-4" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" title={t`Rule actions`}>
                  <MoreHorizontalIcon className="h-5 w-5 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent className="w-52" align="end" forceMount>
                <DropdownMenuLabel>
                  <Trans>Actions</Trans>
                </DropdownMenuLabel>

                <DropdownMenuItem asChild>
                  <Link to={`/admin/rules/${row.original.id}`}>
                    <PencilIcon className="mr-2 h-4 w-4" />
                    <Trans>Edit</Trans>
                  </Link>
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuLabel>
                  <Trans>Set mode</Trans>
                </DropdownMenuLabel>

                {ADMIN_RULE_MODES.map((option) => (
                  <DropdownMenuItem
                    key={option}
                    disabled={row.original.mode === option}
                    onClick={async () => onModeChange(row.original, option)}
                  >
                    {t(ADMIN_RULE_MODE_MAP[option])}
                  </DropdownMenuItem>
                ))}

                <DropdownMenuSeparator />

                <AdminRuleDeleteDialog
                  ruleId={row.original.id}
                  ruleName={row.original.name}
                  trigger={
                    <DropdownMenuItem asChild onSelect={(event) => event.preventDefault()}>
                      <div>
                        <Trash2Icon className="mr-2 h-4 w-4" />
                        <Trans>Delete</Trans>
                      </div>
                    </DropdownMenuItem>
                  }
                />
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      },
    ] satisfies DataTableColumnDef<TAdminRuleListItem>[];
  }, [rules, allRuleIds, isReordering]);

  return (
    <DataTable
      columns={columns}
      data={rules}
      hasFilters={hasFilters}
      onClearFilters={onClearFilters}
      emptyState={
        hasFilters ? undefined : (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <p className="font-medium text-sm">
              <Trans>No rules yet</Trans>
            </p>
            <p className="text-muted-foreground text-sm">
              <Trans>Create a rule to automatically respond to events across the platform.</Trans>
            </p>
          </div>
        )
      }
      error={{
        enable: isLoadingError,
      }}
      skeleton={{
        enable: isLoading,
        rows: 3,
        component: (
          <>
            <TableCell className="w-1/3 py-4 pr-4">
              <Skeleton className="h-4 w-2/3" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-24 rounded-full" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-16 rounded-full" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-6" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-20" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-5 w-10 rounded-full" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-6" />
            </TableCell>
          </>
        ),
      }}
    />
  );
};
