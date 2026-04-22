---
name: deploy-to-aws
description: Deploys this Documenso fork to the user's own AWS account, and updates an existing deployment with the latest code from upstream documenso/documenso. Use when the user has forked or cloned this repo and wants to (a) stand Documenso up for the first time, or (b) pull in new upstream changes and redeploy. Triggers include "deploy to AWS", "set this up on AWS", "install this fork", "get this running", "deploy my Documenso", "update from upstream", "sync with upstream", "pull the latest Documenso", "upgrade my Documenso", "redeploy with the new upstream code".
---

# Deploy This Documenso Fork to AWS

## Overview

Walk the user through deploying this Documenso fork into their own AWS account end-to-end. The CloudFormation template at `cfn/documenso.yml` creates the entire stack: the customer brings their existing VPC + subnets + Route 53 hosted zone; everything else — ECS Fargate, RDS Postgres, S3 uploads bucket, ALB, ACM cert, Route 53 alias, Secrets Manager entries — is created fresh inside their account.

Target user is a technical founder or admin with AWS access but limited CloudFormation fluency. Do the work for them by driving the AWS CLI directly. Don't dump docs; don't run opaque scripts.

## Operating principles

- **Drive the AWS CLI directly.** Each step is one `aws ...` command. Surface the raw error text to the user when something fails so you can troubleshoot together.
- **Persist parameters to `.deploy.env`.** Write interview answers to `.deploy.env` in the repo root and `source` it before each step. This survives restarts and keeps secrets out of shell history. `.env*` is gitignored at the repo root.
- **Never echo secret values back.** When showing a summary, mask anything matching `*_CLIENT_SECRET`, `*_SECRET`, `*_PASSPHRASE`, `*_PASSWORD` as `***`.
- **Confirm before spending money.** The stack is billable (~$40–100/month small, more at scale). Show a summary and wait for explicit "yes" before `aws cloudformation deploy`.
- **One CFN template.** Use the committed `cfn/documenso.yml` as-is. Modify `infra/` only if the user specifically asks.

## Two workflows

- **Workflow A — First deploy** (this document). Triggers: "deploy", "set up", "install", "get this running".
- **Workflow B — Update from upstream**. Triggers: "update", "sync", "pull latest", "upgrade". See `references/update-from-upstream.md`.

Both reuse the same `.deploy.env` and AWS profile.

## Workflow A — First deploy

### Step 1 — Preflight

```bash
aws --version
docker version --format '{{.Client.Version}}'
openssl version
```

If `aws` is missing: point to https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html and stop.
If `openssl` is missing: offer to install via `apt` / `brew` / `yum` (needed for the signing cert step). Ask before installing.

#### 1a. AWS profile

Ask: **"Which AWS profile should we use?"** Verify with `aws sts get-caller-identity --profile <profile>`. If no profile, walk the user through `aws configure --profile documenso`. Don't ask the user to paste credentials into chat — `aws configure` reads them on stdin.

For first-time deploys, recommend attaching AWS-managed `AdministratorAccess` temporarily, or the scoped policy in `references/iam-policy.json`. Scope down afterward.

#### 1b. Capture core values

- Account ID (`aws sts get-caller-identity --query Account`)
- Identity ARN (for IAM simulation in step 2f)
- Region (from `aws configure get region` or ask)

### Step 2 — Interview

Create `.deploy.env` with these keys:

```env
# AWS target
AWS_PROFILE=<profile>
AWS_REGION=<region>

# Stack
STACK_NAME=documenso-prod
ENV_NAME=prod

# Networking (step 2a)
VPC_ID=vpc-xxxxxxxx
SUBNET_IDS=subnet-xxx,subnet-yyy
DOMAIN=sign.example.com
HOSTED_ZONE_ID=ZXXXXXXXXXXX

# Application
APP_NAME=Documenso
ALLOWED_SIGNUP_DOMAINS=            # comma-separated; blank = any domain
CONTAINER_IMAGE=                   # filled in step 4

# SSO — Microsoft/Entra (this fork ships Microsoft SSO by default)
MICROSOFT_TENANT_ID=common          # your Entra tenant ID, or 'common' for multi-tenant
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=

# SMTP (step 2e — required for signing invitations)
SMTP_HOST=
SMTP_PORT=587
SMTP_USERNAME=
SMTP_PASSWORD=
SMTP_FROM_ADDRESS=

# Signing cert (step 2f — auto-generated or user-provided .p12)
SIGNING_CERT_SOURCE=self-signed    # self-signed | provided
SIGNING_CERT_PATH=                 # only if SIGNING_CERT_SOURCE=provided
SIGNING_PASSPHRASE=

# Sizing (see references/sizing.md)
DB_INSTANCE_CLASS=t4g.small
DB_STORAGE_GB=20
FARGATE_CPU=512
FARGATE_MEMORY=1024
DESIRED_COUNT=1
```

