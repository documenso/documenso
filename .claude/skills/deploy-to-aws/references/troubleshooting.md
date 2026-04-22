# Troubleshooting

## CloudFormation stack failures

**`CREATE_FAILED` or `ROLLBACK_IN_PROGRESS` within first 5 minutes**

Usually an IAM permission issue or bad parameter. Check events:

```bash
aws cloudformation describe-stack-events --profile "$AWS_PROFILE" --region "$AWS_REGION" \
  --stack-name "$STACK_NAME" \
  --query 'StackEvents[?ResourceStatus==`CREATE_FAILED`].{Time:Timestamp,Resource:LogicalResourceId,Reason:ResourceStatusReason}' \
  --output table
```

Common causes:
- `AccessDenied` — IAM principal missing permissions. Re-run IAM simulate from step 2g, or attach `AdministratorAccess` temporarily.
- `Route 53 RRSet already exists` — a DNS record at `$DOMAIN` already exists. Pick a different `DOMAIN` or delete the conflicting record (confirm with user first — deleting breaks whatever was there).
- `CertificateValidationFailure` — ACM can't reach Route 53 to add the DNS validation record. Verify `HOSTED_ZONE_ID` is correct and the IAM principal has `route53:ChangeResourceRecordSets`.
- `DBInstanceClass` not supported in region/AZ — pick a different instance class or subnets in different AZs.

**Stack stuck in `ROLLBACK_COMPLETE` — can't update, must recreate**

```bash
aws cloudformation delete-stack --profile "$AWS_PROFILE" --region "$AWS_REGION" \
  --stack-name "$STACK_NAME"
aws cloudformation wait stack-delete-complete --profile "$AWS_PROFILE" --region "$AWS_REGION" \
  --stack-name "$STACK_NAME"
```

Note: if the S3 uploads bucket received uploads before the rollback, it won't delete cleanly (bucket must be empty). Empty the bucket manually, then retry delete.

**`CREATE_FAILED` mid-deploy with ECS circuit breaker**

The ECS service has `circuitBreaker: { enable: true, rollback: true }` and will roll back if tasks fail to reach healthy state within ~10 minutes. This is usually the Step 6 chicken-and-egg: secrets haven't been populated yet.

Temporarily set `DesiredCount=0` in the stack to avoid the circuit breaker, finish populating secrets, then update `DesiredCount=1`. Or accept the rollback, populate secrets, and redeploy.

## ECS task failures

Find the latest stopped task and the reason it stopped:

```bash
source .deploy.env
CLUSTER="documenso-$ENV_NAME"
SERVICE="documenso-$ENV_NAME"

aws ecs list-tasks --profile "$AWS_PROFILE" --region "$AWS_REGION" \
  --cluster "$CLUSTER" --desired-status STOPPED \
  --query 'taskArns[0]' --output text | \
  xargs -I{} aws ecs describe-tasks --profile "$AWS_PROFILE" --region "$AWS_REGION" \
    --cluster "$CLUSTER" --tasks {} \
    --query 'tasks[0].{StoppedReason:stoppedReason,ExitCode:containers[0].exitCode,Reason:containers[0].reason}'
```

**`ResourceInitializationError: unable to pull secrets` — `ResourceNotFoundException`**

ECS can't resolve partial ARNs. Make sure the full ARN (including 6-char random suffix) is in the GitHub variables `APP_CONFIG_SECRET_ARN` and `DATABASE_URL_SECRET_ARN`, or in the generic CFN template that the stack generates them fresh.

**`Essential container exited` with exit code 1 on first boot**

Almost always Prisma migrations failing to connect to the DB. Check app logs:

```bash
aws logs tail "/documenso/$ENV_NAME" --profile "$AWS_PROFILE" --region "$AWS_REGION" --since 10m --follow
```

Common causes:
- `NEXT_PRIVATE_DATABASE_URL` points to `postgresql://placeholder` — Step 6e not completed.
- DB security group doesn't allow ingress from app SG on port 5432 — should be created by the stack, but verify.
- `NEXT_PRIVATE_ENCRYPTION_KEY` or `NEXT_PRIVATE_ENCRYPTION_SECONDARY_KEY` is empty — Documenso throws at boot.

**Container boots but `/api/health` returns 5xx**

