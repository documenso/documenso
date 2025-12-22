-- CreateIndex
CREATE INDEX "Envelope_folderId_idx" ON "Envelope"("folderId");

-- CreateIndex
CREATE INDEX "Envelope_teamId_idx" ON "Envelope"("teamId");

-- CreateIndex
CREATE INDEX "Envelope_userId_idx" ON "Envelope"("userId");

-- CreateIndex
CREATE INDEX "EnvelopeAttachment_envelopeId_idx" ON "EnvelopeAttachment"("envelopeId");

-- CreateIndex
CREATE INDEX "EnvelopeItem_envelopeId_idx" ON "EnvelopeItem"("envelopeId");

-- CreateIndex
CREATE INDEX "Field_envelopeItemId_idx" ON "Field"("envelopeItemId");

-- CreateIndex
CREATE INDEX "OrganisationGroup_organisationId_idx" ON "OrganisationGroup"("organisationId");

-- CreateIndex
CREATE INDEX "OrganisationGroupMember_groupId_idx" ON "OrganisationGroupMember"("groupId");

-- CreateIndex
CREATE INDEX "OrganisationGroupMember_organisationMemberId_idx" ON "OrganisationGroupMember"("organisationMemberId");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_sessionToken_idx" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Team_organisationId_idx" ON "Team"("organisationId");

-- CreateIndex
CREATE INDEX "TeamGroup_teamId_idx" ON "TeamGroup"("teamId");

-- CreateIndex
CREATE INDEX "TeamGroup_organisationGroupId_idx" ON "TeamGroup"("organisationGroupId");
