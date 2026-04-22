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

#### 2f. Signing transport selection

Documenso supports two signing backends. Ask the deployer this question verbatim:

> **Will this deployment send legally-binding contracts to external parties?**

If **yes** → use `azure-kv` (AATL-trusted signatures via Azure Key Vault Premium + SSL.com OV cert). Requires an Azure subscription, ~$850 first-year cost, 3-10 day cert issuance wait. This is the right default for MSP client deployments.

If **no** (pilot / UAT / internal-only) → use `aws-kms` (self-signed cert, Adobe shows "identity not trusted"). Fastest path to a running stack; upgrade to Azure KV later by switching `SigningTransport` + swapping the cert in Secrets Manager.

Why not "AWS KMS + buy an AATL cert later"? We tried. No AATL CA accepts AWS KMS — CABForum 2023 requires device-level HSM attestation, and AWS KMS doesn't expose one. Only path from AWS KMS to AATL is a per-deploy $2,000+ BYOA audit. See `references/signing-cert.md` for the full attestation matrix.

Write transport + subject fields to `.deploy.env`:

```bash
cat >> .deploy.env <<EOF
SIGNING_TRANSPORT=azure-kv                # or aws-kms
SIGNING_CERT_CN="$APP_NAME"               # e.g. "Gnarlysoft Sign"
SIGNING_CERT_O="<user's legal org name>"  # e.g. "Gnarlysoft Inc."
SIGNING_CERT_OU="Documenso"
SIGNING_CERT_EMAIL="<admin email>"
SIGNING_CERT_COUNTRY="US"                 # 2-letter ISO country code
EOF
```

**Azure-kv path (AATL-trusted):** also prompt for these values, written to `.deploy.env` after Azure provisioning in Step 5a:

```env
AZURE_SUBSCRIPTION_ID=                    # filled in 5a
AZURE_KV_URL=                             # filled in 5a (e.g. https://<vault>.vault.azure.net)
AZURE_KV_KEY_NAME=documenso-signing-$ENV_NAME
AZURE_KV_KEY_VERSION=                     # blank = latest
AZURE_KV_TENANT_ID=                       # filled in 5a
AZURE_KV_CLIENT_ID=                       # filled in 5a
AZURE_KV_CLIENT_SECRET=                   # filled in 5a
```

**aws-kms path:** print this loud banner so nobody misses the limitation:

```
══════════════════════════════════════════════════════════════════════════
⚠️  SELF-SIGNED CERTIFICATE — DO NOT USE FOR REAL CONTRACTS  ⚠️
══════════════════════════════════════════════════════════════════════════
PDFs signed with this cert verify as "signature VALID, identity NOT TRUSTED"
in Adobe Reader. Counterparties, courts, and auditors will NOT accept these
signatures as legally binding.

Fine for:   internal pilot, UI/UX walkthrough, dev/staging environments.
NOT for:    real signed contracts, external counterparties, production use.

To upgrade to AATL-trusted later:
  → re-run this skill with SIGNING_TRANSPORT=azure-kv
  → OR follow references/signing-cert.md "Azure Key Vault Premium" runbook
══════════════════════════════════════════════════════════════════════════
```

**Do NOT generate the cert here.** For aws-kms, the cert is generated in Step 6 against the KMS key the CFN stack creates. For azure-kv, the cert is issued by SSL.com in Step 7 after the CSR generated in Step 5a.

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

### Step 4a — Azure KV provisioning (azure-kv only; skip for aws-kms)

If `SIGNING_TRANSPORT=azure-kv`, stand up Azure Key Vault Premium + the HSM-backed signing key + a service principal for ECS to authenticate with, BEFORE deploying the CFN stack. The stack's CfnParameters need the vault URL + key name.

Use the `/gnarlysoft-microsoft:azure` skill to drive the ARM API (it handles the multi-tenant auth dance automatically). The helper script `.claude/skills/deploy-to-aws/scripts/setup-azure-kv.py` does this end-to-end:

