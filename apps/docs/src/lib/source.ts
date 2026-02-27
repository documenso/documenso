import type * as PageTree from 'fumadocs-core/page-tree';
import { type InferPageType, loader } from 'fumadocs-core/source';
import { lucideIconsPlugin } from 'fumadocs-core/source/lucide-icons';
import { docs } from 'fumadocs-mdx:collections/server';

// See https://fumadocs.dev/docs/headless/source-api for more info
export const source = loader({
  baseUrl: '/docs',
  source: docs.toFumadocsSource(),
  plugins: [lucideIconsPlugin()],
});

// Shared sections that should appear in all main section sidebars
const SHARED_SECTIONS = ['concepts', 'compliance', 'policies'];

// Section titles for the sidebar separators
const SECTION_TITLES: Record<string, string> = {
  users: 'User Guide',
  developers: 'Developer Guide',
  'self-hosting': 'Self-Hosting Guide',
};

/**
 * Get a filtered page tree showing a specific root folder's content
 * plus the shared sections (Concepts, Compliance, Policies)
 */
export function getFilteredPageTree(rootName: string): PageTree.Root {
  const fullTree = source.getPageTree();

  // Find the main section folder
  const rootFolder = fullTree.children.find(
    (child): child is PageTree.Folder =>
      child.type === 'folder' &&
      typeof child.name === 'string' &&
      child.name.toLowerCase() === rootName.toLowerCase(),
  );

  if (!rootFolder) {
    return fullTree;
  }

  // Find shared section folders
  const sharedFolders = fullTree.children.filter(
    (child): child is PageTree.Folder =>
      child.type === 'folder' &&
      typeof child.name === 'string' &&
      SHARED_SECTIONS.includes(child.name.toLowerCase()),
  );

  // Create separator for main section
  const mainSeparator: PageTree.Separator = {
    type: 'separator',
    name: SECTION_TITLES[rootName.toLowerCase()] || rootName,
  };

  // Create separator for shared sections
  const sharedSeparator: PageTree.Separator = {
    type: 'separator',
    name: 'Resources',
  };

  // Return a new tree with separators and content
  return {
    name: fullTree.name,
    children: [mainSeparator, ...rootFolder.children, sharedSeparator, ...sharedFolders],
  };
}

export function getPageImage(page: InferPageType<typeof source>) {
  const segments = [...page.slugs, 'image.png'];

  return {
    segments,
    url: `/og/docs/${segments.join('/')}`,
  };
}

export async function getLLMText(page: InferPageType<typeof source>) {
  const processed = await page.data.getText('processed');

  return `# ${page.data.title}

${processed}`;
}
