---
name: concepts
description: Recording a feature's concept and its significant decisions in the `.concepts/` folder at the repo root. Use when the user asks to create, add or update a concept, record or log the decisions made on a feature, or capture what a feature deliberately doesn't do. Triggers include requests to "add a concept", "create a concept file", "record this decision", "update the concept for X", "write down the decisions we made", or wrapping up a feature whose decisions should be kept.
---

# Concepts

`.concepts/` at the repo root records feature concepts: a short description of each feature, and the significant decisions made about it, mostly what we chose not to do. It's for future contributors and agents who need to know where a feature's limits are and why. It isn't user documentation (that's `apps/docs`) or a spec.

See `.concepts/admin-rule-engine.md` for an example.

## Files

- One Markdown file per concept, named after the feature in kebab-case: `.concepts/<concept-name>.md`.
- Before creating a file, check whether the feature already has one. If it does, update it instead.

## Template

Every concept has these two sections, in this order, and nothing else. Don't add implementation details or other sections.

```md
# <Concept Name>

## Description

<One line saying what the feature is.>

<One line saying what it's made of.>

An example of <a part> would be:

"<example>"

## Decisions

- <Not doing X.> <What that means, in one short sentence.>
```

## Description

- Short lines separated by blank lines, never a paragraph.
- One line saying what the feature is, one line on its main parts, then one or two concrete examples in quotes.
- Keep it to about ten lines.

## Decisions

Only significant, deliberate decisions, mostly things we chose **not** to do: scope cuts, risks we accepted, and behaviour we decided not to change.

- One bullet per decision. Lead with the decision, then one short sentence on what it means.
- Usually 5 to 12 bullets. If a bullet wouldn't change how someone builds on or reasons about the feature, leave it out.

Examples of decisions to store:

- Not exposing the X in the public API. It's only available in the app.
- Not supporting Y.
- Not throwing Z
- Not doing X due to Y

Examples of decisions to not store:

- How something works: "Deleting a record also deletes its history."
- Implementation details: "Statuses are stored as strings, so a new status needs no migration."
- Small UI choices: "IDs show as raw values in the dropdown."
- Test or CI setup: "The e2e tests only run on Cloud."
- Small extras put off for later: "Editing by hand is deferred."
- Open questions that haven't been decided yet.

## Finding decisions

1. The conversation: options the user rejected, review items they dropped or chose to leave as they are, and risks they accepted.
2. Code comments that say something is deliberately not handled.
3. Issue or review lists in the repo that record dropped items.

Check each decision against the current code before writing it down, and leave out anything you can't confirm.

## Updating a concept

- Add a new decision next to related ones.
- When a decision changes, rewrite or remove the old bullet. Two bullets must never contradict each other.
- Remove bullets that no longer apply, so the file stays short.

## Style

- Plain, direct sentences. No marketing tone and no emojis.
- Use the names people see in the product, and put code identifiers in backticks.
