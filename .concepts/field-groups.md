# Field Groups

## Description

Allows recipient fields on a V2 envelope to share a Group ID, so they act as a single field when signing.

Conditions for a group to be valid:
- All fields in the group must be of the same type.
- All fields in the group must belong to the same recipient.
- All fields in the group must share the same validation settings.

## Decisions

- Not available on V1 envelopes.
- Not available for signature, initials or date fields.
- Not allowing a group to span recipients or field types.
- Not syncing visual settings across a group (font size, alignment, etc). Only validation and value settings are shared.
- Not blocking edits that would invalidate a group. Deleting a field, removing an option or moving a field out of a group removes the group's validation rule.
- Not renaming a group for all its fields. Changing the Group ID on a field only moves that field.
- Not enforcing checkbox validation rules while signing. Any options can be selected, and the rules are checked when the recipient completes the document.
- Not treating an inserted optional field as optional. Once a recipient inserts it, its validation rules apply as if it were required.
- Not showing the group navigation bar on hover for touch devices.
- Not counting a group as one field in the signing counters. The fields remaining, the progress bar and the document tabs count every field in a group. Once a checkbox group is ticked but breaks its validation, only its fields without a selection still count.
