# Product Requirements Document: Signing Reminders

## 1. Executive Summary

This document outlines the requirements for implementing a "Signing Reminders" feature. The goal is to automatically send periodic email reminders to recipients of documents that have been sent but not yet completed (signed or declined). This feature aims to improve document completion rates by gently nudging recipients. The implementation will leverage the existing Inngest infrastructure for background job processing, utilizing its scheduled function capabilities for triggering the reminder checks.

## 2. Feature Scope

### 2.1. Objectives

- Increase the likelihood and timeliness of document signing by recipients.
- Provide a low-touch mechanism for follow-up on pending documents.
- Integrate seamlessly with the existing document lifecycle and notification system.
- Utilize the existing Inngest setup for reliable, scheduled task execution.

### 2.2. Core Functionality

- **Scheduled Check:** An Inngest function will run automatically on a defined schedule (e.g., daily).
- **Identify Pending Documents:** The function will query the database to find documents that are in a 'sent' state, not yet 'completed', and have not expired.
- **Calculate Reminder Due Date:** For each pending document/recipient, determine if a reminder is due based on the time elapsed since the document was sent or the last reminder was sent.
- **Reminder Interval:** A fixed interval (e.g., every 3 days) will be used to determine when reminders are sent.
- **Trigger Reminder Email:** If a reminder is due, trigger a process (likely another Inngest event/function) to send a reminder email to the relevant recipient(s).
- **Update Reminder Timestamp:** Record the timestamp when a reminder is sent for a specific document/recipient to calculate the next reminder interval accurately.
- **Respect Expiry:** Reminders will not be sent for documents that have passed their expiration date.
- **Stop on Completion:** Reminder checks will ignore documents that have reached a terminal state (e.g., 'completed', 'declined', 'expired').

### 2.3. Out of Scope (Initial Implementation)

- User-configurable reminder intervals per document or account.
- User ability to manually trigger or disable reminders for specific documents.
- Different reminder frequencies based on time elapsed (e.g., more frequent reminders initially).
- Maximum number of reminders (beyond stopping at expiry/completion).

### 2.4. Success Criteria

- Reminders are reliably sent according to the defined schedule and interval for all eligible pending documents.
- Reminders cease automatically upon document completion or expiry.
- The feature integrates smoothly without negatively impacting other background jobs or system performance.
- Logs provide clear visibility into the reminder scheduling, checking, and sending process.

## 3. User Stories / Use Cases

- **As a document sender,** I want the system to automatically remind recipients who haven't signed their documents after a few days, so I don't have to follow up manually and documents get completed faster.
- **As a document recipient,** I want to receive a gentle email reminder if I forget to sign a document sent to me, so I can complete the required action promptly.
- **As a system administrator,** I want the reminder process to run reliably in the background using the existing job system (Inngest) without requiring manual intervention or separate infrastructure.

## 4. Technical Implementation

### 4.1. Architecture Overview

The feature will consist of two primary Inngest functions:

1.  **Scheduler Function (`signing-reminder-scheduler`):** Triggered by a cron expression. Queries for documents needing reminders and sends events.
2.  **Email Sending Function (`send-signing-reminder`):** Triggered by an event from the scheduler function. Handles the actual email composition and sending for a specific recipient/document.

This separation ensures the scheduler function remains lightweight and delegates the potentially slower email sending task.

### 4.2. Database Schema Changes

- Add a `lastReminderSentAt` (DateTime, nullable) field to the table tracking document recipients (e.g., `DocumentRecipient` or similar). This field stores the timestamp of the last successfully sent reminder for that specific recipient and document.

### 4.3. New Inngest Functions

**a) `signing-reminder-scheduler`**

- **ID:** `signing-reminder-scheduler`
- **Name:** "Signing Reminder Scheduler"
- **Trigger:** Cron (`{ cron: "0 9 * * *" }` - Runs daily at 9:00 AM UTC, adjustable via config).
- **Logic:**
  1.  Define reminder interval (e.g., `REMINDER_INTERVAL_DAYS = 3`, adjustable via config).
  2.  Calculate the timestamp threshold for needing a reminder: `now - REMINDER_INTERVAL_DAYS`.
  3.  Query the database for `DocumentRecipient` records where:
      - Associated `Document.status` is 'sent'.
      - `Document.expiresAt` is null OR `Document.expiresAt > now`.
      - `DocumentRecipient.status` is 'sent' (or equivalent state indicating pending action).
      - (`DocumentRecipient.lastReminderSentAt` is null AND `Document.sentAt <= threshold`) OR (`DocumentRecipient.lastReminderSentAt <= threshold`).
  4.  Use `step.run` for the database query for resilience.
  5.  For each recipient needing a reminder, use `step.sendEvent` to trigger the `document/send.reminder` event. Pass necessary data like `recipientId`, `documentId`, `recipientEmail`, `documentName`, etc.

