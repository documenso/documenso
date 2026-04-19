# AWS SES Setup for Documenso SMTP

Most users should send email via AWS SES — it's cheap ($0.10 / 1,000
emails), runs in the same account, and integrates with Route 53 for
domain verification.

## Prerequisites

- **Domain ownership** — You must be able to add DNS records to the
  domain's Route 53 zone (or wherever the zone lives).
- **Region choice** — SES is a regional service. Pick a region close to
  your users. Common picks: `us-east-1`, `us-west-2`, `eu-west-1`.
  **The SMTP endpoint must match this region** — you'll use
  `email-smtp.<region>.amazonaws.com`.

## Step 1 — Verify the sender identity

Two options: a full **domain** (sends from any address `@domain`) or a
single **email address** (sends only from that one address).

### Domain identity (recommended)

```bash
aws sesv2 create-email-identity \
  --profile "$AWS_PROFILE" --region "$AWS_REGION" \
  --email-identity example.com \
  --dkim-signing-attributes NextSigningKeyLength=RSA_2048_BIT
```

Grab the DKIM tokens and add CNAME records to the domain:

```bash
aws sesv2 get-email-identity \
  --profile "$AWS_PROFILE" --region "$AWS_REGION" \
  --email-identity example.com \
  --query 'DkimAttributes.Tokens' --output text
```

If the domain is in the same account's Route 53, the console's
"Create identity" button can create the DNS records automatically.

Verification takes up to 72 hours but usually completes within minutes.
Check with:
```bash
aws sesv2 get-email-identity \
  --profile "$AWS_PROFILE" --region "$AWS_REGION" \
  --email-identity example.com \
  --query 'VerifiedForSendingStatus' --output text
```

### Single email identity

```bash
aws sesv2 create-email-identity \
  --profile "$AWS_PROFILE" --region "$AWS_REGION" \
  --email-identity sign@example.com
```

SES sends a verification email to the address. Click the link.

## Step 2 — Check sandbox status

New SES accounts are in **sandbox mode**: can only send to verified
recipients + 200 messages/day. Fine for testing; not fine for real users.

```bash
aws sesv2 get-account \
  --profile "$AWS_PROFILE" --region "$AWS_REGION" \
  --query '{Production:ProductionAccessEnabled,Quota:SendQuota.Max24HourSend,Rate:SendQuota.MaxSendRate}' \
  --output table
```

If `ProductionAccessEnabled` is `false`, request production access via
the [SES console → Account dashboard → Request production access](https://console.aws.amazon.com/ses/home#/account).
AWS usually approves within 24 hours.

## Step 3 — Create SMTP credentials

SES SMTP credentials are **not** your IAM user's access key — they're a
separate credential derived from an IAM user with `ses:SendRawEmail`
permission, signed via AWS's `smtp-password-v4` algorithm.

### Easiest path — SES Console

[SES Console → SMTP settings → Create SMTP credentials](https://console.aws.amazon.com/ses/home#/smtp)
creates an IAM user named `ses-smtp-user.<timestamp>` and gives you a
pair of credentials to download. **Download immediately** — the password
cannot be retrieved later.

- The Access key ID → `SMTP_USERNAME`
- The derived SMTP password → `SMTP_PASSWORD`

### CLI path

```bash
# 1. Create a dedicated IAM user
SES_USER="documenso-smtp"
aws iam create-user --user-name "$SES_USER" --profile "$AWS_PROFILE"

# 2. Attach an inline policy for SES send permissions
aws iam put-user-policy --user-name "$SES_USER" --profile "$AWS_PROFILE" \
  --policy-name ses-send \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Action": ["ses:SendRawEmail", "ses:SendEmail"],
      "Resource": "*"
    }]
  }'

# 3. Create an access key
aws iam create-access-key --user-name "$SES_USER" --profile "$AWS_PROFILE" \
  --query 'AccessKey.{UserName:UserName,Id:AccessKeyId,Secret:SecretAccessKey}' \
  --output table
```

The Access key ID is `SMTP_USERNAME`. Derive the SMTP password from the
secret access key via AWS's signature algorithm. Python one-liner:

```python
# aws-sigv4-smtp-password.py <region> <secret-access-key>
import hmac, hashlib, base64, sys

region, secret = sys.argv[1], sys.argv[2]
date = "11111111"
service, terminal, message, version = "ses", "aws4_request", "SendRawEmail", 0x04

sig = ("AWS4" + secret).encode()
for value in [date, region, service, terminal, message]:
    sig = hmac.new(sig, value.encode(), hashlib.sha256).digest()

print(base64.b64encode(bytes([version]) + sig).decode())
```

Run: `python3 aws-sigv4-smtp-password.py us-east-1 <SecretAccessKey>`.
Output is the SMTP_PASSWORD.

## Step 4 — Write to .deploy.env

```env
SMTP_HOST=email-smtp.us-east-1.amazonaws.com   # match your SES region
SMTP_PORT=587
SMTP_USERNAME=AKIAEXAMPLE                       # the Access Key ID
SMTP_PASSWORD=<derived SMTP password>
SMTP_FROM_ADDRESS=sign@example.com              # must be a verified identity
```

## Troubleshooting

- **"Email address is not verified"** — The From address isn't in
  `list-email-identities` as `SUCCESS` verified. Re-verify the identity
  or pick a different From address.
- **"Message rejected: MessageRejected"** — You're in sandbox and the
  recipient isn't verified. Request production access, or add the
  recipient to `CreateEmailIdentity` to test.
- **535 Authentication Credentials Invalid** — SMTP password was
  generated for the wrong region, or the IAM user lacks
  `ses:SendRawEmail`, or you pasted the secret access key instead of
  the derived SMTP password.
- **Timeout on port 587** — some VPCs block port 587 outbound. Try 465
  (TLS) or 2587 as an alternative SES SMTP port.
