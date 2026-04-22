#!/usr/bin/env python3
"""
Provision Azure Key Vault Premium for Documenso signing.

Creates (idempotent):
- Resource group
- Key Vault Premium with RBAC, purge protection
- RSA-HSM 3072-bit non-exportable signing key (sign + verify only)
- Service principal with Key Vault Crypto User role scoped to the key

Appends AZURE_KV_URL, AZURE_KV_TENANT_ID, AZURE_KV_CLIENT_ID, AZURE_KV_CLIENT_SECRET
to a `.deploy.env` file so the subsequent CFN deploy can pick them up.

Uses the same auth pattern as the gnarlysoft-microsoft:azure skill's auth.py
(OAuth 2.0 client credentials flow against Microsoft Graph + management API).

Usage:
    python setup-azure-kv.py \\
        --profile <azure-auth-profile> \\
        --subscription <sub-uuid> \\
        --resource-group documenso-signing-prod \\
        --location eastus \\
        --vault-name <globally-unique-name> \\
        --key-name documenso-signing-prod \\
        --env-out .deploy.env
"""
from __future__ import annotations

import argparse
import json
import os
import secrets
import sys
import time
from pathlib import Path
from typing import Any

import requests


AZURE_MGMT = "https://management.azure.com"
AZURE_KV_DATA_SCOPE = "https://vault.azure.net/.default"
AZURE_GRAPH_SCOPE = "https://graph.microsoft.com/.default"
API_VERSION_VAULTS = "2023-07-01"
API_VERSION_RBAC = "2022-04-01"
KV_CRYPTO_USER_ROLE_ID = "12338af0-0e69-4776-bea7-57ae8d297424"  # Built-in


