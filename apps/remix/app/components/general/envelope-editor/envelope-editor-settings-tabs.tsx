import type { TEnvelopeEditorSettings } from '@documenso/lib/types/envelope-editor';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import type { MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react/macro';
import { BellRingIcon, type LucideIcon, MailIcon, SettingsIcon, ShieldIcon } from 'lucide-react';

type EnvelopeEditorSettingsConfig = NonNullable<TEnvelopeEditorSettings['settings']>;

export type EnvelopeEditorSettingsTabId = 'general' | 'reminders' | 'notifications' | 'security';

export type EnvelopeEditorSettingsTab = {
  id: EnvelopeEditorSettingsTabId;
  title: MessageDescriptor;
  description: MessageDescriptor;
  icon: LucideIcon;
  isEnabled: (settings: EnvelopeEditorSettingsConfig) => boolean;
};

export const ENVELOPE_EDITOR_SETTINGS_TABS: EnvelopeEditorSettingsTab[] = [
  {
    id: 'general',
    title: msg`General`,
    description: msg`Configure document settings and options before sending.`,
    icon: SettingsIcon,
    isEnabled: () => true,
  },
  {
    id: 'reminders',
    title: msg`Reminders`,
    description: msg`Configure signing reminder settings for the document.`,
    icon: BellRingIcon,
    isEnabled: (settings) => settings.allowConfigureReminders,
  },
  {
    id: 'notifications',
    title: msg`Notifications`,
    description: msg`Configure notification settings for the document.`,
    icon: MailIcon,
    isEnabled: (settings) => settings.allowConfigureDistribution,
  },
  {
    id: 'security',
    title: msg`Security`,
    description: msg`Configure security settings for the document.`,
    icon: ShieldIcon,
    isEnabled: () => true,
  },
];

export type EnvelopeEditorSettingsTabsProps = {
  settings: EnvelopeEditorSettingsConfig;
  activeTab: EnvelopeEditorSettingsTabId;
  onActiveTabChange: (tab: EnvelopeEditorSettingsTabId) => void;
};

export const EnvelopeEditorSettingsTabs = ({
  settings,
  activeTab,
  onActiveTabChange,
}: EnvelopeEditorSettingsTabsProps) => {
  const { t } = useLingui();

  const visibleTabs = ENVELOPE_EDITOR_SETTINGS_TABS.filter((tab) => tab.isEnabled(settings));

  return (
    <>
      <nav className="scrollbar-hidden flex overflow-x-auto px-4 md:hidden">
        {visibleTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            aria-current={activeTab === tab.id ? 'true' : undefined}
            onClick={(event) => {
              onActiveTabChange(tab.id);

              event.currentTarget.scrollIntoView({ inline: 'nearest', block: 'nearest' });
            }}
            className={cn(
              'shrink-0 whitespace-nowrap border-b-2 px-3 py-2.5 font-medium text-sm transition-colors',
              activeTab === tab.id
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t(tab.title)}
          </button>
        ))}
      </nav>

      <nav className="mb-8 hidden w-full flex-col items-start gap-y-2 px-4 md:flex">
        {visibleTabs.map((tab) => (
          <Button
            key={tab.id}
            variant="ghost"
            aria-current={activeTab === tab.id ? 'true' : undefined}
            className={cn('w-full justify-start', {
              'bg-secondary': activeTab === tab.id,
            })}
            onClick={() => onActiveTabChange(tab.id)}
          >
            <tab.icon className="mr-2 h-5 w-5" />
            {t(tab.title)}
          </Button>
        ))}
      </nav>
    </>
  );
};