```typescript
// Example structure within packages/lib/jobs/client/inngest.ts modification
// or a new dedicated jobs file.
import { db } from '../../db';
import { env } from '../../utils/env';

// Assuming db access

const REMINDER_INTERVAL_DAYS = parseInt(env('SIGNING_REMINDER_INTERVAL_DAYS') || '3', 10);
const REMINDER_CRON_SCHEDULE = env('SIGNING_REMINDER_CRON_SCHEDULE') || '0 9 * * *'; // Daily at 9 AM UTC

// Define the event payload structure
interface SendReminderEventPayload {
  name: 'document/send.reminder';
  data: {
    recipientId: string;
    documentId: string;
    // Add other necessary fields like recipientEmail, documentName, senderName etc.
  };
}

// ... inside InngestJobProvider or where jobs are defined ...

// 1. Scheduler Function
const schedulerJob = inngest.createFunction(
  {
    id: 'signing-reminder-scheduler',
    name: 'Signing Reminder Scheduler',
  },
  { cron: REMINDER_CRON_SCHEDULE },
  async ({ step }) => {
    const now = new Date();
    const threshold = new Date(now.getTime() - REMINDER_INTERVAL_DAYS * 24 * 60 * 60 * 1000);

    const recipientsToRemind = await step.run('find-recipients-needing-reminders', async () => {
      // Replace with actual Prisma/DB query
      return await db.documentRecipient.findMany({
        where: {
          status: 'SENT', // Or equivalent pending status
          document: {
            status: 'SENT',
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          },
          OR: [
            {
              lastReminderSentAt: null,
              document: { sentAt: { lte: threshold } },
            },
            {
              lastReminderSentAt: { lte: threshold },
            },
          ],
        },
        select: {
          id: true,
          documentId: true,
          // Select other needed fields for the event payload
        },
      });
    });

    if (recipientsToRemind.length === 0) {
      return { message: 'No reminders needed.' };
    }

    const events: SendReminderEventPayload[] = recipientsToRemind.map((recipient) => ({
      name: 'document/send.reminder',
      data: {
        recipientId: recipient.id,
        documentId: recipient.documentId,
        // Map other needed fields
      },
    }));

    await step.sendEvent('trigger-reminder-emails', events);

    return { message: `Triggered ${events.length} reminder events.` };
  },
);

// Register the function
jobProviderInstance.registerFunction(schedulerJob); // Or however functions are added

// ---
```

**b) `send-signing-reminder`**

- **ID:** `send-signing-reminder`
- **Name:** "Send Signing Reminder Email"
- **Trigger:** Event (`{ event: "document/send.reminder" }`).
- **Logic:**
  1.  Receive `recipientId`, `documentId`, etc., from the event payload.
  2.  Use `step.run` for resilience around email sending and DB updates.
  3.  Inside `step.run`:
      a. Fetch full recipient and document details needed for the email template.
      b. _Crucial Check:_ Re-verify the document/recipient status _before_ sending. Ensure the document hasn't been completed or expired _since_ the scheduler function ran. If status changed, skip sending.
      c. Construct and send the reminder email using the existing email service infrastructure.
      d. If email sending is successful, update the `DocumentRecipient.lastReminderSentAt` field in the database to `now`.

```typescript
// Example structure continued

// 2. Email Sending Function
const emailSenderJob = inngest.createFunction(
  {
    id: 'send-signing-reminder',
    name: 'Send Signing Reminder Email',
  },
  { event: 'document/send.reminder' }, // Type assertion might be needed based on SDK version/setup
  async ({ event, step }) => {
    const { recipientId, documentId } = event.data; // Add type assertion if needed
    const now = new Date();

    await step.run('send-reminder-and-update-db', async () => {
      // Replace with actual Prisma/DB query
      const recipient = await db.documentRecipient.findUnique({
        where: { id: recipientId },
        include: { document: true }, // Include document for status/expiry check
      });

      // ** Check if still valid to send **
      if (
        !recipient ||
        recipient.status !== 'SENT' ||
        recipient.document.status !== 'SENT' ||
        (recipient.document.expiresAt && recipient.document.expiresAt <= now)
      ) {
        // Log skipping reason
        console.log(
          `Skipping reminder for recipient ${recipientId}: Status changed or document expired.`,
        );
        return { skipped: true };
      }

      // Construct email content (using recipient and document details)
      const emailSubject = `Reminder: Sign Your Document - ${recipient.document.name}`;
      const emailBody = `Hello [...], this is a reminder to sign the document "${recipient.document.name}". [...]`; // Use templating engine

      // Replace with actual email sending call
      await emailService.send({
        to: recipient.email, // Assuming email is on recipient record
        subject: emailSubject,
        body: emailBody, // Or HTML template
      });

      // Update last reminder sent timestamp
      await db.documentRecipient.update({
        where: { id: recipientId },
        data: { lastReminderSentAt: now },
      });

      return { sent: true, recipientId: recipientId };
    });

    return { message: `Processed reminder for recipient ${recipientId}` };
  },
);

// Register the function
jobProviderInstance.registerFunction(emailSenderJob); // Or however functions are added
```

### 4.4. Files to Modify

