#!/usr/bin/env python3
"""
Generate a self-signed X.509 certificate whose subject public key is an AWS KMS
key, signed by the same KMS key. Result: a cert that Adobe Reader shows as
"signature valid, identity not trusted" (since the CA isn't trusted), valid for
testing the Documenso AWS KMS signing transport end-to-end.
"""
import argparse
import datetime
import hashlib
import os
import sys

import boto3
from asn1crypto import keys, pem, x509
from asn1crypto.core import OctetString

# Fixed 5-year validity window (KMS key keeps the same public key forever, so
# the cert's expiry is the only time-bound part).

def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--key-id", required=True, help="KMS key ID or ARN")
    parser.add_argument("--region", default=os.environ.get("AWS_REGION", "us-east-1"))
    parser.add_argument("--profile", default=os.environ.get("AWS_PROFILE"))
    parser.add_argument("--common-name", required=True)
    parser.add_argument("--organization", required=True)
    parser.add_argument("--organizational-unit", default="Documenso")
    parser.add_argument("--email", required=True)
    parser.add_argument("--out", required=True, help="Output PEM file path")
    parser.add_argument("--days", type=int, default=1825)
    args = parser.parse_args()

    session = boto3.Session(profile_name=args.profile, region_name=args.region)
    kms = session.client("kms")

    # 1. Fetch the public key + determine the signing algorithm.
    pk_resp = kms.get_public_key(KeyId=args.key_id)
    spki_der = pk_resp["PublicKey"]  # DER-encoded SubjectPublicKeyInfo
    signing_algorithms = pk_resp.get("SigningAlgorithms", [])
    if not signing_algorithms:
        print(f"KMS key {args.key_id} has no signing algorithms.", file=sys.stderr)
        return 1

    # Prefer RSASSA_PKCS1_V1_5_SHA_256 (broadest Adobe compat), else first.
    preferred = "RSASSA_PKCS1_V1_5_SHA_256"
    kms_alg = preferred if preferred in signing_algorithms else signing_algorithms[0]

    # Map to the X.509 signatureAlgorithm OID we need to embed in the cert.
    alg_map = {
        "RSASSA_PKCS1_V1_5_SHA_256": ("sha256_rsa", hashlib.sha256),
        "RSASSA_PKCS1_V1_5_SHA_384": ("sha384_rsa", hashlib.sha384),
        "RSASSA_PKCS1_V1_5_SHA_512": ("sha512_rsa", hashlib.sha512),
        "ECDSA_SHA_256": ("sha256_ecdsa", hashlib.sha256),
        "ECDSA_SHA_384": ("sha384_ecdsa", hashlib.sha384),
        "ECDSA_SHA_512": ("sha512_ecdsa", hashlib.sha512),
    }
    if kms_alg not in alg_map:
        print(f"Unsupported KMS algorithm for cert building: {kms_alg}", file=sys.stderr)
        return 1
    sig_alg_name, digest_mod = alg_map[kms_alg]

    # 2. Build the TBSCertificate (to-be-signed).
    public_key_info = keys.PublicKeyInfo.load(spki_der)

    name = x509.Name.build({
        "common_name": args.common_name,
        "organization_name": args.organization,
        "organizational_unit_name": args.organizational_unit,
        "email_address": args.email,
    })

    now = datetime.datetime.now(datetime.timezone.utc)
    not_before = now - datetime.timedelta(minutes=5)
    not_after = now + datetime.timedelta(days=args.days)

    # Subject Key Identifier (SHA-1 of the SPKI's BIT STRING contents).
    spki_bit_string = public_key_info["public_key"].contents
    ski = hashlib.sha1(spki_bit_string).digest()

    tbs = x509.TbsCertificate({
        "version": "v3",
        "serial_number": int.from_bytes(os.urandom(16), "big") >> 1,
        "signature": {"algorithm": sig_alg_name},
        "issuer": name,
        "validity": {
            "not_before": x509.Time({"utc_time": not_before}),
            "not_after": x509.Time({"utc_time": not_after}),
        },
        "subject": name,
        "subject_public_key_info": public_key_info,
        "extensions": [
            {
                "extn_id": "basic_constraints",
                "critical": True,
                "extn_value": x509.BasicConstraints({"ca": False}),
            },
            {
                "extn_id": "key_usage",
                "critical": True,
                "extn_value": x509.KeyUsage({"digital_signature", "non_repudiation"}),
            },
            {
                "extn_id": "extended_key_usage",
                "critical": False,
                "extn_value": x509.ExtKeyUsageSyntax(["email_protection"]),
            },
            {
                "extn_id": "key_identifier",
                "critical": False,
                "extn_value": OctetString(ski),
            },
        ],
    })

    # 3. Hash the TBS bytes and sign via KMS.
    tbs_der = tbs.dump()
    digest = digest_mod(tbs_der).digest()
    sign_resp = kms.sign(
        KeyId=args.key_id,
        Message=digest,
        MessageType="DIGEST",
        SigningAlgorithm=kms_alg,
    )
    signature = sign_resp["Signature"]

    # 4. Assemble the final certificate.
    cert = x509.Certificate({
        "tbs_certificate": tbs,
        "signature_algorithm": {"algorithm": sig_alg_name},
        "signature_value": signature,
    })

    pem_bytes = pem.armor("CERTIFICATE", cert.dump())
    with open(args.out, "wb") as f:
        f.write(pem_bytes)

    print(f"Wrote {args.out}")
    print(f"  Subject: CN={args.common_name}, O={args.organization}, OU={args.organizational_unit}")
    print(f"  Signed with KMS alg: {kms_alg}")
    print(f"  Validity: {not_before.isoformat()} → {not_after.isoformat()}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