- `NEXTAUTH_SECRET` missing or too short (<32 chars)
- Migrations failed partway — check app logs for Prisma errors. Connect to the DB (via bastion or `publiclyAccessible=true` if enabled) and inspect `_prisma_migrations` table.

## DNS + HTTPS

**`https://$DOMAIN` doesn't resolve**

```bash
dig +short "$DOMAIN"
aws route53 list-resource-record-sets --profile "$AWS_PROFILE" \
  --hosted-zone-id "$HOSTED_ZONE_ID" \
  --query "ResourceRecordSets[?Name=='$DOMAIN.'].{Type:Type,Target:AliasTarget.DNSName}" \
  --output table
```

DNS propagation after initial CFN create is usually <5 minutes but can take up to 30. If nothing after an hour, confirm the A alias record points to the ALB's DNS name.

**`NET::ERR_CERT_AUTHORITY_INVALID` or `ERR_SSL_VERSION_OR_CIPHER_MISMATCH`**

ACM cert is still validating. Check:

```bash
aws acm list-certificates --profile "$AWS_PROFILE" --region "$AWS_REGION" \
  --query "CertificateSummaryList[?DomainName=='$DOMAIN'].{Arn:CertificateArn,Status:Status}" \
  --output table
```

`PENDING_VALIDATION` means the Route 53 CNAME record isn't live yet (can take 5–10 minutes). `FAILED` means the record didn't propagate — check DNS or re-issue.

## SSO (Microsoft)

**`INVALID_REQUEST: Invalid or missing state`**

The OIDC state cookie is SameSite=Lax and the user was bounced through a different domain mid-flow. Make sure the redirect URI in the Entra app registration is **exactly** `https://<DOMAIN>/api/auth/callback/microsoft` (no trailing slash, no `http`, correct domain).

**`UNVERIFIED_EMAIL`**

Microsoft doesn't include `email_verified` in ID tokens by default. This fork sets `bypassEmailVerification: true` for Microsoft in `packages/auth/server/config.ts`. If you see this error, either:
- The fix was reverted during an upstream merge — restore it.
- The user is signing in with a Google or OIDC provider that also doesn't emit the claim — set `NEXT_PRIVATE_OIDC_SKIP_VERIFY=true` in the secret for OIDC.

**"Need admin approval" from Entra**

The user's Entra tenant requires admin consent for the app. Either an admin grants consent, or the user's IT relaxes the consent policy.

## Signing cert

**`Error: ENOENT: no such file or directory, open '/opt/documenso/cert.p12'`**

`NEXT_PRIVATE_SIGNING_LOCAL_FILE_CONTENTS` is empty or invalid base64. Check the secret:

```bash
aws secretsmanager get-secret-value --secret-id "$APP_CONFIG_ARN" \
  --query SecretString --output text | jq -r .NEXT_PRIVATE_SIGNING_LOCAL_FILE_CONTENTS | head -c 80
```