```bash
source .deploy.env

# One-time venv bootstrap if not done
VENV="$HOME/.documenso-deploy-venv"
if [ ! -d "$VENV" ]; then
  uv venv "$VENV" --quiet || python3 -m venv "$VENV"
  "$VENV/bin/pip" install --quiet requests
fi

"$VENV/bin/python" .claude/skills/deploy-to-aws/scripts/setup-azure-kv.py \
  --profile "<azure-skill-profile>" \
  --subscription "$AZURE_SUBSCRIPTION_ID" \
  --resource-group "documenso-signing-$ENV_NAME" \
  --location "eastus" \
  --vault-name "<globally-unique-vault-name>" \
  --key-name "documenso-signing-$ENV_NAME" \
  --env-out .deploy.env
```

The helper provisions (idempotent):
- Resource group `documenso-signing-$ENV_NAME` in the chosen region
- Key Vault Premium with RBAC + purge protection enabled
- RSA-HSM 3072-bit non-exportable key (sign + verify only)
- Service principal `documenso-signing-ecs-$ENV_NAME` with `Key Vault Crypto User` scoped to the one key
- Appends `AZURE_KV_URL`, `AZURE_KV_TENANT_ID`, `AZURE_KV_CLIENT_ID`, `AZURE_KV_CLIENT_SECRET` to `.deploy.env`

After provisioning, **prompt the deployer to visit the Azure portal once** to generate the attested CSR (Azure's CLI doesn't expose this yet — portal is the only way as of April 2026):

```
══════════════════════════════════════════════════════════════════════════
 ACTION REQUIRED — GENERATE ATTESTED CSR IN AZURE PORTAL
══════════════════════════════════════════════════════════════════════════
1. Open https://portal.azure.com → Key Vaults → <your vault> → Certificates
2. Click "Generate/Import" → "Generate"
3. Certificate Name: documenso-signing-$ENV_NAME
4. Subject: CN=$SIGNING_CERT_CN, O=$SIGNING_CERT_O, OU=$SIGNING_CERT_OU,
            emailAddress=$SIGNING_CERT_EMAIL, C=$SIGNING_CERT_COUNTRY
5. Advanced Policy Configuration:
   - Content Type: PEM
   - Key Type: RSA-HSM
   - Key Size: 3072
   - Exportable Private Key: No
   - Issuer: Self (CSR merge happens later)
6. Create. Then click the pending cert → "Certificate Operation" → Download CSR
7. Save as .deploy-artifacts/csr.pem
══════════════════════════════════════════════════════════════════════════
```

Pause until the CSR file exists locally, then continue with Step 5. The CSR is what we'll submit to SSL.com in Step 7.

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
  "SigningTransport=${SIGNING_TRANSPORT:-aws-kms}"
  "AzureKvUrl=${AZURE_KV_URL:-}"
  "AzureKvKeyName=${AZURE_KV_KEY_NAME:-}"
  "AzureKvKeyVersion=${AZURE_KV_KEY_VERSION:-}"
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

#### 6d. Obtain the signing cert (branches by transport)

**aws-kms path (self-signed):** generate a self-signed X.509 cert whose subject-public-key IS the KMS key's public half, signed BY the KMS key.

```bash
VENV="$HOME/.documenso-deploy-venv"
if [ ! -d "$VENV" ]; then
  uv venv "$VENV" --quiet || python3 -m venv "$VENV"
  "$VENV/bin/pip" install --quiet asn1crypto cryptography boto3
fi

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
openssl x509 -in "$CERT_PEM" -noout -subject -issuer -dates
```

**azure-kv path (SSL.com-issued AATL cert):** at this stage the cert doesn't exist yet — SSL.com issues it 3-10 business days after Step 7. Populate the secret with empty cert placeholders now; the skill returns to populate real values in Step 7.

```bash
SIGNING_CERT_B64=""      # filled in Step 7 after SSL.com issues the cert
SIGNING_CHAIN_B64=""     # filled in Step 7
```

The ECS task will start up and health-check green without the cert — PDF signing attempts will throw a clear error until the cert is loaded, but the rest of the app (SSO, doc upload, field placement, invitations) works immediately. Users can prep documents and recipients while waiting for the CA.

