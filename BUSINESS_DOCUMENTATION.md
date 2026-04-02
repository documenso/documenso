# Documenso Business Documentation

## 1) Product Overview

Documenso is an open-source electronic signature platform designed as an alternative to closed, proprietary signing tools. It enables teams to prepare, send, sign, and manage legally relevant documents with support for both cloud-hosted and self-hosted deployments.

At a business level, the product value is built on three pillars:

- **Operational efficiency**: faster agreement cycles through templates, workflows, and reminders.
- **Trust and control**: auditability, security controls, and compliance-oriented documentation.
- **Flexibility**: API/embedding for product teams and self-hosting for organizations with infrastructure, residency, or governance requirements.

---

## 2) Core Feature Set

## 2.1 Document Workflow

- Upload PDF documents and prepare them for signature.
- Add recipients with roles such as signer, approver, viewer, CC, and assistant.
- Place required fields (e.g., signature, text, date) on document pages.
- Send documents for signing and track lifecycle status (draft, pending, completed, rejected).
- Trigger reminders and manage post-send actions (resend, cancel, archive/download flows).

## 2.2 Templates and Reuse

- Create templates to standardize recurring agreements.
- Configure default recipients and reusable field placement.
- Support organization template sharing for team-wide consistency.
- Use direct-link flows for self-serve/template-driven signing scenarios.

## 2.3 Organization and Access Management

- Multi-tenant model with organizations, teams, members, and groups.
- Role-based permissions for operational separation (admins/managers/members).
- Team-level and user-level management controls.
- Centralized organization billing and plan management.

## 2.4 Security, Compliance, and Trust

- Security controls including account authentication options, passkeys/2FA capabilities, and audit logs.
- Compliance documentation for major e-signature/legal frameworks (informational guidance).
- Signature and workflow controls like expiration and document visibility.
- Enterprise-grade controls for SSO and advanced governance (plan-gated).

## 2.5 Developer and Integration Platform

- Public API for documents, templates, recipients, teams, and related resources.
- Webhooks for event-driven automation.
- Embedded signing and embedded authoring options for product integration.
- SDK/documentation support for engineering teams.

## 2.6 Deployment and Hosting Options

- Managed/cloud usage model.
- Self-hosted deployment options through Docker, Compose, Kubernetes, and PaaS platforms.
- Configuration controls for storage, email, jobs, and signing providers.

---

## 3) Primary Personas and Jobs-to-be-Done


| Persona                | Typical Goals                                     | Core Features Used                                       |
| ---------------------- | ------------------------------------------------- | -------------------------------------------------------- |
| Founder / Ops Lead     | Send contracts quickly and reduce turnaround time | Documents, templates, reminders, status tracking         |
| HR / People Operations | Standardize onboarding agreements at scale        | Templates, recipient roles, bulk-like workflows          |
| Legal / Compliance     | Ensure traceability and policy consistency        | Audit logs, visibility controls, expiration rules        |
| Engineering Team       | Integrate signing into product workflows          | API, webhooks, embedded signing/authoring                |
| IT / Security Admin    | Enforce identity, access, and deployment policies | SSO, org/team controls, self-hosting, environment config |


---

## 4) Business Model and Packaging (Observed)

Documenso follows a mixed open-source and commercial model:

- **Community Edition (AGPL)** for open-source usage and self-hosting.
- **Paid cloud plans** with usage/feature limits and advanced capabilities.
- **Enterprise Edition** for larger organizations requiring support, control, and enterprise-specific features.
- **Feature gating** appears across capabilities such as SSO, advanced embedding, and selected recipient/security controls.

This structure supports:

- developer-led adoption via open source,
- expansion through team/organization workflows,
- monetization through scale, governance, and enterprise requirements.

---

## 5) Limitations and Constraints (Important for Stakeholders)

- Primary upload format is PDF-focused.
- Encrypted/password-protected PDF support is constrained in standard workflow.
- API and plan-level limits apply (rate and/or usage limits depending on plan).
- Some advanced identity/security features are enterprise-gated.
- Self-hosting has infrastructure prerequisites (e.g., PostgreSQL, email delivery setup).

---

## 6) Business Requirements Document (BRD)

## 6.1 Document Control


| Field         | Value                                                                  |
| ------------- | ---------------------------------------------------------------------- |
| Project       | Documenso Product Platform                                             |
| Document Type | Business Requirements Document (BRD)                                   |
| Purpose       | Define business scope, capabilities, constraints, and success criteria |
| Audience      | Product, engineering, operations, security, and go-to-market teams     |


## 6.2 Problem Statement

Organizations need a trustworthy way to execute agreements digitally while balancing legal confidence, user experience, integration flexibility, and control over infrastructure. Many existing solutions are expensive, opaque, or difficult to adapt to product-embedded and self-hosted requirements.

