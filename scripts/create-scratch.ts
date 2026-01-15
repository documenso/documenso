#!/usr/bin/env node
import { readFileSync } from 'fs';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

import { generateId } from './utils/generate-id';

const SCRATCHES_DIR = join(process.cwd(), '.agents', 'scratches');

const main = () => {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: npx tsx scripts/create-scratch.ts "file-slug" [content]');
    console.error('  or:   npx tsx scripts/create-scratch.ts "file-slug" << HEREDOC');
    process.exit(1);
  }

  const slug = args[0];
  let content = '';

  // Check if content is provided as second argument
  if (args.length > 1) {
    content = args.slice(1).join(' ');
  } else {
    // Read from stdin (heredoc)
    try {
      const stdin = readFileSync(0, 'utf-8');
      content = stdin.trim();
    } catch (error) {
      console.error('Error reading from stdin:', error);
      process.exit(1);
    }
  }

  if (!content) {
    console.error('Error: No content provided');
    process.exit(1);
  }

  // Generate unique ID
  const id = generateId();
  const filename = `${id}-${slug}.md`;
  const filepath = join(SCRATCHES_DIR, filename);

  // Format title from slug (kebab-case to Title Case)
  const title = slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  // Get current date in ISO format
  const date = new Date().toISOString().split('T')[0];

  // Create frontmatter
  const frontmatter = `---
date: ${date}
title: ${title}
---

`;

  // Ensure directory exists
  mkdirSync(SCRATCHES_DIR, { recursive: true });

  // Write file with frontmatter
  writeFileSync(filepath, frontmatter + content, 'utf-8');

  console.log(`Created scratch: ${filepath}`);
  console.log(`ID: ${id}`);
  console.log(`Filename: ${filename}`);
};

main();
