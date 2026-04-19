# Workflow B — Update from Upstream

Use this workflow when the user wants to pull in new changes from `documenso/documenso` and redeploy their existing stack. Triggers: "update", "sync", "pull latest", "upgrade from upstream".

## Precondition

The user already has `.deploy.env` from Workflow A and an existing CloudFormation stack. Confirm with:

```bash
source .deploy.env
aws cloudformation describe-stacks --profile "$AWS_PROFILE" --region "$AWS_REGION" \
  --stack-name "$STACK_NAME" --query 'Stacks[0].{Status:StackStatus,Updated:LastUpdatedTime}' \
  --output table
```

If no stack exists, use Workflow A instead.

## Step 1 — Fetch upstream

```bash
# Add upstream remote if missing
git remote get-url upstream 2>/dev/null || \
  git remote add upstream https://github.com/documenso/documenso.git

git fetch upstream main
```

Show the user what's new:

```bash
git log --oneline HEAD..upstream/main | head -20
echo "---"
git log --oneline HEAD..upstream/main | wc -l
```

If the count is zero, they're up to date — stop.

## Step 2 — Merge with human checkpoint

Merging can conflict with fork customizations. Stop and let the user resolve:

```bash
git checkout main
git pull origin main
git merge upstream/main --no-ff --no-commit
```

### If conflicts

```bash
git status
```

List files and **pause** — the user must decide per file:
- Fork customizations (our infra/, deploy workflow, skill, signin UI changes if any): keep ours.
- Upstream bug fixes and features: take theirs unless they break something.
- Mixed files (e.g. `packages/auth/server/config.ts`): merge by hand. Remember this fork has two known fixes there: tenant-specific Microsoft OIDC URL + `bypassEmailVerification: true` for Microsoft. Preserve them.

After resolution:

```bash
git add <resolved files>
git commit -m "chore: merge upstream main"
git push origin main
```

### If clean merge

```bash
git commit -m "chore: merge upstream main"
git push origin main
```

## Step 3 — Rebuild and push image

```bash
source .deploy.env
ACCOUNT_ID=$(aws sts get-caller-identity --profile "$AWS_PROFILE" --query Account --output text)
REGISTRY="$ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"
TAG=$(git rev-parse --short HEAD)

aws ecr get-login-password --profile "$AWS_PROFILE" --region "$AWS_REGION" \
  | docker login --username AWS --password-stdin "$REGISTRY"

IMAGE_URI="$REGISTRY/documenso:$TAG"
docker buildx build \
  --platform linux/amd64 \
  --file docker/Dockerfile \
  --tag "$IMAGE_URI" \
  --tag "$REGISTRY/documenso:latest" \
  --push .

sed -i.bak "s|^CONTAINER_IMAGE=.*|CONTAINER_IMAGE=$IMAGE_URI|" .deploy.env
```

If the user is using GitHub Actions-based CI/CD (pushes to `main` trigger `deploy-aws.yml`), they can skip this step — the workflow rebuilds and rolls the service automatically. In that case, jump to Step 5 for verification.

## Step 4 — Update the stack

Same parameters as Workflow A's step 5, just with the new `CONTAINER_IMAGE`:

```bash
source .deploy.env

PARAMS=(
  "EnvName=$ENV_NAME"
  "VpcId=$VPC_ID" "SubnetIds=$SUBNET_IDS"
  "Domain=$DOMAIN" "HostedZoneId=$HOSTED_ZONE_ID"
  "ContainerImage=$CONTAINER_IMAGE"
  "AppName=$APP_NAME"
  "AllowedSignupDomains=$ALLOWED_SIGNUP_DOMAINS"
  "MicrosoftTenantId=$MICROSOFT_TENANT_ID"
  "SmtpFromAddress=$SMTP_FROM_ADDRESS"
  "DbInstanceClass=$DB_INSTANCE_CLASS" "DbStorageGb=$DB_STORAGE_GB"
  "FargateCpu=$FARGATE_CPU" "FargateMemory=$FARGATE_MEMORY"
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

Updates are usually 5–10 minutes. Only the ECS task definition and service roll over; RDS and networking stay put.

If the update makes only container-level changes (new image, same template), you can skip CloudFormation and do a fast path:

```bash
aws ecs update-service --profile "$AWS_PROFILE" --region "$AWS_REGION" \
  --cluster "documenso-$ENV_NAME" --service "documenso-$ENV_NAME" \
  --force-new-deployment --no-cli-pager
aws ecs wait services-stable --profile "$AWS_PROFILE" --region "$AWS_REGION" \
  --cluster "documenso-$ENV_NAME" --services "documenso-$ENV_NAME"
```

## Step 5 — Verify

```bash
curl -fsS "https://$DOMAIN/api/health"
aws ecs describe-services --profile "$AWS_PROFILE" --region "$AWS_REGION" \
  --cluster "documenso-$ENV_NAME" --services "documenso-$ENV_NAME" \
  --query 'services[0].{Running:runningCount,Desired:desiredCount,Deployments:deployments[].{Status:status,Tasks:runningCount}}'
```

Visit `https://$DOMAIN` and sign in to confirm the update didn't break anything. If migrations were part of the upstream release, check the app logs for Prisma output on first boot.

## Rollback

If the update broke something, roll back to the previous image:

```bash
# Find previous image digest from ECS task definition history
aws ecs describe-task-definition --profile "$AWS_PROFILE" --region "$AWS_REGION" \
  --task-definition "documenso-$ENV_NAME" \
  --query 'taskDefinition.{Rev:revision,Image:containerDefinitions[0].image}'

# Deploy with the previous image URI
CONTAINER_IMAGE="<previous image URI>" \
  aws cloudformation deploy ... # (same as step 4)
```

Or revert the git merge:

```bash
git revert -m 1 HEAD   # reverts the merge commit
git push origin main
```
