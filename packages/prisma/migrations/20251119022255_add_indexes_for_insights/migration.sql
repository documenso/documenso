-- CreateIndex
CREATE INDEX "Envelope_teamId_deletedAt_type_status_idx" ON "Envelope"("teamId", "deletedAt", "type", "status");

-- CreateIndex
CREATE INDEX "Envelope_teamId_deletedAt_type_createdAt_idx" ON "Envelope"("teamId", "deletedAt", "type", "createdAt");

-- CreateIndex
CREATE INDEX "Envelope_userId_deletedAt_type_idx" ON "Envelope"("userId", "deletedAt", "type");

-- CreateIndex
CREATE INDEX "Envelope_status_deletedAt_type_idx" ON "Envelope"("status", "deletedAt", "type");

-- CreateIndex
CREATE INDEX "Organisation_name_idx" ON "Organisation"("name");

-- CreateIndex
CREATE INDEX "OrganisationMember_organisationId_idx" ON "OrganisationMember"("organisationId");

-- CreateIndex
CREATE INDEX "Recipient_email_idx" ON "Recipient"("email");

-- CreateIndex
CREATE INDEX "Recipient_signedAt_idx" ON "Recipient"("signedAt");

-- CreateIndex
CREATE INDEX "Recipient_envelopeId_signedAt_idx" ON "Recipient"("envelopeId", "signedAt");

-- CreateIndex
CREATE INDEX "Team_organisationId_name_idx" ON "Team"("organisationId", "name");