Should start with `MII` (DER PKCS#12 magic bytes encoded as base64). If empty, run Step 2f + 6d again.

**`openssl:error:11800073:PKCS12 routines::decrypt error`**

Wrong passphrase. Compare `NEXT_PRIVATE_SIGNING_PASSPHRASE` secret value to what you used when generating the cert.

## Getting help

If stuck, capture:
- Stack status: `aws cloudformation describe-stacks --stack-name "$STACK_NAME" --query 'Stacks[0].StackStatus'`
- Latest 20 stack events (from command above)
- Latest app logs: `aws logs tail "/documenso/$ENV_NAME" --since 30m`
- The specific error message

Open an issue on the repo or paste to the skill for diagnosis.

---

## Azure Key Vault (azure-kv transport)

**`Azure.Identity.ClientSecretCredential failed`** in ECS task logs

The Azure SP creds in `documenso/<env>/app-config` are wrong or missing. Validate:

```bash
APP_CONFIG_ARN=$(aws cloudformation describe-stacks --profile "$AWS_PROFILE" --region "$AWS_REGION" \
  --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='SecretsAppConfigSecretArn'].OutputValue" --output text)

aws secretsmanager get-secret-value --profile "$AWS_PROFILE" --region "$AWS_REGION" \
  --secret-id "$APP_CONFIG_ARN" --query SecretString --output text | \
  jq 'keys[] | select(contains("AZURE_KV"))'
```

Expect `NEXT_PRIVATE_SIGNING_AZURE_KV_TENANT_ID/CLIENT_ID/CLIENT_SECRET` populated. If any are empty or missing, rerun step 6e of SKILL.md. If populated but still failing, the SP secret may have been rotated or expired — use `az ad sp credential reset --id <client-id>` to generate a new one.

**`KeyVaultErrorException: Forbidden` — status code 403 from Azure**

The SP doesn't have the `Key Vault Crypto User` role on the key. Verify:

```bash
az role assignment list \
  --assignee <client-id> \
  --scope "/subscriptions/<sub>/resourceGroups/<rg>/providers/Microsoft.KeyVault/vaults/<vault>/keys/<key>"
```

If empty, re-run `setup-azure-kv.py` or assign manually:

```bash
az role assignment create \
  --role "Key Vault Crypto User" \
  --assignee <client-id> \
  --scope "/subscriptions/<sub>/resourceGroups/<rg>/providers/Microsoft.KeyVault/vaults/<vault>/keys/<key>"
```

RBAC assignments take up to 5 minutes to propagate. If you just assigned the role, wait and retry.

**Signing throws `No certificate found for Azure Key Vault signing`**

SSL.com's issued cert hasn't been loaded yet. The secret field `NEXT_PRIVATE_SIGNING_AZURE_KV_PUBLIC_CRT_FILE_CONTENTS` is empty. Follow Step 7 in SKILL.md to install the cert from SSL.com's email.

**`CSR was rejected` by SSL.com**

Likely causes (in order of frequency):
- Key size <3072 bits. SSL.com's minimum. Recreate the key with `key_size: 3072` or 4096.
- `Exportable Private Key: Yes`. Must be No. Recreate the key.
- Key type is `RSA` instead of `RSA-HSM`. Standard RSA keys don't carry the HSM attestation SSL.com needs. Use RSA-HSM (requires Premium SKU).
- Subject DN missing required fields. SSL.com requires at minimum CN, O, C. Add OU + emailAddress for cleaner UX.

**Azure portal "Generate CSR" button missing**

The key was created outside the Certificates API. Azure KV's CSR flow only works on certificates, not raw keys. Work around: create a new cert in the portal with the same subject, let it generate its own key (RSA-HSM 3072, non-exportable), then download the CSR. The old raw key you created via `setup-azure-kv.py` is now unused — delete or leave it.

**ECS task restart-looping after switching `SigningTransport` from aws-kms to azure-kv**

The secret JSON is missing Azure KV fields. ECS can't resolve `ecs.Secret.fromSecretsManager(..., 'NEXT_PRIVATE_SIGNING_AZURE_KV_TENANT_ID')` against a secret that doesn't have that key. Update the secret before (or concurrently with) the stack update:

```bash
aws secretsmanager get-secret-value --profile "$AWS_PROFILE" --region "$AWS_REGION" \
  --secret-id "$APP_CONFIG_ARN" --query SecretString --output text | \
  jq '. + {
    NEXT_PRIVATE_SIGNING_AZURE_KV_TENANT_ID: (.NEXT_PRIVATE_SIGNING_AZURE_KV_TENANT_ID // ""),
    NEXT_PRIVATE_SIGNING_AZURE_KV_CLIENT_ID: (.NEXT_PRIVATE_SIGNING_AZURE_KV_CLIENT_ID // ""),
    NEXT_PRIVATE_SIGNING_AZURE_KV_CLIENT_SECRET: (.NEXT_PRIVATE_SIGNING_AZURE_KV_CLIENT_SECRET // ""),
    NEXT_PRIVATE_SIGNING_AZURE_KV_PUBLIC_CRT_FILE_CONTENTS: (.NEXT_PRIVATE_SIGNING_AZURE_KV_PUBLIC_CRT_FILE_CONTENTS // ""),
    NEXT_PRIVATE_SIGNING_AZURE_KV_CERT_CHAIN_CONTENTS: (.NEXT_PRIVATE_SIGNING_AZURE_KV_CERT_CHAIN_CONTENTS // "")
  }' | \
  aws secretsmanager put-secret-value --profile "$AWS_PROFILE" --region "$AWS_REGION" \
    --secret-id "$APP_CONFIG_ARN" --secret-string file:///dev/stdin
```
