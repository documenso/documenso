# Document Signing Certificate

> ## ⚠️ READ THIS FIRST
>
> **A self-signed cert is NOT suitable for real contracts.** PDFs signed with a self-signed cert show in Adobe Reader as *"Signature valid. Signer's identity is UNKNOWN."* Counterparties, courts, and auditors treat "identity unknown" as **not legally binding**.
>
> **Before sending real contracts, you MUST upgrade to an AATL cert.** The upgrade is a single Secrets Manager update — no code, no infra, no redeploy of the stack. This document walks you through it.

---

## How signing works here

Documenso signs PDFs using an X.509 certificate whose private key lives in AWS KMS (or a local `.p12` file — see the "transport" you picked during deploy).

- **The private key stays in KMS.** No local file, no export. Operations are `kms:Sign` calls.
- **The certificate** declares "whose public key this is" (the subject) and "who vouches for that claim" (the issuer / CA).
- **Self-signed** means you are both the subject AND the issuer — no external party vouches for you. Adobe has no basis to trust the identity.
- **AATL-trusted** means a CA from [Adobe's Approved Trust List](https://helpx.adobe.com/acrobat/kb/approved-trust-list2.html) verified your identity (phone calls, IDs, business docs) and issued the cert. Adobe trusts their root, so your signature chains up to "trusted".

Critically: **you can keep using the same KMS key forever.** Upgrading from self-signed → AATL-trusted is just swapping the cert PEM. The signature bytes are still produced by the same KMS key.

---

## When the self-signed default is OK

Use cases where "valid but untrusted identity" is acceptable:

- Internal HR forms, consent flows, or approvals within a single org
- Demos and UAT environments
- Pilots where counterparties are the same org as the signer
- Workflows where the PDF is one artifact among many (and the trusted record lives elsewhere — e.g. in a CLM with its own notarization)

**Not** OK (upgrade before using):

- External contracts (clients, vendors, employees outside the org)
- Anything a counterparty's legal team will review
- Anything subject to compliance regimes (SOC 2, HIPAA, FINRA, etc.)
- Anything that might end up in discovery during a dispute

---

## AATL CA options

| CA            | Typical cost          | Notes                                                                    |
| ------------- | --------------------- | ------------------------------------------------------------------------ |
| **SSL.com**   | ~$200 IV / ~$300 OV   | Fastest onboarding. Good HSM attestation flow for AWS KMS. Recommended starter. |
| **GlobalSign**| ~$250 IV / ~$400 OV   | Widely recognized. HSM attestation supported. Slightly slower issuance.   |
| **DigiCert**  | ~$280 IV / ~$400 OV   | Premium; enterprise workflows. Rigorous identity verification.            |
| **Entrust**   | ~$350–600 OV          | Enterprise-focused. Longest lead time.                                    |
| **IdenTrust** | ~$80–150 IV           | Cheapest AATL. Issuance can take 1–2 weeks. Limited to certain regions.   |

### IV vs OV

- **Individual Validation (IV)** — subject is a named person. ("CN=Jacob Kapostins, O=Gnarlysoft")
- **Organization Validation (OV)** — subject is the org. ("O=Gnarlysoft, CN=Gnarlysoft Document Signing")
- **IV + OV** — both present in the cert.

For server-side signing where the Documenso server signs on behalf of the company (rather than a specific human attesting), **OV is the right choice.** Signatures appear as "Signed by [YourOrg]" which is what recipients expect.

---

## Procurement runbook (self-host path)

Budget: ~2–5 business days, ~$200–500 first year.

### What to gather before contacting the CA

1. **Legal entity name** — exactly as registered (Articles of Incorporation / Certificate of Good Standing).
2. **Business registration details** — state/country of incorporation, registration number.
3. **D-U-N-S number** — most AATL CAs use D&B as a third-party business verifier. Free from [D&B iUpdate](https://iupdate.dnb.com/) if you don't have one; takes a day or two.
4. **Signing officer** — a corporate officer who will be the verification contact (often CEO or CTO). Government-issued photo ID will be needed.
5. **Verifiable phone number** — must appear in a public directory (Google Business listing, D-U-N-S, legal filing). CAs call this number to confirm identity.
6. **Contact email** on the org's verified domain (e.g. `ceo@yourcompany.com`, not a Gmail).

### Step 1: Pick the CA and order the cert

SSL.com example (similar flows at other CAs):

1. Go to the CA's "Document Signing Certificate" product page.
2. Choose **Organization Validation (OV)**.
3. Under "Where will the private key live?", choose **"Bring my own HSM"** / **"HSM attestation"** (NOT "YubiKey" or "Cloud signing" — we want to use AWS KMS).
4. Pay.

### Step 2: Generate a CSR from the AWS KMS key

Your Documenso deploy already created the KMS key. Get its ARN:

```bash
# If you still have .deploy.env from the deploy:
source .deploy.env
KEY_ARN=$(aws kms describe-key --profile "$AWS_PROFILE" --region "$AWS_REGION" \
  --key-id "alias/documenso-signing-$ENV_NAME" --query 'KeyMetadata.Arn' --output text)
```

Then generate a CSR that the KMS key signs:

```bash
# Use the helper script stashed during deploy (if the skill provisioned it):
#   ~/.documenso-deploy-tmp/make_csr.py
# It calls aws kms sign with the correct algorithm, assembles a PKCS#10 CSR
# with the subject fields you provide (CN, O, OU, L, ST, C, emailAddress),
# and writes csr.pem. Submit csr.pem to the CA.
```

*(If the skill didn't create a helper during deploy, see the companion file `scripts/make-kms-csr.py` in the skill directory, or ask Claude to generate one — it's ~60 lines of Python using `asn1crypto` + `boto3`.)*

### Step 3: Submit CSR + identity docs

The CA's portal will ask for:
- The CSR you just generated (`csr.pem`)
- Upload the articles of incorporation or certificate of good standing
- Contact info for the signing officer (name, title, email, phone)
- A scan of the officer's government-issued photo ID (passport or driver's license)
- The D-U-N-S number if requested

### Step 4: Respond to the CA's verification calls

- CA calls the verified phone number to confirm the officer is real and authorized.
- CA may ask you to host a DNS TXT record or file on the domain to prove control.
- Respond promptly — most of the 2–5 business-day timeline is waiting for you, not them.

### Step 5: CA issues the cert

You'll receive an email with:
- Your certificate (`.crt` or `.pem`) signed by the CA's intermediate
- The intermediate and root CA certs to build the chain

Save them as `signing-cert.pem` and `signing-chain.pem`.

### Step 6: Swap the cert in Secrets Manager

**This is the only ops step. No CFN changes, no code changes, no downtime beyond an ECS task rollover.**

```bash
source .deploy.env

# Base64-encode the cert (use the cert your CA issued, not the self-signed one)
NEW_CERT_B64=$(base64 -w0 /path/to/signing-cert.pem)

# Optional: if you have a chain file with intermediates
NEW_CHAIN_B64=$(base64 -w0 /path/to/signing-chain.pem)

# Read current app-config, update only the signing-cert fields, put it back
APP_CONFIG_ARN=$(aws cloudformation describe-stacks --profile "$AWS_PROFILE" --region "$AWS_REGION" \
  --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='SecretsAppConfigSecretArn'].OutputValue" --output text)

aws secretsmanager get-secret-value --profile "$AWS_PROFILE" --region "$AWS_REGION" \
  --secret-id "$APP_CONFIG_ARN" --query SecretString --output text | \
  jq --arg cert "$NEW_CERT_B64" --arg chain "${NEW_CHAIN_B64:-}" '
    .NEXT_PRIVATE_SIGNING_AWS_KMS_PUBLIC_CRT_FILE_CONTENTS = $cert
    | (if $chain != "" then .NEXT_PRIVATE_SIGNING_AWS_KMS_CERT_CHAIN_CONTENTS = $chain else . end)
  ' | \
  aws secretsmanager put-secret-value --profile "$AWS_PROFILE" --region "$AWS_REGION" \
    --secret-id "$APP_CONFIG_ARN" \
    --secret-string file:///dev/stdin

# Roll new tasks so the container picks up the updated secret
aws ecs update-service --profile "$AWS_PROFILE" --region "$AWS_REGION" \
  --cluster "documenso-$ENV_NAME" --service "documenso-$ENV_NAME" \
  --force-new-deployment --no-cli-pager

aws ecs wait services-stable --profile "$AWS_PROFILE" --region "$AWS_REGION" \
  --cluster "documenso-$ENV_NAME" --services "documenso-$ENV_NAME"
```

**(For local-transport deployments)** swap `_AWS_KMS_PUBLIC_CRT_FILE_CONTENTS` for `_LOCAL_FILE_CONTENTS` and include `NEXT_PRIVATE_SIGNING_PASSPHRASE` in the jq update. Same flow otherwise.

### Step 7: Verify in Adobe Reader

Sign a test document. Open the signed PDF in Adobe Reader:

- ✅ **Before AATL**: "Signature valid. Signer's identity is UNKNOWN."
- ✅ **After AATL**: Green checkmark. "Signed by [YourOrg]. The signer's identity is valid."

If it still shows untrusted after the swap, first check that the ECS task redeployed and is actually using the new cert (see "Inspecting the currently deployed cert" below). Adobe may also cache validation results — right-click the signature, "Validate Signature" to re-check.

---

## MSP Pattern

You cannot use one cert for multiple clients' Documenso instances. The cert's subject IS the signer identity — one cert per legal entity that's actually signing contracts.

**For each client deployment:**

1. Deploy Documenso into the client's AWS account (using this skill).
2. The skill creates a KMS signing key in their account.
3. **Each client procures their own AATL cert** (they pay the CA, they own the cert, they're the legal signer).
4. You (the MSP) can facilitate: generate the CSR from their KMS key, walk them through the CA's portal, be the technical point of contact. But the CA must verify the client's identity, not yours.
5. Drop the cert PEM in their Secrets Manager, force new deployment, verify.

Billing-wise: most MSPs pass-through the cert cost to the client as a line item, or bundle it into the onboarding fee. Don't absorb it — cert ownership is legal, not technical.

**What about a sub-CA approach** (Gnarlysoft issues certs under its own AATL-approved root)? Technically possible — you'd become an AATL-approved **subordinate CA** — but requires WebTrust / ETSI annual audits ($50–100k+), full CA operational infrastructure, and compliance overhead. Not practical for MSPs; realistic path is only for dedicated PKI companies.

---

## Replacing the cert post-deploy (same-cert-type rotation)

Use this when:
- The current cert is about to expire (most AATL certs are 1 year validity)
- You're moving from self-signed to AATL
- You're moving between AATL CAs

The steps are identical to Step 6 above. If the subject DN changes (e.g. legal entity rename), existing signed documents keep the OLD cert (correctly — they were signed at a point in time). Only NEW signatures use the new cert.

---

## Inspecting the currently deployed cert

**AWS KMS transport:**

```bash
source .deploy.env
APP_CONFIG_ARN=$(aws cloudformation describe-stacks --profile "$AWS_PROFILE" --region "$AWS_REGION" \
  --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='SecretsAppConfigSecretArn'].OutputValue" --output text)

aws secretsmanager get-secret-value --profile "$AWS_PROFILE" --region "$AWS_REGION" \
  --secret-id "$APP_CONFIG_ARN" --query SecretString --output text | \
  jq -r .NEXT_PRIVATE_SIGNING_AWS_KMS_PUBLIC_CRT_FILE_CONTENTS | \
  base64 -d | \
  openssl x509 -noout -subject -issuer -dates -fingerprint -sha256
```

**Local transport (.p12):**

```bash
aws secretsmanager get-secret-value --profile "$AWS_PROFILE" --region "$AWS_REGION" \
  --secret-id "$APP_CONFIG_ARN" --query SecretString --output text | \
  jq -r '. | "\(.NEXT_PRIVATE_SIGNING_LOCAL_FILE_CONTENTS) \(.NEXT_PRIVATE_SIGNING_PASSPHRASE)"' | \
  while read -r CERT_B64 PP; do
    echo "$CERT_B64" | base64 -d | openssl pkcs12 -info -nokeys -nomacver \
      -passin "pass:$PP" 2>/dev/null | grep -E "subject|issuer|Not"
  done
```

Check issuer — if it matches the CA you procured from (e.g. `CN=SSL.com Document Signing Intermediate CA ECC R2`), the AATL upgrade landed. If it matches your own subject, the self-signed cert is still active.

---

## Common mistakes to avoid

1. **Sending real contracts on the self-signed cert** "just for now." The "just for now" contracts become part of your production record. Counterparties may not notice initially but legal review later will flag them.
2. **Procuring a cert for the wrong AWS KMS key.** If you regenerate the key (accident or rotation), the CSR needs to come from the NEW key. An AATL cert issued against an old key is useless — no refunds from the CA.
3. **Losing the passphrase** (for `.p12` / local transport). There's no recovery. Generate a new cert.
4. **Expired cert.** AATL certs are typically 1-year. Set a calendar reminder 60 days before expiry. Renewal is the same flow as Step 6 above.
5. **MSPs issuing one cert for all clients.** See the MSP Pattern section above — you can't and shouldn't. The legal signer on every contract would be you, not the client.