#### 6e. Update app-config secret

The secret shape depends on which transport is active. Build the JSON with transport-specific fields only populated for the active transport:

```bash
if [ "${SIGNING_TRANSPORT:-aws-kms}" = "azure-kv" ]; then
  SIGNING_JSON=$(jq -n \
    --arg tenant "$AZURE_KV_TENANT_ID" \
    --arg cid "$AZURE_KV_CLIENT_ID" \
    --arg csec "$AZURE_KV_CLIENT_SECRET" \
    --arg cert "${SIGNING_CERT_B64:-}" \
    --arg chain "${SIGNING_CHAIN_B64:-}" '
      {
        NEXT_PRIVATE_SIGNING_AZURE_KV_TENANT_ID: $tenant,
        NEXT_PRIVATE_SIGNING_AZURE_KV_CLIENT_ID: $cid,
        NEXT_PRIVATE_SIGNING_AZURE_KV_CLIENT_SECRET: $csec,
        NEXT_PRIVATE_SIGNING_AZURE_KV_PUBLIC_CRT_FILE_CONTENTS: $cert,
        NEXT_PRIVATE_SIGNING_AZURE_KV_CERT_CHAIN_CONTENTS: $chain
      }')
else
  SIGNING_JSON=$(jq -n --arg cert "$SIGNING_CERT_B64" \
    '{ NEXT_PRIVATE_SIGNING_AWS_KMS_PUBLIC_CRT_FILE_CONTENTS: $cert }')
fi

aws secretsmanager put-secret-value \
  --profile "$AWS_PROFILE" --region "$AWS_REGION" \
  --secret-id "$APP_CONFIG_ARN" \
  --secret-string "$(jq -n \
    --arg nextauth "$NEXTAUTH_SECRET" \
    --arg ek "$ENCRYPTION_KEY" --arg esk "$ENCRYPTION_SECONDARY_KEY" \
    --arg mcid "$MICROSOFT_CLIENT_ID" --arg msec "$MICROSOFT_CLIENT_SECRET" \
    --arg sh "$SMTP_HOST" --arg sp "$SMTP_PORT" \
    --arg su "$SMTP_USERNAME" --arg spw "$SMTP_PASSWORD" \
    --argjson signing "$SIGNING_JSON" '
      {
        NEXTAUTH_SECRET: $nextauth,
        NEXT_PRIVATE_ENCRYPTION_KEY: $ek,
        NEXT_PRIVATE_ENCRYPTION_SECONDARY_KEY: $esk,
        NEXT_PRIVATE_MICROSOFT_CLIENT_ID: $mcid,
        NEXT_PRIVATE_MICROSOFT_CLIENT_SECRET: $msec,
        NEXT_PRIVATE_SMTP_HOST: $sh,
        NEXT_PRIVATE_SMTP_PORT: $sp,
        NEXT_PRIVATE_SMTP_USERNAME: $su,
        NEXT_PRIVATE_SMTP_PASSWORD: $spw
      } + $signing')"
```

Note: `NEXT_PRIVATE_SIGNING_AWS_KMS_KEY_ID/REGION` and `NEXT_PRIVATE_SIGNING_AZURE_KV_URL/KEY_NAME/KEY_VERSION` are plain env vars set by CFN, not secrets — no action needed here.

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

### Step 7 — Verify + (azure-kv only) SSL.com cert procurement

```bash
curl -fsS "https://$DOMAIN/api/health"
```

Should return 200. If not, check ECS task logs in CloudWatch (`/documenso/$ENV_NAME`).

Visit `https://$DOMAIN` in a browser:
- Microsoft sign-in button appears
- Sign in with a user whose email matches `ALLOWED_SIGNUP_DOMAINS` (or any domain if blank)
- Upload a PDF, add a signer, place fields

**aws-kms path:** complete the signing flow end-to-end. Sign a test doc. Open in Adobe Reader — shows "signature valid, identity not trusted". Done.

**azure-kv path:** signing attempts return a clear error until the SSL.com cert is installed. Submit the CSR now:

