# New Features in `feature/raw-features-clean`

This document details the new features implemented in the `feature/raw-features-clean` branch, intended for independent pull requests.

## 1. Image Upload Field (`IMAGE_UPLOAD`)
- **Description**: Allows users to upload an image as a signature/seal field.
- **Key Components**:
  - Prisma: Added `IMAGE_UPLOAD` to `FieldType` enum.
  - Validation: Added `ZImageUploadFieldMeta` schema.
  - UI: New `ImageUploadField` component and `SignFieldImageUploadDialog`.
  - Rendering: New `renderImageUploadFieldElement` for Konva canvas.
  - PDF: Updated `insertFieldInPDFV1` and `legacy_insertFieldInPDF` to support image upload fields.
  - Signing: Updated `sign-field-with-token.ts` and `sign-envelope-field.ts` to handle image upload data.

## 2. Custom Text Support
- **Description**: Allows fields to have custom text content.
- **Key Components**:
  - Server: Added `customText` field to `FieldData` and updated `setFieldsForDocument`/`setFieldsForTemplate` to persist this data.
  - TRPC: Updated `ZSetEnvelopeFieldsRequestSchema` to accept `customText`.
  - Logic: Updated `hasFieldBeenChanged` to include `customText` in change detection.

## 3. Keyboard Deletion
- **Description**: Enables deleting selected fields using the 'Delete' or 'Backspace' keys.
- **Key Components**:
  - Logic: Added `handleDeleteKeyDown` event listener in `EnvelopeEditorFieldsPageRenderer` to trigger `deletedSelectedFields`.
  - Utility: Added `isEditableKeyboardTarget` to prevent deletion when typing in input fields.

## 4. Field Alignment and Custom Labels
- **Description**: Allows changing the alignment (left, center, right) of fields and setting custom labels.
- **Key Components**:
  - UI: Added `EditorGenericLabelField` and `EditorGenericTextAlignField` to various editor forms (Date, Email, Initials, Name, Signature, Image Upload).
  - Rendering: Updated `renderGenericTextFieldElement` and `renderSignatureFieldElement` to respect `textAlign` and `label` meta properties.
  - PDF: Updated PDF insertion logic to render labels with correct alignment.
