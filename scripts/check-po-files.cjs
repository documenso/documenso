#!/usr/bin/env node

/* eslint-disable @typescript-eslint/no-var-requires */
const { execFileSync } = require('child_process');

/**
 * Check if we're running in CI or if Husky is disabled
 * This shouldn't happen since Husky already checks, but defensive
 */
const isCI = process.env.CI === 'true' || process.env.CI === '1';
const isHuskyDisabled = process.env.HUSKY === '0';

if (isCI || isHuskyDisabled) {
  console.log('Skipping .po file check (CI environment detected)');
  process.exit(0);
}

/**
 * Get list of staged .po files in translations directory
 */
const getStagedPoFiles = () => {
  try {
    // Use -z flag for null-terminated output to handle special characters in filenames
    const output = execFileSync(
      'git',
      ['diff', '--cached', '--name-only', '-z', '--diff-filter=ACMR'],
      {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      },
    );

    // Split on null character instead of newline for proper special character handling
    const stagedFiles = output.split('\0').filter(Boolean);

    // Filter for .po files in the translations directory (using startsWith for precise matching)
    return stagedFiles.filter((file) => {
      return file.startsWith('packages/lib/translations/') && file.endsWith('.po');
    });
  } catch (error) {
    // Fail open: if git command fails, don't block commits
    // This prevents the hook from breaking the entire commit flow
    console.error('Warning: Could not check staged files:', error.message);
    return [];
  }
};

/**
 * Unstage the specified files
 * Handles both normal commits and initial commits (where HEAD doesn't exist)
 */
const unstageFiles = (files) => {
  if (files.length === 0) return;

  try {
    // Check if HEAD exists (not an initial commit)
    try {
      execFileSync('git', ['rev-parse', '--verify', 'HEAD'], {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      // HEAD exists, use normal reset
      execFileSync('git', ['reset', 'HEAD', '--', ...files], {
        encoding: 'utf8',
        stdio: 'inherit',
      });
    } catch (headError) {
      // Initial commit - HEAD doesn't exist, use git rm --cached instead
      execFileSync('git', ['rm', '--cached', '--', ...files], {
        encoding: 'utf8',
        stdio: 'inherit',
      });
    }
  } catch (error) {
    console.error('Error unstaging files:', error.message);
  }
};

// Main execution
const main = () => {
  const poFiles = getStagedPoFiles();

  if (poFiles.length > 0) {
    // Silently unstage .po files and let commit proceed with remaining files
    unstageFiles(poFiles);
  }

  // Allow commit to proceed (with or without .po files unstaged)
  process.exit(0);
};

main();
