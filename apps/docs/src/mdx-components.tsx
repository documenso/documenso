import * as TabsComponents from 'fumadocs-ui/components/tabs';
import defaultMdxComponents from 'fumadocs-ui/mdx';
import type { MDXComponents } from 'mdx/types';
import { Mermaid } from '@/components/mdx/mermaid';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getMDXComponents(components?: MDXComponents): any {
  return {
    ...defaultMdxComponents,
    ...TabsComponents,
    Mermaid,
    ...components,
  };
}