def get_token(profile: str, scope: str) -> str:
    """Delegate token acquisition to the gnarlysoft-microsoft:azure skill's helper."""
    import subprocess  # nosec
    script_dir = Path.home() / ".claude/plugins/cache/gnarlysoft-plugins/microsoft/1.0.0/scripts"
    if not (script_dir / "auth.py").exists():
        raise RuntimeError(
            f"Azure auth helper not found at {script_dir}. "
            "Install the gnarlysoft-microsoft plugin first."
        )

    result = subprocess.run(  # nosec
        ["uv", "run", "python", "auth.py", "get-token", profile, "--scope", scope],
        cwd=script_dir,
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        raise RuntimeError(f"Token fetch failed: {result.stderr}")

    return result.stdout.strip()


def arm_request(
    method: str,
    path: str,
    token: str,
    api_version: str,
    json_body: dict | None = None,
) -> dict[str, Any]:
    """Issue an Azure Resource Manager request with consistent error reporting."""
    url = f"{AZURE_MGMT}{path}"
    separator = "&" if "?" in url else "?"
    url = f"{url}{separator}api-version={api_version}"

    headers = {"Authorization": f"Bearer {token}"}
    if json_body is not None:
        headers["Content-Type"] = "application/json"

    response = requests.request(method, url, headers=headers, json=json_body, timeout=60)

    if not response.ok:
        raise RuntimeError(
            f"{method} {path} failed: {response.status_code} {response.text[:500]}"
        )

    if response.status_code == 204 or not response.content:
        return {}
    return response.json()


def ensure_resource_group(
    token: str, subscription: str, name: str, location: str
) -> None:
    path = f"/subscriptions/{subscription}/resourcegroups/{name}"
    arm_request(
        "PUT", path, token, "2021-04-01", json_body={"location": location}
    )
    print(f"  resource group: {name} (location={location})")


def ensure_key_vault(
    token: str,
    subscription: str,
    resource_group: str,
    name: str,
    location: str,
    tenant_id: str,
) -> dict[str, Any]:
    path = (
        f"/subscriptions/{subscription}/resourceGroups/{resource_group}"
        f"/providers/Microsoft.KeyVault/vaults/{name}"
    )
    body = {
        "location": location,
        "properties": {
            "tenantId": tenant_id,
            "sku": {"family": "A", "name": "premium"},
            "enableRbacAuthorization": True,
            "enableSoftDelete": True,
            "softDeleteRetentionInDays": 90,
            "enablePurgeProtection": True,
            "accessPolicies": [],
        },
    }
    result = arm_request("PUT", path, token, API_VERSION_VAULTS, json_body=body)
    print(f"  key vault: {name} (sku=premium)")
    return result


def ensure_signing_key(
    data_token: str, vault_url: str, key_name: str
) -> dict[str, Any]:
    """Create an RSA-HSM 3072-bit non-exportable sign-only key via the data plane."""
    url = f"{vault_url}/keys/{key_name}/create?api-version=7.4"
    headers = {
        "Authorization": f"Bearer {data_token}",
        "Content-Type": "application/json",
    }
    body = {
        "kty": "RSA-HSM",
        "key_size": 3072,
        "key_ops": ["sign", "verify"],
        "attributes": {"enabled": True, "exportable": False},
    }

    response = requests.post(url, headers=headers, json=body, timeout=60)
    if not response.ok:
        raise RuntimeError(f"Key create failed: {response.status_code} {response.text[:500]}")

    print(f"  signing key: {key_name} (RSA-HSM 3072, non-exportable)")
    return response.json()


def create_service_principal(
    graph_token: str, display_name: str
) -> tuple[str, str, str]:
    """Create an Entra app registration + SP; return (app_id, sp_object_id, secret).

    Idempotent on displayName: if one exists, reuse it instead of creating a duplicate.
    """
    list_url = f"https://graph.microsoft.com/v1.0/applications?$filter=displayName eq '{display_name}'"
    headers = {"Authorization": f"Bearer {graph_token}"}
    existing = requests.get(list_url, headers=headers, timeout=60).json()

    if existing.get("value"):
        app = existing["value"][0]
    else:
        create_url = "https://graph.microsoft.com/v1.0/applications"
        app = requests.post(
            create_url,
            headers={**headers, "Content-Type": "application/json"},
            json={"displayName": display_name, "signInAudience": "AzureADMyOrg"},
            timeout=60,
        ).json()

    app_id = app["appId"]

    sp_list = requests.get(
        f"https://graph.microsoft.com/v1.0/servicePrincipals?$filter=appId eq '{app_id}'",
        headers=headers,
        timeout=60,
    ).json()
    if sp_list.get("value"):
        sp = sp_list["value"][0]
    else:
        sp = requests.post(
            "https://graph.microsoft.com/v1.0/servicePrincipals",
            headers={**headers, "Content-Type": "application/json"},
            json={"appId": app_id},
            timeout=60,
        ).json()

    secret_response = requests.post(
        f"https://graph.microsoft.com/v1.0/applications/{app['id']}/addPassword",
        headers={**headers, "Content-Type": "application/json"},
        json={"passwordCredential": {"displayName": f"documenso-{int(time.time())}"}},
        timeout=60,
    ).json()

    if "secretText" not in secret_response:
        raise RuntimeError(f"Password creation failed: {secret_response}")

    print(f"  service principal: {display_name} (appId={app_id})")
    return app_id, sp["id"], secret_response["secretText"]


def assign_kv_crypto_user_role(
    mgmt_token: str, vault_resource_id: str, key_name: str, sp_object_id: str
) -> None:
    """Assign 'Key Vault Crypto User' role scoped to the one key."""
    scope = f"{vault_resource_id}/keys/{key_name}"
    role_assignment_id = secrets.token_hex(16)
    path = f"{scope}/providers/Microsoft.Authorization/roleAssignments/{role_assignment_id}"

    role_def_id = (
        f"/subscriptions/{vault_resource_id.split('/')[2]}"
        f"/providers/Microsoft.Authorization/roleDefinitions/{KV_CRYPTO_USER_ROLE_ID}"
    )

    body = {
        "properties": {
            "roleDefinitionId": role_def_id,
            "principalId": sp_object_id,
            "principalType": "ServicePrincipal",
        }
    }
    arm_request("PUT", path, mgmt_token, API_VERSION_RBAC, json_body=body)
    print(f"  role: Key Vault Crypto User → {sp_object_id} (scope={key_name})")


def append_env(env_path: Path, mapping: dict[str, str]) -> None:
    """Append/update key=value pairs in a dotenv file without touching other keys."""
    existing: dict[str, str] = {}
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            if "=" in line and not line.lstrip().startswith("#"):
                key, _, value = line.partition("=")
                existing[key.strip()] = value

    existing.update(mapping)

    lines = [f"{k}={v}" for k, v in existing.items()]
    env_path.write_text("\n".join(lines) + "\n")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--profile", required=True, help="Azure auth profile name")
    parser.add_argument("--subscription", required=True, help="Azure subscription UUID")
    parser.add_argument("--resource-group", required=True)
    parser.add_argument("--location", default="eastus")
    parser.add_argument("--vault-name", required=True, help="Must be globally unique")
    parser.add_argument("--key-name", required=True)
    parser.add_argument("--env-out", default=".deploy.env")
    parser.add_argument(
        "--sp-name",
        default=None,
        help="Service principal displayName (default: documenso-signing-ecs-<rg>)",
    )
    args = parser.parse_args()

    sp_name = args.sp_name or f"documenso-signing-ecs-{args.resource_group}"
    vault_url = f"https://{args.vault_name}.vault.azure.net"

    print("Fetching Azure tokens...")
    mgmt_token = get_token(args.profile, "https://management.azure.com/.default")
    kv_data_token = get_token(args.profile, AZURE_KV_DATA_SCOPE)
    graph_token = get_token(args.profile, AZURE_GRAPH_SCOPE)

    sub_info = arm_request(
        "GET", f"/subscriptions/{args.subscription}", mgmt_token, "2022-12-01"
    )
    tenant_id = sub_info["tenantId"]

    print(f"\nProvisioning in subscription {args.subscription} (tenant {tenant_id}):")
    ensure_resource_group(mgmt_token, args.subscription, args.resource_group, args.location)
    vault = ensure_key_vault(
        mgmt_token,
        args.subscription,
        args.resource_group,
        args.vault_name,
        args.location,
        tenant_id,
    )

    print("  waiting 10s for vault data plane to be ready...")
    time.sleep(10)

    ensure_signing_key(kv_data_token, vault_url, args.key_name)

    app_id, sp_object_id, client_secret = create_service_principal(graph_token, sp_name)

    assign_kv_crypto_user_role(
        mgmt_token,
        vault["id"],
        args.key_name,
        sp_object_id,
    )

    env_updates = {
        "AZURE_SUBSCRIPTION_ID": args.subscription,
        "AZURE_KV_URL": vault_url,
        "AZURE_KV_VAULT_NAME": args.vault_name,
        "AZURE_KV_KEY_NAME": args.key_name,
        "AZURE_KV_TENANT_ID": tenant_id,
        "AZURE_KV_CLIENT_ID": app_id,
        "AZURE_KV_CLIENT_SECRET": client_secret,
    }

    append_env(Path(args.env_out), env_updates)

    print(f"\n✓ Azure KV provisioning complete. Values written to {args.env_out}:")
    for key in env_updates:
        masked = "***" if "SECRET" in key else env_updates[key]
        print(f"  {key}={masked}")

    print(
        "\nNext: go to Azure portal → this vault → Certificates → Generate/Import "
        "to create the attested CSR for SSL.com submission."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
