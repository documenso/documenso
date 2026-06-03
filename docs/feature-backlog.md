# PSD401 Documenso Feature Backlog

Feature requests and improvement ideas. Not yet planned or built.

---

## Admin announcement banners

Ability for org admins to display a dismissible banner at the top of the app (e.g., scheduled maintenance notices, policy changes). Motivated by the 2026-04-30 cutover where we couldn't show advance notice to users because the upstream Docker image and standard Caddy don't support content injection.

**Why:** Users don't always check email in time; an in-app banner would reach active users immediately.

**Approach:** Environment variable or admin UI toggle. Needs to work with both Caddy and native deployments.

---

## In-app feature request form

A simple form accessible to signed-in users (e.g., under Help or a sidebar link) to submit feature requests. Requests stored in the database, visible to org admins.

**Why:** Users are emailing Reese directly with feature requests; a central place to collect and track them reduces back-and-forth and ensures nothing gets lost.

**Approach:** Simple table (FeatureRequest: userId, title, description, status, createdAt) with a lightweight form UI and an admin view to triage.

---

## Document rotation in editor

Allow users to rotate uploaded document pages (90/180/270 degrees) within the Documenso UI before adding fields. Currently users must fix orientation in Adobe/etc before uploading.

**Why:** User request (2026-04-30) — staff uploading scanned docs in landscape orientation can't rotate them without leaving the app. DocuSign had this.

**Approach:** Manipulate PDF page rotation metadata (or re-render rotated pages) before/during the field placement step.

---

## Free-position checkbox/radio field groups

Allow grouped checkbox and radio fields to be placed individually anywhere on the document rather than stacking vertically. Currently, grouped fields only populate in a vertical column, but health plan documents have options laid out horizontally.

**Why:** User request (2026-04-30) — health services staff can't use validation rules (select exactly N options) with their existing document layouts because grouped fields can't match the horizontal formatting of their health care plan forms. Blocking adoption for health documents.

**Approach:** Decouple the group concept from visual layout — each field in a group should be independently draggable on the document while still sharing validation rules (min/max selections, mutual exclusivity for radio).

---

## Calculated fields (formulas for number inputs)

Allow number fields to reference other number fields with basic formulas, so calculated values auto-populate. DocuSign calls these "Calculated Fields" — users create number input fields with data labels, then add a formula field that combines them with arithmetic operators.

**Why:** User request (2026-04-30) — staff creating order forms, invoices, and budget documents need auto-calculated totals, tax amounts, and subtotals. Currently they have to do the math manually or use a separate spreadsheet. DocuSign supported this.

**What DocuSign offered:**
- Basic arithmetic: add, subtract, multiply, divide
- Functions: SUM (across multiple fields), ROUND (decimal precision), IF (conditional values)
- Formula editor UI where you pick fields by name and build expressions
- Configurable decimal places
- Common uses: invoice line totals (qty x price), tax calculations, order form subtotals

**Approach:** Add a "formula" field type that references other number fields by data label. Start with basic arithmetic (+, -, *, /) and SUM. Formula editor in the field properties panel. Calculated fields are read-only to the signer — they auto-update as referenced fields are filled in. Keep it simple initially; IF/ROUND/DATEADD can come later.
