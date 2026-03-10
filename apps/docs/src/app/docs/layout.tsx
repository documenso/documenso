'use client';

import { useMemo } from 'react';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/cn';
import { baseOptions } from '@/lib/layout.shared';
import { getFilteredPageTree, source } from '@/lib/source';
import type * as PageTree from 'fumadocs-core/page-tree';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { CodeIcon, ServerIcon, UserIcon } from 'lucide-react';

const ROOT_SECTIONS = [
  {
    id: 'users',
    label: 'Users',
    subtitle: 'Send and sign documents',
    icon: UserIcon,
    href: '/docs/users',
  },
  {
    id: 'developers',
    label: 'Developers',
    subtitle: 'API and integrations',
    icon: CodeIcon,
    href: '/docs/developers',
  },
  {
    id: 'self-hosting',
    label: 'Self-Hosting',
    subtitle: 'Deploy your own instance',
    icon: ServerIcon,
    href: '/docs/self-hosting',
  },
];

// Find first page item in folder children
function getFirstPageUrl(children: PageTree.Node[]): string | undefined {
  for (const child of children) {
    if (child.type === 'page') {
      return child.url;
    }
    if (child.type === 'folder' && child.children.length > 0) {
      const url = getFirstPageUrl(child.children);
      if (url) return url;
    }
  }
  return undefined;
}

function SectionSwitcher({ activeSection }: { activeSection: string | null }) {
  return (
    <div className="flex flex-col gap-1">
      {ROOT_SECTIONS.map((section) => {
        const isActive = activeSection === section.id;
        const Icon = section.icon;
        return (
          <Link
            key={section.id}
            href={section.href}
            className={cn(
              'flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors',
              isActive
                ? 'bg-fd-primary/10 text-fd-primary'
                : 'text-fd-muted-foreground hover:bg-fd-accent hover:text-fd-accent-foreground',
            )}
          >
            <Icon className={cn('mt-0.5 size-4 shrink-0', isActive ? 'text-fd-primary' : '')} />
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">{section.label}</span>
              <span
                className={cn(
                  'text-xs',
                  isActive ? 'text-fd-muted-foreground' : 'text-fd-muted-foreground/70',
                )}
              >
                {section.subtitle}
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const { tree, activeSection } = useMemo(() => {
    // Check if we're in a root section
    const pathParts = pathname.split('/').filter(Boolean);
    // pathParts = ['docs', 'users', 'getting-started', ...]

    if (pathParts.length >= 2) {
      const section = pathParts[1]; // 'users', 'developers', or 'self-hosting'
      if (ROOT_SECTIONS.some((s) => s.id === section)) {
        return { tree: getFilteredPageTree(section), activeSection: section };
      }
    }

    // Default: show full tree
    return { tree: source.getPageTree(), activeSection: null };
  }, [pathname]);

  return (
    <DocsLayout
      tree={tree}
      {...baseOptions()}
      sidebar={{
        banner: <SectionSwitcher activeSection={activeSection} />,
      }}
    >
      {children}
    </DocsLayout>
  );
}
