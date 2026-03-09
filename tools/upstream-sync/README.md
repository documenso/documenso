# Upstream Sync Pipeline

Automated pipeline for syncing upstream [Documenso](https://github.com/documenso/documenso) changes into the Davinci Sign fork while preserving branding customizations.

## How It Works

1. **Detect** - Compares `origin/main` with `upstream/main` to find new commits
2. **Merge** - Creates an `upstream-sync/YYYY-MM-DD` branch and attempts `git merge`
3. **Resolve** - If conflicts exist or branding files are touched, an AI agent (Claude) resolves them using the branding rules in `config.yaml`
4. **Validate** - Runs `tsc --noEmit` to confirm type-safety
5. **Deliver** - Auto-merges to main (confidence >= 0.95) or creates a draft PR for manual review

## Prerequisites

- Python 3.11+
- Node.js 22+ (for validation stage)
- Anthropic API key (`ANTHROPIC_API_KEY`)
- GitHub token with repo scope (`GITHUB_TOKEN`)
- Microsoft Teams webhook URL (`TEAMS_WEBHOOK_URL`)

## Jenkins Job Setup

1. Create a new **Pipeline** job in Jenkins
2. Set the pipeline definition to **Pipeline script from SCM**
3. Point to this repository and set the script path to `tools/upstream-sync/Jenkinsfile`
4. Add the following credentials in Jenkins:
   - `anthropic-api-key` - Secret text with your Anthropic API key
   - `github-token` - Secret text with a GitHub PAT (repo scope)
   - `teams-webhook-url` - Secret text with the Teams incoming webhook URL
   - `f1b484af-24eb-4f28-a57a-66db51117a73` - Username/password for Git HTTPS auth (already exists)
5. The job triggers daily at ~6:00 AM via cron, or can be run manually with parameters

### Manual Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `UPSTREAM_REF` | String | *(empty)* | Specific upstream ref to sync (tag, SHA, branch). Empty = `upstream/main` HEAD |
| `FORCE_CLAUDE` | Boolean | `false` | Force AI resolution even on clean merges (branding drift detection) |
| `DRY_RUN` | Boolean | `false` | Run full pipeline without pushing or creating PRs |

## Local Usage

### Run the branding resolver manually

```bash
cd tools/upstream-sync
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

python -m branding_resolver \
    --repo ../.. \
    --our-branch origin/main \
    --upstream-branch upstream/main \
    --output-pr-body sync-output/pr_body.md \
    --verbose
```

### Check for branding drift without merging

```bash
python -m branding_resolver \
    --repo ../.. \
    --our-branch origin/main \
    --upstream-branch upstream/main \
    --dry-run \
    --verbose
```

## config.yaml Reference

| Section | Key | Description |
|---------|-----|-------------|
| `upstream` | `remote_url` | URL of the upstream Documenso repository |
| `fork` | `main_branch` | Branch to merge upstream changes into |
| `sync` | `branch_format` | Pattern for sync branch names |
| `classification.branding_only_patterns` | - | Glob patterns for binary/asset branding files (always keep ours) |
| `classification.branding_text_patterns` | - | Paths to text files with branding strings |
| `classification.branding_replacements` | - | Find/replace pairs for rebranding (old/new/context) |
| `confidence` | `auto_merge_threshold` | Minimum confidence score for unattended merge (0.95) |
| `agent` | `model` | Claude model used for conflict resolution |

## Output Files

The pipeline writes intermediate artifacts to `sync-output/`:

| File | Description |
|------|-------------|
| `changed_files.txt` | All files changed upstream since last sync |
| `branding_touched.txt` | Subset of changed files matching branding patterns |
| `conflicted_files.txt` | Files with merge conflicts (if any) |
| `confidence.txt` | Numeric confidence score from the AI agent |
| `pr_body.md` | Generated PR description with change summary |