If `.deploy.env` exists, read it and ask whether to reuse or overwrite.

#### 2a. Network discovery

```bash
aws ec2 describe-vpcs --profile "$AWS_PROFILE" --region "$AWS_REGION" \
  --query 'Vpcs[].{Id:VpcId,Cidr:CidrBlock,Default:IsDefault,Name:Tags[?Key==`Name`]|[0].Value}' \
  --output table

aws ec2 describe-subnets --profile "$AWS_PROFILE" --region "$AWS_REGION" \
  --filters "Name=vpc-id,Values=$VPC_ID" "Name=map-public-ip-on-launch,Values=true" \
  --query 'Subnets[].{Id:SubnetId,Az:AvailabilityZone,Cidr:CidrBlock}' --output table
```

Need ≥2 public subnets in different AZs.

#### 2b. Hosted zone discovery

```bash
aws route53 list-hosted-zones --profile "$AWS_PROFILE" \
  --query 'HostedZones[].{Id:Id,Name:Name,Records:ResourceRecordSetCount}' --output table
```

Strip `/hostedzone/` prefix from the Id for `HOSTED_ZONE_ID`.

#### 2c. Microsoft Entra SSO

This fork ships with Microsoft SSO as the default. The user registers an app in their Entra tenant:

- Redirect URI: `https://<DOMAIN>/api/auth/callback/microsoft`
- API permissions: `openid`, `email`, `profile`
- Certificates & secrets: generate a client secret — copy the **Value** (shown once)

See `references/sso-interview.md` for the step-by-step if they haven't done this before. Write `MICROSOFT_TENANT_ID`, `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET` into `.deploy.env`.

For Google or generic OIDC, the template doesn't expose these as CfnParameters — the skill sets them via `secretsmanager update-secret` after deploy (see step 6). If the user wants Google as the only provider, guide them through the Google OAuth registration first and capture the client ID/secret in `.deploy.env`.

#### 2d. Sizing

See `references/sizing.md`. Default to small for a first deploy.

#### 2e. SMTP

Documenso sends signing invitations, notifications, and account verification emails — SMTP is required. Two paths:

1. **AWS SES** (recommended) — see `references/ses.md` for full setup (identity verification, sandbox exit, deriving SMTP password from an IAM user's access key).
2. **External SMTP** (SendGrid, Postmark, Mailgun, Resend, etc.) — prompt for host/port/username/password/from.

Write all five SMTP values to `.deploy.env`. `SMTP_FROM_ADDRESS` must be a verified sender at the chosen provider.

#### 2f. Signing certificate (two-track)

Documenso signs PDFs via a KMS-backed X.509 certificate. The CDK creates the KMS key; the skill generates a cert against that key and uploads the PEM after stack deploy (Step 6). At this interview stage, only collect the subject info for the cert:

Ask (or infer from earlier answers — app name, org, admin email):

```
CERT_CN  = "$APP_NAME"                    # e.g. "TechnologyMatch Signature"
CERT_O   = "<user's legal org name>"      # e.g. "TechnologyMatch"
CERT_OU  = "Documenso"
CERT_EMAIL = "<admin email>"
```

Write these to `.deploy.env`:

```bash
cat >> .deploy.env <<EOF
SIGNING_CERT_CN="$CERT_CN"
SIGNING_CERT_O="$CERT_O"
SIGNING_CERT_OU="$CERT_OU"
SIGNING_CERT_EMAIL="$CERT_EMAIL"
EOF
```

**Do NOT generate the cert here.** The cert is generated in Step 6 after the CFN stack creates the KMS key — we need the key's public half to sign the cert against. The KMS key ARN comes from the `SigningKmsSigningKeyArn` stack output.

Print a **loud** banner so the deployer cannot miss it:

```
══════════════════════════════════════════════════════════════════════════
⚠️  SELF-SIGNED CERTIFICATE — DO NOT USE FOR REAL CONTRACTS YET  ⚠️
══════════════════════════════════════════════════════════════════════════
PDFs signed with this cert verify as "signature VALID, identity NOT TRUSTED"
in Adobe Reader. Counterparties, courts, and auditors will NOT accept these
signatures as legally binding.

Fine for:   internal pilot, UI/UX walkthrough, dev/staging environments.
NOT for:    real signed contracts, external counterparties, production use.

BEFORE sending any real contracts, upgrade to an AATL CA cert:
  → see references/signing-cert.md for the procurement runbook
  → typical cost: $200-500/year
  → typical timeline: 2-5 business days after payment
  → the swap is a 30-second Secrets Manager update; no code/infra change
══════════════════════════════════════════════════════════════════════════
```

If the deployer already has an AATL-issued cert (PEM) against an existing KMS key they'll supply later, note that in `.deploy.env` as `SIGNING_CERT_SOURCE=external` and skip the self-sign in Step 6 — they'll paste the PEM directly into the secret. For everyone else the self-signed flow is the default.

#### 2g. Validation pass

```bash
source .deploy.env

# 1. Domain is a subdomain of the picked hosted zone
ZONE_NAME=$(aws route53 get-hosted-zone --id "$HOSTED_ZONE_ID" --profile "$AWS_PROFILE" \
  --query 'HostedZone.Name' --output text)
if [[ "$DOMAIN." != *".$ZONE_NAME" && "$DOMAIN." != "$ZONE_NAME" ]]; then
  echo "ERROR: $DOMAIN is not a subdomain of $ZONE_NAME"
fi

# 2. No existing Route 53 record would conflict
aws route53 list-resource-record-sets --profile "$AWS_PROFILE" \
  --hosted-zone-id "$HOSTED_ZONE_ID" \
  --query "ResourceRecordSets[?Name=='$DOMAIN.'].{Name:Name,Type:Type}" --output table

# 3. IAM simulate
CALLER_ARN=$(aws sts get-caller-identity --profile "$AWS_PROFILE" --query Arn --output text)
aws iam simulate-principal-policy --profile "$AWS_PROFILE" \
  --policy-source-arn "$CALLER_ARN" \
  --action-names \
    cloudformation:CreateStack ecs:CreateCluster rds:CreateDBInstance \
    s3:CreateBucket iam:CreateRole iam:PassRole secretsmanager:CreateSecret \
    ecr:CreateRepository acm:RequestCertificate route53:ChangeResourceRecordSets \
    elasticloadbalancing:CreateLoadBalancer \
  --query 'EvaluationResults[?EvalDecision!=`allowed`].{Action:EvalActionName,Decision:EvalDecision}' \
  --output table
```

Surface any failure, fix before confirmation.

#### 2h. Confirmation

Print a summary with `*_SECRET`, `*_PASSWORD`, `*_PASSPHRASE` masked as `***`. Mention approximate monthly cost. Ask for explicit "yes".

### Step 3 — IAM permissions

Show `references/iam-policy.json` if scoped. Smoke-test:

```bash
aws cloudformation validate-template \
  --template-body file://cfn/documenso.yml \
  --profile "$AWS_PROFILE" --region "$AWS_REGION"
```

### Step 4 — Container image

#### Path A — Build and push to ECR

```bash
source .deploy.env
ACCOUNT_ID=$(aws sts get-caller-identity --profile "$AWS_PROFILE" --query Account --output text)
REGISTRY="$ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"
TAG=$(git rev-parse --short HEAD)

aws ecr describe-repositories --repository-names documenso \
  --profile "$AWS_PROFILE" --region "$AWS_REGION" 2>/dev/null || \
  aws ecr create-repository --repository-name documenso \
    --profile "$AWS_PROFILE" --region "$AWS_REGION" \
    --image-scanning-configuration scanOnPush=true

aws ecr get-login-password --profile "$AWS_PROFILE" --region "$AWS_REGION" \
  | docker login --username AWS --password-stdin "$REGISTRY"

IMAGE_URI="$REGISTRY/documenso:$TAG"
docker buildx build \
  --platform linux/amd64 \
  --file docker/Dockerfile \
  --tag "$IMAGE_URI" \
  --tag "$REGISTRY/documenso:latest" \
  --push .

echo "CONTAINER_IMAGE=$IMAGE_URI" >> .deploy.env
```

Build takes 10–20 minutes. Stream output.

#### Path B — Pre-built image

Ask for a full image URI (e.g. `ghcr.io/<owner>/documenso:<tag>`) and write `CONTAINER_IMAGE=` to `.deploy.env`.

### Step 5 — Deploy the stack

```bash
source .deploy.env

PARAMS=(
  "EnvName=$ENV_NAME"
  "VpcId=$VPC_ID"
  "SubnetIds=$SUBNET_IDS"
  "Domain=$DOMAIN"
  "HostedZoneId=$HOSTED_ZONE_ID"
  "ContainerImage=$CONTAINER_IMAGE"
  "AppName=$APP_NAME"
  "AllowedSignupDomains=$ALLOWED_SIGNUP_DOMAINS"
  "MicrosoftTenantId=$MICROSOFT_TENANT_ID"
  "SmtpFromAddress=$SMTP_FROM_ADDRESS"
  "DbInstanceClass=$DB_INSTANCE_CLASS"
  "DbStorageGb=$DB_STORAGE_GB"
  "FargateCpu=$FARGATE_CPU"
  "FargateMemory=$FARGATE_MEMORY"
  "DesiredCount=$DESIRED_COUNT"
)

aws cloudformation deploy \
  --profile "$AWS_PROFILE" --region "$AWS_REGION" \
  --stack-name "$STACK_NAME" \
  --template-file cfn/documenso.yml \
  --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM \
  --no-fail-on-empty-changeset \
  --parameter-overrides "${PARAMS[@]}"
```

Deploy takes 15–25 minutes (RDS dominates). The ECS service comes up with `desiredCount=1` but the tasks will **fail to start until Step 6 populates the secrets** — this is expected. Monitor with:

```bash
aws cloudformation describe-stack-events --profile "$AWS_PROFILE" --region "$AWS_REGION" \
  --stack-name "$STACK_NAME" \
  --query 'StackEvents[?ResourceStatus!=`CREATE_COMPLETE`] | [0:20].{Time:Timestamp,Resource:LogicalResourceId,Status:ResourceStatus,Reason:ResourceStatusReason}' \
  --output table
```

On failure see `references/troubleshooting.md`.

### Step 6 — Populate secrets (required)

The stack creates `documenso/<env>/app-config` and `documenso/<env>/database-url` with placeholder values. Fill them now.

#### 6a. Read stack outputs

```bash
source .deploy.env
aws cloudformation describe-stacks --profile "$AWS_PROFILE" --region "$AWS_REGION" \
  --stack-name "$STACK_NAME" --query 'Stacks[0].Outputs' --output table

# Capture what we need for the rest of Step 6
DB_ENDPOINT=$(aws cloudformation describe-stacks --profile "$AWS_PROFILE" --region "$AWS_REGION" \
  --stack-name "$STACK_NAME" --query "Stacks[0].Outputs[?OutputKey=='DatabaseDbEndpoint'].OutputValue" --output text)
APP_CONFIG_ARN=$(aws cloudformation describe-stacks --profile "$AWS_PROFILE" --region "$AWS_REGION" \
  --stack-name "$STACK_NAME" --query "Stacks[0].Outputs[?OutputKey=='SecretsAppConfigSecretArn'].OutputValue" --output text)
DB_URL_ARN=$(aws cloudformation describe-stacks --profile "$AWS_PROFILE" --region "$AWS_REGION" \
  --stack-name "$STACK_NAME" --query "Stacks[0].Outputs[?OutputKey=='SecretsDatabaseUrlSecretArn'].OutputValue" --output text)
SIGNING_KEY_ARN=$(aws cloudformation describe-stacks --profile "$AWS_PROFILE" --region "$AWS_REGION" \
  --stack-name "$STACK_NAME" --query "Stacks[0].Outputs[?OutputKey=='SigningKmsSigningKeyArn'].OutputValue" --output text)
```

#### 6b. Pull RDS credentials

RDS created its own secret with auto-generated credentials:

```bash
DB_SECRET=$(aws rds describe-db-instances --profile "$AWS_PROFILE" --region "$AWS_REGION" \
  --db-instance-identifier "documenso-db-$ENV_NAME" \
  --query 'DBInstances[0].MasterUserSecret.SecretArn' --output text)
DB_JSON=$(aws secretsmanager get-secret-value --profile "$AWS_PROFILE" --region "$AWS_REGION" \
  --secret-id "$DB_SECRET" --query SecretString --output text)
DB_USER=$(echo "$DB_JSON" | jq -r .username)
DB_PASS=$(echo "$DB_JSON" | jq -r .password)
```

#### 6c. Generate encryption keys

```bash
ENCRYPTION_KEY=$(openssl rand -hex 32)
ENCRYPTION_SECONDARY_KEY=$(openssl rand -hex 32)
NEXTAUTH_SECRET=$(openssl rand -base64 32 | tr -d '/+=' | head -c 32)
```

#### 6d. Generate the signing cert against the KMS key

The CFN stack created a KMS signing key (`SigningKeyArn`). Now we generate a self-signed X.509 cert whose subject-public-key *is* that KMS key's public half, signed *by* that KMS key. (This requires Python with `asn1crypto`, `cryptography`, `boto3` — the skill ships a helper that does exactly this.)

```bash
# One-time: set up a venv with the crypto deps if not already done
VENV="$HOME/.documenso-deploy-venv"
if [ ! -d "$VENV" ]; then
  uv venv "$VENV" --quiet || python3 -m venv "$VENV"
  "$VENV/bin/pip" install --quiet asn1crypto cryptography boto3
fi

# Run the helper (lives in the skill dir)
SKILL_DIR=".claude/skills/deploy-to-aws"
CERT_PEM=$(mktemp --suffix=.crt)

"$VENV/bin/python" "$SKILL_DIR/scripts/make-kms-cert.py" \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --key-id "$SIGNING_KEY_ARN" \
  --common-name "$SIGNING_CERT_CN" \
  --organization "$SIGNING_CERT_O" \
  --organizational-unit "$SIGNING_CERT_OU" \
  --email "$SIGNING_CERT_EMAIL" \
  --out "$CERT_PEM"

SIGNING_CERT_B64=$(base64 -w0 "$CERT_PEM")
```

Inspect the cert briefly so the deployer sees what just got generated:

```bash
openssl x509 -in "$CERT_PEM" -noout -subject -issuer -dates
```

#### 6e. Update app-config secret

```bash
aws secretsmanager put-secret-value \
  --profile "$AWS_PROFILE" --region "$AWS_REGION" \
  --secret-id "$APP_CONFIG_ARN" \
  --secret-string "$(jq -n \
    --arg nextauth "$NEXTAUTH_SECRET" \
    --arg ek "$ENCRYPTION_KEY" --arg esk "$ENCRYPTION_SECONDARY_KEY" \
    --arg mcid "$MICROSOFT_CLIENT_ID" --arg msec "$MICROSOFT_CLIENT_SECRET" \
    --arg sh "$SMTP_HOST" --arg sp "$SMTP_PORT" \
    --arg su "$SMTP_USERNAME" --arg spw "$SMTP_PASSWORD" \
    --arg cert "$SIGNING_CERT_B64" \
    '{
      NEXTAUTH_SECRET: $nextauth,
      NEXT_PRIVATE_ENCRYPTION_KEY: $ek,
      NEXT_PRIVATE_ENCRYPTION_SECONDARY_KEY: $esk,
      NEXT_PRIVATE_MICROSOFT_CLIENT_ID: $mcid,
      NEXT_PRIVATE_MICROSOFT_CLIENT_SECRET: $msec,
      NEXT_PRIVATE_SMTP_HOST: $sh,
      NEXT_PRIVATE_SMTP_PORT: $sp,
      NEXT_PRIVATE_SMTP_USERNAME: $su,
      NEXT_PRIVATE_SMTP_PASSWORD: $spw,
      NEXT_PRIVATE_SIGNING_AWS_KMS_PUBLIC_CRT_FILE_CONTENTS: $cert
    }')"
```

Note what changed vs older local-transport deploys:
- No `NEXT_PRIVATE_SIGNING_PASSPHRASE` (KMS holds the key — no passphrase)
- No `NEXT_PRIVATE_SIGNING_LOCAL_FILE_CONTENTS` (no `.p12` — we use KMS directly)
- `NEXT_PRIVATE_SIGNING_AWS_KMS_KEY_ID` and `_REGION` are set as plain env vars by CFN (not secrets) — no action needed here

#### 6f. Update database-url secret

```bash
DB_URL="postgresql://$DB_USER:$DB_PASS@$DB_ENDPOINT:5432/documenso"
aws secretsmanager put-secret-value \
  --profile "$AWS_PROFILE" --region "$AWS_REGION" \
  --secret-id "$DB_URL_ARN" \
  --secret-string "{\"NEXT_PRIVATE_DATABASE_URL\":\"$DB_URL\",\"NEXT_PRIVATE_DIRECT_DATABASE_URL\":\"$DB_URL\"}"
```

#### 6g. Force new deployment

```bash
aws ecs update-service --profile "$AWS_PROFILE" --region "$AWS_REGION" \
  --cluster "documenso-$ENV_NAME" --service "documenso-$ENV_NAME" \
  --force-new-deployment --no-cli-pager

aws ecs wait services-stable --profile "$AWS_PROFILE" --region "$AWS_REGION" \
  --cluster "documenso-$ENV_NAME" --services "documenso-$ENV_NAME"
```

Prisma migrations run automatically on first boot via `docker/start.sh`.

### Step 7 — Verify

```bash
curl -fsS "https://$DOMAIN/api/health"
```

Should return 200. If not, check ECS task logs in CloudWatch (`/documenso/$ENV_NAME`).

Visit `https://$DOMAIN` in a browser:
- Microsoft sign-in button appears (upstream signin UI)
- Sign in with a user whose email matches `ALLOWED_SIGNUP_DOMAINS` (or any domain if blank)
- Upload a PDF, add a signer, complete the flow end-to-end

Print the cert info for confirmation:

```bash
echo "$SIGNING_CERT_B64" | base64 -d | openssl pkcs12 -info -nokeys -nomacver \
  -passin "pass:$SIGNING_PASSPHRASE" 2>/dev/null | grep -E "subject|issuer|Not"
```

### Final deploy summary — print this verbatim

Always end the deploy session with this summary so the deployer knows the **one
remaining step before real contracts can be sent**:

```
══════════════════════════════════════════════════════════════════════════
✅  DEPLOY COMPLETE  →  <https://DOMAIN>
══════════════════════════════════════════════════════════════════════════
What works right now:
  • SSO login
  • PDF upload, field placement, signing UI, email invitations
  • Cryptographically valid signatures (signer cannot forge them)

What does NOT work yet (if you chose self-signed):
  • Signatures are NOT AATL-trusted. Adobe Reader shows:
      "Signature valid. Signer's identity is UNKNOWN / not trusted."
  • Most counterparties, courts, and auditors will NOT accept these
    as legally binding. DO NOT SEND REAL CONTRACTS until you upgrade.

Before real contracts:
  1. Buy an AATL cert from one of: SSL.com, GlobalSign, Entrust,
     DigiCert, IdenTrust. Typical cost $200-500/yr.
     (MSPs deploying for clients: each client needs their OWN cert —
      see references/signing-cert.md#msp-pattern.)
  2. Follow the procurement runbook in references/signing-cert.md.
  3. When the CA issues the cert PEM, one Secrets Manager update + ECS
     redeploy is all that's needed. No code or infra changes.

For operational runbooks and cert-rotation procedures:
  → .claude/skills/deploy-to-aws/references/signing-cert.md
══════════════════════════════════════════════════════════════════════════
```

Ask the user to delete `.deploy.env` or keep it for future updates. The signing cert passphrase + base64 cert are recoverable from Secrets Manager.

## Reference material

Load these only when needed:

- **`references/iam-policy.json`** — Minimum IAM policy. Show in step 3.
- **`references/sizing.md`** — Tier → CFN parameter mapping with cost estimates. Read during step 2d.
- **`references/sso-interview.md`** — Microsoft/Google/OIDC registration walkthrough. Read during step 2c.
- **`references/ses.md`** — AWS SES setup. Read during step 2e.
- **`references/signing-cert.md`** — AATL CA list, self-signed cert posture, how to rotate the cert. Read during step 2f or when user asks about signing trust.
- **`references/update-from-upstream.md`** — Workflow B. Read when user asks to sync/update.
- **`references/troubleshooting.md`** — Stack failures, task failures, DNS/HTTPS issues. Read on failure.

## Important constraints

- **Never write secrets to shell history, logs, or git.** `.deploy.env` is gitignored; don't echo secret values back. When summarizing, mask `*_CLIENT_SECRET`, `*_SECRET`, `*_PASSPHRASE`, `*_PASSWORD` as `***`.
- **Don't skip the confirmation in step 2h.** The stack starts billable resources.
- **Don't modify `cfn/documenso.yml` by hand.** If it needs changes, edit `infra/lib/documenso-stack-generic.ts` and regenerate via `cd infra && npx cdk synth -a "npx ts-node bin/cfn-synth.ts"`.
- **Document signing with a self-signed cert is not legally binding in all jurisdictions.** For B2B/B2C, upgrade to an AATL CA cert before going live.
- **Microsoft Graph `email_verified` workaround**: this fork sets `bypassEmailVerification: true` for Microsoft in `packages/auth/server/config.ts` because Microsoft doesn't include that claim by default. Don't revert it.
