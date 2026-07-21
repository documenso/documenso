# Security Policy

We take the security of Documenso seriously. As a platform trusted with legally binding documents, the safety of the project and the people who rely on it is a priority for us. We're grateful to the security researchers who help keep it that way. If you've found an issue, we'd genuinely like to hear about it.

## Reporting a Vulnerability

Report security vulnerabilities privately. Do not open a public issue, discussion, or pull request for security reports.

We accept reports through two channels, in order of preference:

1. **GitHub Security Advisories (preferred)**. Use the [private vulnerability reporting form](https://github.com/documenso/documenso/security/advisories/new). This is our primary channel and lets us triage and work with you on a fix.
2. **Email**. If you cannot use GitHub Security Advisories, email [security@documenso.com](mailto:security@documenso.com).

Include the affected version, a clear description, steps to reproduce, and the potential impact.

## Triage and Response

We triage reports as we have availability. We read every report we receive, and we appreciate the time and effort it takes to put one together.

We also run [Codex](https://openai.com/codex/) security analysis across the codebase. If Codex has already reported the issue you're sending us, we may close your report as a duplicate. Please don't take this as a reflection on your work; it just means our automated tooling happened to surface the same thing first.

## Scope

This policy covers vulnerabilities in the Documenso application code in this repository.

The items below are out of scope and will not be accepted. They are deployment, infrastructure, and configuration concerns that belong with the operator's firewall, network, and environment setup, not the application:

- Server-Side Request Forgery (SSRF) and related network-egress concerns
- DNS rebinding and other DNS-level issues
- Rate limiting, denial of service, and volumetric attacks
- TLS and certificate configuration, HTTP security headers, and other reverse-proxy or web-server configuration
- Findings that depend on insecure self-hosted infrastructure or misconfiguration

If you're unsure whether something is in scope, report it privately anyway and we'll happily take a look.

## Supported Versions

Security fixes are applied to the latest release. Run the most recent version of Documenso.