1. Go to [SSL.com Document Signing](https://www.ssl.com/certificates/document-signing/).
2. Choose **Organization Validation (OV)**. Pick 1-year or 3-year.
3. Under HSM options select **Azure Key Vault**. This triggers the $500 attestation fee.
4. Upload `.deploy-artifacts/csr.pem` (generated in Step 4a).
5. Upload identity documents (Articles of Incorporation, officer's government ID).
6. Wait 3-10 business days. SSL.com will:
   - Call the listed business number (automated, ~5 min) to confirm the officer
   - May request a DUNS lookup or DNS TXT record
   - Issue the cert + chain via email

When the cert arrives:

```bash
# Save files locally
# signing-cert.pem = the issued cert
# signing-chain.pem = SSL.com intermediate + root

# Merge back into Azure KV (completes the cert lifecycle there)
az keyvault certificate pending merge --vault-name "$AZURE_KV_VAULT_NAME" \
  --name "$AZURE_KV_KEY_NAME" \
  --file <(cat signing-cert.pem signing-chain.pem)

# Encode for Secrets Manager
SIGNING_CERT_B64=$(base64 -w0 signing-cert.pem)
SIGNING_CHAIN_B64=$(base64 -w0 signing-chain.pem)

# Update app-config with real cert values
aws secretsmanager get-secret-value --profile "$AWS_PROFILE" --region "$AWS_REGION" \
  --secret-id "$APP_CONFIG_ARN" --query SecretString --output text | \
  jq \
    --arg cert "$SIGNING_CERT_B64" \
    --arg chain "$SIGNING_CHAIN_B64" '
      .NEXT_PRIVATE_SIGNING_AZURE_KV_PUBLIC_CRT_FILE_CONTENTS = $cert
      | .NEXT_PRIVATE_SIGNING_AZURE_KV_CERT_CHAIN_CONTENTS = $chain
    ' | \
  aws secretsmanager put-secret-value --profile "$AWS_PROFILE" --region "$AWS_REGION" \
    --secret-id "$APP_CONFIG_ARN" --secret-string file:///dev/stdin

# Roll new ECS tasks to pick up the cert
aws ecs update-service --profile "$AWS_PROFILE" --region "$AWS_REGION" \
  --cluster "documenso-$ENV_NAME" --service "documenso-$ENV_NAME" \
  --force-new-deployment --no-cli-pager
aws ecs wait services-stable --profile "$AWS_PROFILE" --region "$AWS_REGION" \
  --cluster "documenso-$ENV_NAME" --services "documenso-$ENV_NAME"
```

Sign a test PDF. Adobe Reader should now show a green check with "Signed by $SIGNING_CERT_O".

Inspect the installed cert any time with:

```bash
aws secretsmanager get-secret-value --profile "$AWS_PROFILE" --region "$AWS_REGION" \
  --secret-id "$APP_CONFIG_ARN" --query SecretString --output text | \
  jq -r '.NEXT_PRIVATE_SIGNING_AZURE_KV_PUBLIC_CRT_FILE_CONTENTS // .NEXT_PRIVATE_SIGNING_AWS_KMS_PUBLIC_CRT_FILE_CONTENTS' | \
  base64 -d | openssl x509 -noout -subject -issuer -dates -fingerprint -sha256
```

### Final deploy summary — print this verbatim

Print the summary that matches the active transport.

**aws-kms path:**

```
══════════════════════════════════════════════════════════════════════════
✅  DEPLOY COMPLETE (aws-kms, self-signed)  →  <https://DOMAIN>
══════════════════════════════════════════════════════════════════════════
What works right now:
  • SSO login
  • PDF upload, field placement, signing UI, email invitations
  • Cryptographically valid signatures (no forgery possible)

What does NOT work:
  • Signatures are NOT AATL-trusted. Adobe Reader shows:
      "Signature valid. Signer's identity is UNKNOWN / not trusted."
  • Courts, counterparties, and auditors will NOT accept these as
    legally binding. DO NOT send real contracts.

Upgrading to AATL-trusted when you need it:
  • Re-run this skill with SIGNING_TRANSPORT=azure-kv, OR
  • Follow references/signing-cert.md "Azure Key Vault Premium" runbook
  • Typical cost: ~$850 year 1, ~$350/yr after
  • Typical time: 3-10 business days for OV validation
══════════════════════════════════════════════════════════════════════════
```

**azure-kv path (cert installed):**

```
══════════════════════════════════════════════════════════════════════════
✅  DEPLOY COMPLETE (azure-kv, AATL-trusted)  →  <https://DOMAIN>
══════════════════════════════════════════════════════════════════════════
What works right now:
  • Full AATL-trusted document signing
  • Adobe Reader shows green check: "Signed by <YourOrg>"
  • Legally binding where AATL trust is recognized

Operational notes:
  • Cert expires: <expiry date>  →  renew 60 days before
  • Azure SP secret expires: <expiry date>  →  rotate yearly
  • Renewals are cheap (~$180-300/yr) — no new attestation fee

For rotation runbooks: references/signing-cert.md
══════════════════════════════════════════════════════════════════════════
```

**azure-kv path (awaiting SSL.com cert):**

```
══════════════════════════════════════════════════════════════════════════
⏳  DEPLOY COMPLETE, AWAITING CERT  →  <https://DOMAIN>
══════════════════════════════════════════════════════════════════════════
Stack is deployed. SSL.com will issue the AATL cert in 3-10 business days.

Signing will throw an error until the cert lands. The rest of the app
(SSO, doc upload, field placement, invites) works now — users can prep
documents while waiting.

When the cert arrives:
  • Save signing-cert.pem + signing-chain.pem locally
  • Re-run this skill (or follow Step 7 in SKILL.md)
  • No code/infra changes needed — just a Secrets Manager update
══════════════════════════════════════════════════════════════════════════
```

Ask the user to delete `.deploy.env` or keep it for future updates. The signing cert passphrase + base64 cert are recoverable from Secrets Manager.

## Reference material

Load these only when needed:

- **`references/iam-policy.json`** — Minimum IAM policy. Show in step 3.
- **`references/sizing.md`** — Tier → CFN parameter mapping with cost estimates. Read during step 2d.
- **`references/sso-interview.md`** — Microsoft/Google/OIDC registration walkthrough. Read during step 2c.
- **`references/ses.md`** — AWS SES setup. Read during step 2e.
- **`references/signing-cert.md`** — AATL attestation matrix, SSL.com OV Document Signing runbook, Azure KV Premium provisioning, cert rotation. Read during step 2f or when user asks about signing trust.
- **`scripts/setup-azure-kv.py`** — Helper that provisions Azure KV Premium + RSA-HSM key + service principal via ARM API. Used in step 4a for azure-kv transport.
- **`scripts/make-kms-cert.py`** — Helper that generates a self-signed cert against an AWS KMS key. Used in step 6d for aws-kms transport.
- **`references/update-from-upstream.md`** — Workflow B. Read when user asks to sync/update.
- **`references/troubleshooting.md`** — Stack failures, task failures, DNS/HTTPS issues. Read on failure.

## Important constraints

- **Never write secrets to shell history, logs, or git.** `.deploy.env` is gitignored; don't echo secret values back. When summarizing, mask `*_CLIENT_SECRET`, `*_SECRET`, `*_PASSPHRASE`, `*_PASSWORD` as `***`.
- **Don't skip the confirmation in step 2h.** The stack starts billable resources.
- **Don't modify `cfn/documenso.yml` by hand.** If it needs changes, edit `infra/lib/documenso-stack-generic.ts` and regenerate via `cd infra && npx cdk synth -a "npx ts-node bin/cfn-synth.ts"`.
- **Document signing with a self-signed cert is not legally binding in all jurisdictions.** For B2B/B2C, upgrade to an AATL CA cert before going live.
- **Microsoft Graph `email_verified` workaround**: this fork sets `bypassEmailVerification: true` for Microsoft in `packages/auth/server/config.ts` because Microsoft doesn't include that claim by default. Don't revert it.