## 6.3 Business Objectives

1. Reduce contract/document cycle time through digital workflows.
2. Increase completion rates with better recipient orchestration and reminders.
3. Provide transparent and controllable trust infrastructure via open source and self-hosting.
4. Enable platform extensibility via APIs, webhooks, and embedding.
5. Support growth from individual users to enterprise organizations.

## 6.4 In Scope

- Document preparation, recipient assignment, field placement, send/sign lifecycle.
- Template creation and reuse.
- Organization/team administration and access controls.
- API + webhook integration capabilities.
- Deployment models (cloud + self-hosted).
- Compliance/security documentation and controls.

## 6.5 Out of Scope

- Custom legal advice for jurisdiction-specific enforceability.
- End-to-end identity verification/KYC as a built-in universal default.
- Non-signature business process orchestration beyond document agreement lifecycle.

## 6.6 Functional Requirements


| ID    | Requirement                                                                                     | Priority |
| ----- | ----------------------------------------------------------------------------------------------- | -------- |
| FR-1  | Users can upload and prepare documents for electronic signing                                   | Must     |
| FR-2  | Users can define recipients with role-based responsibilities                                    | Must     |
| FR-3  | Users can place required fields and enforce completion rules                                    | Must     |
| FR-4  | System tracks status transitions and exposes lifecycle events                                   | Must     |
| FR-5  | Users can create and reuse templates                                                            | Must     |
| FR-6  | Organizations can manage teams, memberships, and permissions                                    | Must     |
| FR-7  | System exposes API and webhooks for integrations                                                | Must     |
| FR-8  | Product supports embedded signing/authoring scenarios                                           | Should   |
| FR-9  | Self-hosting configuration supports common deployment patterns                                  | Should   |
| FR-10 | Enterprise controls (e.g., SSO, advanced policy controls) are available under appropriate plans | Should   |


## 6.7 Non-Functional Requirements


| ID    | Requirement                                                                | Priority |
| ----- | -------------------------------------------------------------------------- | -------- |
| NFR-1 | Security controls for authentication, session management, and auditability | Must     |
| NFR-2 | Multi-tenant data isolation at org/team boundaries                         | Must     |
| NFR-3 | Configurable infrastructure providers (storage, email, jobs, signing)      | Must     |
| NFR-4 | API and webhook reliability for integration scenarios                      | Should   |
| NFR-5 | Internationalization support for global usage                              | Should   |
| NFR-6 | Operational observability and background job monitoring                    | Should   |


## 6.8 Stakeholders

- Product management
- Engineering (frontend/backend/platform)
- Security/compliance
- Customer success/support
- Self-hosting administrators / DevOps
- Enterprise buyers/procurement

## 6.9 Assumptions

- Target organizations accept digital signature workflows for their use cases.
- Email infrastructure is available and reliable for notifications.
- Customers with strict data control requirements can operate supported self-hosting infrastructure.

## 6.10 Risks and Mitigations


| Risk                                      | Impact                    | Mitigation                                                                     |
| ----------------------------------------- | ------------------------- | ------------------------------------------------------------------------------ |
| Regulatory variation across jurisdictions | Legal/process uncertainty | Keep compliance docs explicit and non-advisory; provide configurable workflows |
| Email deliverability issues               | Lower completion rates    | Support multiple mail transports and operational troubleshooting               |
| Feature complexity for new users          | Slower onboarding         | Strengthen guided flows, templates, and onboarding docs                        |
| Plan-gated confusion                      | Sales/support overhead    | Maintain transparent feature matrix and policy docs                            |
| Self-hosting operational burden           | Adoption friction         | Provide reference deployment guides and maintenance docs                       |


## 6.11 Success Metrics (KPIs)


| KPI                                 | Why it Matters                                         |
| ----------------------------------- | ------------------------------------------------------ |
| Document completion rate            | Primary indicator of workflow effectiveness            |
| Median time-to-completion           | Operational efficiency and UX quality                  |
| Template reuse ratio                | Standardization and repeatability                      |
| API/webhook adoption                | Platform extensibility and developer value             |
| Team/org expansion within accounts  | Product-led growth signal                              |
| Self-hosted deployment success rate | Infrastructure viability for control-focused customers |


## 6.12 Release and Adoption Considerations

- Prioritize onboarding guidance for first document completion.
- Keep feature documentation synchronized with API and UI changes.
- Track plan-gated behavior carefully across cloud and enterprise editions.
- Maintain migration guidance for major model changes (e.g., schema evolution).

---

## 7) Recommended Next Business Artifacts

For product planning, you can extend this BRD with:

- A feature-to-plan entitlement matrix.
- A process map for each core persona.
- A GTM positioning brief by segment (SMB, mid-market, enterprise, self-hosters).
- A quarterly KPI dashboard mapped to the metrics in section 6.11.

