-- CreateIndex
CREATE INDEX "Document_userId_idx" ON "Document"("userId");

-- CreateIndex
CREATE INDEX "Document_status_idx" ON "Document"("status");

-- CreateIndex
CREATE INDEX "Field_documentId_idx" ON "Field"("documentId");

-- CreateIndex
CREATE INDEX "Field_recipientId_idx" ON "Field"("recipientId");

-- CreateIndex
CREATE INDEX "Recipient_documentId_idx" ON "Recipient"("documentId");

-- CreateIndex
CREATE INDEX "Recipient_token_idx" ON "Recipient"("token");

-- CreateIndex
CREATE INDEX "Signature_recipientId_idx" ON "Signature"("recipientId");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");
