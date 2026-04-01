-- CreateIndex
CREATE INDEX "Envelope_type_idx" ON "Envelope"("type");

-- CreateIndex
CREATE INDEX "Envelope_status_idx" ON "Envelope"("status");

-- CreateIndex
CREATE INDEX "Envelope_createdAt_idx" ON "Envelope"("createdAt");

-- CreateIndex
CREATE INDEX "Organisation_name_idx" ON "Organisation"("name");

-- CreateIndex
CREATE INDEX "Organisation_ownerUserId_idx" ON "Organisation"("ownerUserId");

-- CreateIndex
CREATE INDEX "OrganisationMember_organisationId_idx" ON "OrganisationMember"("organisationId");

-- CreateIndex
CREATE INDEX "Recipient_email_idx" ON "Recipient"("email");

-- CreateIndex
CREATE INDEX "Recipient_signedAt_idx" ON "Recipient"("signedAt");

-- CreateIndex
CREATE INDEX "Team_name_idx" ON "Team"("name");