- `packages/lib/jobs/client/inngest.ts`: Likely needs modification to register the new Inngest functions or call registration from another file.
- `packages/lib/db/schema.prisma` (or equivalent): Add the `lastReminderSentAt` field. Run migrations.
- Email Service Module (e.g., `packages/lib/email/...`): Potentially add a new template or function for reminder emails.
- Environment Variable Handling (`packages/lib/utils/env.ts`): Add definitions for `SIGNING_REMINDER_INTERVAL_DAYS` and `SIGNING_REMINDER_CRON_SCHEDULE`.

### 4.5. New Files/Components

- Possibly a new file dedicated to signing reminder jobs (e.g., `packages/lib/jobs/signing-reminders.ts`) to keep `inngest.ts` clean, which would then be imported and registered.
- New email template file for the reminder.

### 4.6. Configuration

- `SIGNING_REMINDER_INTERVAL_DAYS`: Environment variable (default: 3). Controls how many days must pass before a reminder is sent.
- `SIGNING_REMINDER_CRON_SCHEDULE`: Environment variable (default: `0 9 * * *`). Controls when the daily check runs (UTC).

## 5. Testing Requirements

### 5.1. Unit Testing

- Test the logic within `signing-reminder-scheduler`:
  - Correct calculation of the time threshold.
  - Correct DB query generation based on time, status, and expiry.
  - Correct filtering of recipients.
  - Correct formation and sending of `document/send.reminder` events via mocked `step.sendEvent`.
- Test the logic within `send-signing-reminder`:
  - Correct extraction of data from the event payload.
  - Correct re-verification logic (handling already completed/expired cases).
  - Correct interaction with the mocked email service.
  - Correct interaction with the mocked DB for updating `lastReminderSentAt`.
  - Mock Inngest `step.run`.

### 5.2. Integration Testing

- Set up test documents/recipients in various states (newly sent, sent long ago, reminded recently, completed, expired).
- Manually trigger the `signing-reminder-scheduler` function (e.g., via Inngest Dev Server or API call if available).
- Verify:
  - Correct `document/send.reminder` events are generated in Inngest logs/UI.
  - `send-signing-reminder` function runs for the correct events.
  - Email service receives the correct calls (using mocks or a test email inbox).
  - `lastReminderSentAt` field is updated correctly in the test database.
  - No reminders are sent for ineligible documents (completed, expired, reminded too recently).

### 5.3. Edge Cases

- Document sent, reminder interval passes, document expires _before_ scheduler runs.
- Document sent, reminder interval passes, scheduler runs, document completed _before_ email function runs.
- Multiple recipients for one document – ensure each is reminded independently based on their `lastReminderSentAt`.
- Failures during DB query or email sending (ensure Inngest retries handle this gracefully via `step.run`).
- Timezone considerations if `sentAt` or `expiresAt` are stored without timezone info (ensure consistent UTC comparisons).

## 6. Implementation Timeline (Estimate)

- **Milestone 1: Setup & Scheduler Logic (2-3 days)**
  - DB schema change and migration.
  - Environment variable setup.
  - Implement `signing-reminder-scheduler` function logic (query, event triggering).
  - Unit tests for scheduler.
- **Milestone 2: Email Sending Logic & Template (2-3 days)**
  - Implement `send-signing-reminder` function logic (re-verification, email call, DB update).
  - Create reminder email template.
  - Unit tests for email sender.
- **Milestone 3: Integration Testing & Refinement (1-2 days)**
  - End-to-end integration testing.
  - Address edge cases found during testing.
  - Code review and documentation updates.

**Total Estimated Effort:** 5-8 developer days.

## 7. Risks and Mitigations

- **Risk:** Performance impact of the scheduler query on the database.
  - **Mitigation:** Ensure appropriate database indexes are created for the query fields (`status`, `expiresAt`, `sentAt`, `lastReminderSentAt`). Monitor query performance after deployment. Consider batching queries if the volume of pending documents is extremely high.
- **Risk:** Inaccurate time calculations due to timezone issues.
  - **Mitigation:** Ensure all date comparisons and calculations consistently use UTC. Store all relevant timestamps in UTC.
- **Risk:** Sending duplicate reminders due to race conditions or retry logic.
  - **Mitigation:** The re-verification step in the `send-signing-reminder` function is critical. Ensure the `step.run` for sending/updating is idempotent or handles potential duplicate runs gracefully. The `lastReminderSentAt` update prevents immediate re-reminders.
- **Risk:** Email deliverability issues (reminders marked as spam).
  - **Mitigation:** Follow email best practices. Ensure clear "unsubscribe" or notification preference options (though out of scope for V1, consider for future). Monitor bounce/spam rates.
- **Risk:** Configuration errors (wrong cron schedule or interval).
  - **Mitigation:** Clear documentation for environment variables. Validate configuration values on startup if possible.

## 8. Backward Compatibility

- This is a net-new feature. Existing documents will start receiving reminders based on their `sentAt` date once the feature is deployed, as their initial `lastReminderSentAt` will be null. No specific data migration is strictly required, but the behavior for existing documents should be noted.
- No API changes are involved.
