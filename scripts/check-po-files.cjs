#!/usr/bin/env node

/* eslint-disable @typescript-eslint/no-var-requires */
const { execFileSync } = require('child_process');

const isCI = process.env.CI === 'true' || process.env.CI === '1';
const isHuskyDisabled = process.env.HUSKY === '0';

if (isCI || isHuskyDisabled) {
  console.log('Skipping .po file check (CI environment detected)');
  process.exit(0);
}

const getStagedPoFiles = () => {
  try {
    const output = execFileSync(
      'git',
      ['diff', '--cached', '--name-only', '-z', '--diff-filter=ACMR'],
      {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      },
    );

    const stagedFiles = output.split('\0').filter(Boolean);

    return stagedFiles.filter((file) => {
      return file.startsWith('packages/lib/translations/') && file.endsWith('.po');
    });
  } catch (error) {
    console.error('Warning: Could not check staged files:', error.message);
    return [];
  }
};

const unstageFiles = (files) => {
  if (files.length === 0) return;

  try {
    try {
      execFileSync('git', ['rev-parse', '--verify', 'HEAD'], {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      execFileSync('git', ['reset', 'HEAD', '--', ...files], {
        encoding: 'utf8',
        stdio: 'inherit',
      });
    } catch (headError) {
      execFileSync('git', ['rm', '--cached', '--', ...files], {
        encoding: 'utf8',
        stdio: 'inherit',
      });
    }
  } catch (error) {
    console.error('Error unstaging files:', error.message);
  }
};

const main = () => {
  const poFiles = getStagedPoFiles();

  if (poFiles.length > 0) {
    unstageFiles(poFiles);
  }

  process.exit(0);
};

main();
