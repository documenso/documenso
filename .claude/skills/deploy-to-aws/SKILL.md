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

Documenso signs PDFs with a PKCS#12 certificate. Ask:

> Do you have a CA-signed `.p12` cert from an Adobe AATL CA (GlobalSign, Entrust, DigiCert, IdenTrust, SSL.com)? (y/N)

**If N (default):** generate a self-signed cert on the user's machine. Install `openssl` first if missing (confirm before installing). Prompt for the user's org info, then:

```bash
source .deploy.env
TMPDIR=$(mktemp -d)
CERT_CN="${APP_NAME:-Documenso}"
CERT_O="<user's org>"
CERT_EMAIL="<admin email>"
# generate random passphrase
SIGNING_PASSPHRASE=$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)

openssl req -x509 -nodes -newkey rsa:2048 \
  -keyout "$TMPDIR/key.pem" -out "$TMPDIR/cert.pem" -days 1825 \
  -subj "/CN=$CERT_CN/O=$CERT_O/OU=Documenso/emailAddress=$CERT_EMAIL"

openssl pkcs12 -export \
  -out "$TMPDIR/cert.p12" \
  -inkey "$TMPDIR/key.pem" -in "$TMPDIR/cert.pem" \
  -passout "pass:$SIGNING_PASSPHRASE"

SIGNING_CERT_B64=$(base64 -w0 "$TMPDIR/cert.p12")
echo "SIGNING_CERT_SOURCE=self-signed" >> .deploy.env
# Don't echo the passphrase or base64 cert back to the user.
```

Print a banner:

```
Self-signed signing cert generated.
PDFs will verify as "signature valid, identity not trusted" in Adobe Reader.
For legally binding signatures in B2B/B2C flows, upgrade to an AATL CA cert later
(see references/signing-cert.md for CA list and replacement steps).
```

**If Y:** read the `.p12` at the provided path, validate with `openssl pkcs12 -info -in "$SIGNING_CERT_PATH" -passin "pass:$SIGNING_PASSPHRASE" -nokeys -nomacver 2>&1 | head -5` (won't print the key). Prompt for passphrase with `read -s`. Base64-encode: `SIGNING_CERT_B64=$(base64 -w0 "$SIGNING_CERT_PATH")`.

Keep `SIGNING_PASSPHRASE` and `SIGNING_CERT_B64` in memory for step 6 — do not write them to `.deploy.env` unless the user insists (they're recoverable from Secrets Manager once deployed).

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
# Capture: DbEndpoint, AppConfigSecretArn, DatabaseUrlSecretArn
DB_ENDPOINT=$(aws cloudformation describe-stacks --profile "$AWS_PROFILE" --region "$AWS_REGION" \
  --stack-name "$STACK_NAME" --query "Stacks[0].Outputs[?OutputKey=='DatabaseDbEndpoint'].OutputValue" --output text)
APP_CONFIG_ARN=$(aws cloudformation describe-stacks --profile "$AWS_PROFILE" --region "$AWS_REGION" \
  --stack-name "$STACK_NAME" --query "Stacks[0].Outputs[?OutputKey=='SecretsAppConfigSecretArn'].OutputValue" --output text)
DB_URL_ARN=$(aws cloudformation describe-stacks --profile "$AWS_PROFILE" --region "$AWS_REGION" \
  --stack-name "$STACK_NAME" --query "Stacks[0].Outputs[?OutputKey=='SecretsDatabaseUrlSecretArn'].OutputValue" --output text)
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
```

#### 6d. Update app-config secret

```bash
aws secretsmanager put-secret-value \
  --profile "$AWS_PROFILE" --region "$AWS_REGION" \
  --secret-id "$APP_CONFIG_ARN" \
  --secret-string "$(jq -n \
    --arg nextauth "$(openssl rand -base64 32 | tr -d '/+=' | head -c 32)" \
    --arg ek "$ENCRYPTION_KEY" --arg esk "$ENCRYPTION_SECONDARY_KEY" \
    --arg mcid "$MICROSOFT_CLIENT_ID" --arg msec "$MICROSOFT_CLIENT_SECRET" \
    --arg sh "$SMTP_HOST" --arg sp "$SMTP_PORT" \
    --arg su "$SMTP_USERNAME" --arg spw "$SMTP_PASSWORD" \
    --arg pp "$SIGNING_PASSPHRASE" --arg cert "$SIGNING_CERT_B64" \
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
      NEXT_PRIVATE_SIGNING_PASSPHRASE: $pp,
      NEXT_PRIVATE_SIGNING_LOCAL_FILE_CONTENTS: $cert
    }')"
```

#### 6e. Update database-url secret

```bash
DB_URL="postgresql://$DB_USER:$DB_PASS@$DB_ENDPOINT:5432/documenso"
aws secretsmanager put-secret-value \
  --profile "$AWS_PROFILE" --region "$AWS_REGION" \
  --secret-id "$DB_URL_ARN" \
  --secret-string "{\"NEXT_PRIVATE_DATABASE_URL\":\"$DB_URL\",\"NEXT_PRIVATE_DIRECT_DATABASE_URL\":\"$DB_URL\"}"
```

#### 6f. Force new deployment

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
