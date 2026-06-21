import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Regression guard for #2999: React Email renders <Preview> wherever it sits in
// the tree. If it is placed between <Head /> and <Body>, the preview text is
// emitted between </head> and <body>, which is invalid markup that some email
// clients (e.g. SendGrid) drop, resulting in an empty email body. <Preview> must
// therefore live inside <Body>.

const templatesDir = dirname(fileURLToPath(import.meta.url));

const templateFiles = readdirSync(templatesDir).filter((file) => file.endsWith('.tsx') && !file.endsWith('.test.tsx'));

describe('email template <Preview> placement', () => {
  it('finds template files to check', () => {
    expect(templateFiles.length).toBeGreaterThan(0);
  });

  it.each(templateFiles)('%s renders <Preview> inside <Body>', (file) => {
    const source = readFileSync(join(templatesDir, file), 'utf8');

    const previewIndex = source.indexOf('<Preview');
    const bodyIndex = source.indexOf('<Body');

    // Templates without a preview are not affected by this rule.
    if (previewIndex === -1) {
      return;
    }

    expect(bodyIndex, `${file} should render <Body>`).toBeGreaterThan(-1);
    expect(
      previewIndex,
      `${file}: <Preview> must be placed inside <Body> (after it), not between <Head /> and <Body>`,
    ).toBeGreaterThan(bodyIndex);
  });
});
