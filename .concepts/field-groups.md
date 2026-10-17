# Field Groups

## Description

Lets fields on a V2 envelope share a Group ID so they act as a single field when signing.

A group is made of fields of the same type, belonging to the same recipient, which share their validation settings.

An example of a group would be:

"Three checkbox fields spread across two pages, with a rule that at least two options are selected across all of them"

An example of a group acting as one field would be:

"A recipient fills in one text field in a group and every other field in the group is filled with the same value"

Fields also gain an External ID, and checkbox and radio fields gain a Hide Option Labels option which hides the text next to each option.

## Decisions

- Not available for signature, initials or date fields. The API rejects a Group ID on these types.
- Not available on V1 envelopes. The V1 editor and signing pages are untouched and the API rejects a Group ID on them.
- Not allowing a group to span recipients or field types. The editor only suggests matching groups and the API rejects anything else.
- Not syncing visual settings across a group. Only validation and value settings are shared, so font size, alignment and direction stay per field.
- Not blocking edits that would invalidate a group. Deleting a member, removing an option or moving a field out of a group removes the group's validation rule and shows a warning instead of failing to save.
- Not renaming a group for all its members. Changing the Group ID on a field only moves that field.
- Not enforcing checkbox validation rules while signing. Any options can be selected, and the rules are checked when the recipient completes the document.
- Not treating an inserted optional field as optional. Once a recipient inserts it, its validation rules apply as if it were required.
- Not showing the group navigation bar on hover for touch devices. It only appears there when the group is pointed out as the next field to sign.
- Not keeping the bar pinned once the recipient moves on. Navigating with the bar pins it on the target, and the pin is released when the group becomes valid, the recipient clicks anywhere else, or hovers another grouped field.
- Not delaying the group highlight with the bar. The bar lingers half a second after the pointer leaves so it can be reached, but the tint on the other members of the group follows the pointer immediately.
- Not counting each member separately when signing. A group counts as one item in the fields remaining, the progress bar and "Next Field", and the pending tooltip sits on the first member by document order.
- Not offering Hide Label on text style fields. Only checkbox and radio fields can hide labels, so the value of each option can be kept private on the page.
- Not exposing the sign request in the public API. `envelope.field.sign` only takes `fieldValues` and returns `signedFields`, and is only used by the signing page.
- Not treating External ID as unique or using it internally. It's stored and returned as is, and copied when a field or envelope is duplicated.
