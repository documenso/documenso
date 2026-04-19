# Document Signing Certificate

Documenso signs PDFs with a PKCS#12 (`.p12`) certificate. The cert is base64-encoded into the `NEXT_PRIVATE_SIGNING_LOCAL_FILE_CONTENTS` key of the `documenso/<env>/app-config` secret, along with its passphrase at `NEXT_PRIVATE_SIGNING_PASSPHRASE`.

## Self-signed (default)

The skill auto-generates a 5-year self-signed RSA 2048 cert at first deploy. Subject uses the app name and admin email you provided in the interview.

**Trust behavior in PDF viewers:**

- Adobe Reader / Acrobat: "Signature validity is UNKNOWN. The signer's identity is unknown because it has not been included in your list of trusted certificates." Signature is valid, but identity isn't trusted.
- Foxit / other viewers: similar warnings.
- Workaround: recipients can manually add your cert to their trusted roots. Fine for internal flows, awkward for external counterparties.

Self-signed is legitimate for internal document signing (HR onboarding, internal approvals) but not for signatures that need to stand up in court or with external partners.

## Upgrading to an AATL CA cert

For legally recognized signatures, get a cert from a CA in [Adobe's Approved Trust List (AATL)](https://helpx.adobe.com/acrobat/kb/approved-trust-list2.html):

| CA | Notes |
|---|---|
| **GlobalSign** | ~$250/yr, popular. Offers cloud HSM + USB token options. |
| **Entrust** | ~$350–500/yr. Enterprise-focused. |
| **DigiCert** | ~$280–400/yr. Broad recognition. |
| **IdenTrust** | ~$80–150/yr. Cheapest AATL. Slower issuance. |
| **SSL.com** | ~$200–300/yr. Modern cloud-based workflows. |

Enrollment involves **identity/business verification** (legal docs, phone calls, sometimes notarization). Budget 2–5 business days after payment. There is no automated path — no API issues these. Claude cannot acquire an AATL cert on your behalf.

## Replacing the cert post-deploy

Once you have a `.p12` from your chosen CA:

```bash
source .deploy.env

# Validate the cert
openssl pkcs12 -info -in /path/to/new.p12 -nokeys -nomacver \
  -passin "pass:<new passphrase>" 2>&1 | grep -E "subject|issuer|Not"

# Base64-encode
NEW_CERT_B64=$(base64 -w0 /path/to/new.p12)

# Read current app-config, swap the two signing fields, put it back
APP_CONFIG_ARN="<from stack outputs>"
aws secretsmanager get-secret-value --secret-id "$APP_CONFIG_ARN" \
  --query SecretString --output text | jq \
  --arg pp "<new passphrase>" --arg cert "$NEW_CERT_B64" \
  '.NEXT_PRIVATE_SIGNING_PASSPHRASE=$pp | .NEXT_PRIVATE_SIGNING_LOCAL_FILE_CONTENTS=$cert' \
  | aws secretsmanager put-secret-value \
      --secret-id "$APP_CONFIG_ARN" \
      --secret-string file:///dev/stdin

# Roll new tasks so the container picks up the updated secret
aws ecs update-service \
  --cluster "documenso-$ENV_NAME" --service "documenso-$ENV_NAME" \
  --force-new-deployment --no-cli-pager

aws ecs wait services-stable \
  --cluster "documenso-$ENV_NAME" --services "documenso-$ENV_NAME"
```

New signatures use the new cert immediately. Existing signed documents keep their original signature — they were signed at a point in time.

## Inspecting the currently deployed cert

```bash
CUR_B64=$(aws secretsmanager get-secret-value --secret-id "$APP_CONFIG_ARN" \
  --query SecretString --output text | jq -r .NEXT_PRIVATE_SIGNING_LOCAL_FILE_CONTENTS)
CUR_PP=$(aws secretsmanager get-secret-value --secret-id "$APP_CONFIG_ARN" \
  --query SecretString --output text | jq -r .NEXT_PRIVATE_SIGNING_PASSPHRASE)

echo "$CUR_B64" | base64 -d | openssl pkcs12 -info -nokeys -nomacver \
  -passin "pass:$CUR_PP" 2>/dev/null | grep -E "subject|issuer|Not Before|Not After"
```

## Losing the passphrase

The passphrase is only stored in Secrets Manager. If the secret is wiped or rotated without capturing the passphrase first, you can't use the `.p12` anymore — you'll need to generate/obtain a new one. Nothing to "recover"; PKCS#12 uses the passphrase as the key material.
