# Security Policy

Thanks for taking the time to help keep this project and its users safe.

## Supported versions

We accept reports against the latest released version and the current `main` / `master` branch. Older versions are best-effort.

| Version | Supported |
|---|---|
| Latest release | yes |
| `main` / `master` | yes |
| Previous minor | best-effort |
| Older | no |

## Reporting a vulnerability

**Please do not open a public issue, discussion, or pull request for security bugs.** Use one of the following private channels instead:

- **Preferred:** GitHub Private Vulnerability Reporting at <https://github.com/documenso/documenso/security/advisories/new>
- **Email:** `security@documenso.com`

In your report, please include:

- A clear description of the issue and its impact.
- Steps to reproduce, or a minimal proof-of-concept. Self-contained PoCs help us triage quickly.
- The affected version(s) and platform.
- Suggested remediation, if you have one.

## What to expect

- **Acknowledgement:** within 5 business days.
- **Triage and initial assessment:** within 7 business days, including a severity estimate (CVSS v3.1) and a target fix timeline.
- **Status updates:** at least every 14 days while the report is open.
- **Fix and coordinated disclosure:** the embargo length depends on severity. We aim for a patched release within 90 days; critical issues are prioritized.

If you do not hear back within the acknowledgement window, please escalate by replying to the same thread or contacting the email address above.

## Scope

In scope:

- The code in this repository.
- Official release artifacts (binaries, container images) published from this repository.
- Configuration defaults shipped in this repository.

Out of scope (please report these upstream instead):

- Vulnerabilities in third-party dependencies that are not reachable from any code path in this project.
- Issues in users' self-hosted infrastructure that are unrelated to this project's code (network exposure, weak operator passwords, etc.).
- Reports generated solely by automated scanners with no demonstrated impact.

## Coordinated disclosure

We follow responsible disclosure. Please give us a reasonable window to ship a fix before any public discussion. We will credit reporters in the published advisory unless they request otherwise along with creating a CVE for the report.
