# Admin Rule Engine

## Description

Experimental rule-based system that lets admins control certain platform flows.

A rule consists of a "Trigger", "Conditions" and "Actions".

An example of a rule would be:

"When a document is sent, if the sender sent more than 1000 documents in the last 24 hours AND is on the free plan"

An example of an action would be:

"Flag account"

## Decisions

- Not failing closed. If the engine errors, the event goes ahead, so a broken rule can't break sending or sign-ups.
- Not blocking sign-ups. Sign-up rules run after the account exists, so they can flag or disable it but not stop it.
- Not stopping the event when a rule only disables the user. The rule also needs a block action.
- Not ending sessions when a rule disables a user.
- Not throwing a visible error when a background job's signing email is blocked. The recipient stays unsent, with no audit log entry and no message to the owner.
- Not relying on the document send's check for its signing emails. Each email's job checks it again, so a send records extra matches and a rule can let the send through but block an email.
- Not telling users which rule blocked them. They only see that the action was blocked.
- Not separating checks against direct-link templates. The template owner is the sender while the anonymous visitor supplies the recipient email, IP and user agent, so a visitor can trigger a rule's actions, including `disable_user`, against the owner. Accepted for now and to be watched as this moves into production.
- Not letting a rule disable a site admin. The `disable_user` action fails for admins, so a broad rule can't lock them out of the rules pages.
- Not running the team and organisation name rules on site-admin edits, or on the personal organisation and team created at sign-up.
- Not running the team and organisation name rules when only the URL changes.
- Not restricting regex conditions beyond a length cap. A slow pattern written by an admin can stall the server.
- Not counting sent documents by send time. The volume fields count by creation date, so old drafts sent in a burst are missed.
- Not caching rules between requests, so rule changes apply straight away.
- Not available on self-hosted instances. The rules pages only show on Documenso Cloud.
