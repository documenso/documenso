# SuiteOp White-Label Changes

This document outlines all the white-labeling changes made to transform Documenso into SuiteOp.

## Summary of Changes

The white-labeling was implemented by modifying core source files rather than using runtime HTML/CSS overrides. This approach ensures maximum performance and prevents hydration issues while minimizing the number of changes needed.

**Total Files Modified:** 48+  
**Key Changes:** Colors (green → purple), Logos (SVG), Text ("Documenso" → "SuiteOp Sign"), User Profile, Email templates, Meta tags

## 1. CSS Variables & Theme Colors

### Core CSS Variables
**File: `packages/ui/styles/theme.css`**

Changed primary color from green to purple in **both light and dark modes**:
- Primary color: `95.08 71.08% 67.45%` → `248 99% 70%` (purple)
- Ring, accent, and secondary colors updated
- Field-card colors updated to purple palette
- Primary color scale: `--new-primary-50` through `--new-primary-950` now use purple hue (248)
- Comment changed from "Primary - Green" to "Primary - Purple"

### Tailwind Color Palette
**File: `packages/tailwind-config/index.cjs`**

Updated the entire `documenso` Tailwind color palette from green to purple:

```javascript
documenso: {
  DEFAULT: '#8585FF',  // was '#A2E771'
  50: '#F5F5FF',       // was '#FFFFFF'
  100: '#EBEBFF',      // was '#FDFFFD'
  200: '#D6D6FF',      // was '#E7F9DA'
  300: '#C2C2FF',      // was '#D0F3B7'
  400: '#ADADFF',      // was '#B9ED94'
  500: '#8585FF',      // was '#A2E771'
  600: '#5C5CFF',      // was '#83DF41'
  700: '#3636A1',      // was '#66C622'
  800: '#2A2A7A',      // was '#4D9619'
  900: '#1F1F5C',      // was '#356611'
  950: '#14143D',      // was '#284E0D'
}
```

This updates **ALL** instances of `text-documenso-*`, `bg-documenso-*`, `border-documenso-*`, and `hover:*-documenso-*` classes throughout the application.

## 2. Logo & Branding Assets

### Main Logo Component
**File: `apps/remix/app/components/general/branding-logo.tsx`**

- Replaced entire Documenso logo SVG with SuiteOp logo
- Changed viewBox from `0 0 2248 320` to `0 0 151 36`
- New logo features clean "SuiteOp" text design

### Mobile Navigation Logo
**File: `apps/remix/app/components/general/app-nav-mobile.tsx`**

- Replaced PNG logo import with `BrandingLogo` component
- Removed `LogoImage` import from `@documenso/assets/logo.png`
- Updated to use consistent SVG branding logo

## 3. Email Templates Branding

### Email Footer
**File: `packages/email/template-components/template-footer.tsx`**

Changes:
- "Powered by" link color: `#7AC455` → `#3636A1` (purple)
- Link URL: `https://documen.so/mail-footer` → `https://suiteop.com`
- Link text: "Documenso." → "SuiteOp."
- Default company name: "Documenso, Inc." → "SuiteOp, Inc."
- Default address changed to: "Professional Document Signing Platform"

### Hardcoded Color Updates
Updated all hardcoded green hex colors (`#7AC455`) to purple (`#8585FF`) in:

**Email Templates - "Completed" Badge:**
- `packages/email/template-components/template-document-self-signed.tsx`
- `packages/email/template-components/template-document-recipient-signed.tsx`
- `packages/email/template-components/template-document-completed.tsx`

**App Routes & Components - Breadcrumb Links:**
- `apps/remix/app/routes/_authenticated+/t.$teamUrl+/templates.$id._index.tsx`
- `apps/remix/app/routes/_authenticated+/t.$teamUrl+/documents.$id._index.tsx`
- `apps/remix/app/routes/_authenticated+/t.$teamUrl+/templates.$id.legacy_editor.tsx`
- `apps/remix/app/routes/_authenticated+/t.$teamUrl+/documents.$id.logs.tsx`
- `apps/remix/app/routes/_authenticated+/t.$teamUrl+/documents.$id.legacy_editor.tsx`
- `apps/remix/app/components/general/skeletons/document-edit-skeleton.tsx`

### URL Updates
Changed external links from Documenso to SuiteOp:
- `packages/email/template-components/template-document-self-signed.tsx`: `https://documenso.com/pricing` → `https://suiteop.com/pricing`

### Email Template Alt Text
Updated all email templates to use "SuiteOp Logo" instead of "Documenso Logo":

- `packages/email/templates/confirm-email.tsx`
- `packages/email/templates/document-completed.tsx`
- `packages/email/templates/document-self-signed.tsx`
- `packages/email/templates/document-recipient-signed.tsx`
- `packages/email/templates/document-invite.tsx`
- `packages/email/templates/document-pending.tsx`
- `packages/email/templates/forgot-password.tsx`
- `packages/email/templates/reset-password.tsx`
- `packages/email/templates/access-auth-2fa.tsx`
- `packages/email/templates/document-cancel.tsx`
- `packages/email/templates/document-created-from-direct-template.tsx`
- `packages/email/templates/document-rejected.tsx`
- `packages/email/templates/document-rejection-confirmed.tsx`
- `packages/email/templates/document-super-delete.tsx`
- `packages/email/templates/recipient-removed-from-document.tsx`

## 4. Text & Metadata Updates

### Page Titles & SEO Meta Tags
**File: `apps/remix/app/utils/meta.ts`**

Comprehensive SEO and branding update:
- Page title: `${title} - Documenso` → `${title} - SuiteOp Sign`
- Default title: "Documenso" → "SuiteOp Sign"
- Meta description: Updated to "SuiteOp Sign - Professional document signing platform..."
- Meta keywords: Changed from Documenso-focused to SuiteOp Sign keywords
- Author: "Documenso, Inc." → "SuiteOp, Inc."
- OG title: "Documenso - The Open Source DocuSign Alternative" → "SuiteOp Sign - Professional Document Signing Platform"
- Twitter handle: "@documenso" → "@suiteop"

### Web App Manifest
**File: `apps/remix/public/site.webmanifest`**

PWA configuration updated:
- App name: "Documenso" → "SuiteOp Sign"
- Short name: "Documenso" → "SuiteOp Sign"
- Theme color: "#A2E771" (green) → "#8585FF" (purple)

### App Navigation
**File: `apps/remix/app/components/general/app-nav-mobile.tsx`**

- Footer copyright: "© YYYY Documenso, Inc." → "© YYYY SuiteOp, Inc."

### User-Facing Display Text
Updated dropdown menus and fallback text:
- **File: `apps/remix/app/components/general/envelope-editor/envelope-editor-settings-dialog.tsx`**
  - Email sender dropdown: "Documenso" → "SuiteOp Sign"
- **File: `apps/remix/app/components/dialogs/envelope-distribute-dialog.tsx`**
  - Email sender dropdown: "Documenso" → "SuiteOp Sign"
- **File: `apps/remix/app/components/embed/embed-document-completed.tsx`**
  - Fallback signer name: "Documenso" → "SuiteOp Sign"

### Documentation Theme
**File: `apps/documentation/theme.config.tsx`**

Changes:
- Logo text: "Documenso" → "SuiteOp"
- Page title: "Documenso Docs" → "SuiteOp Docs"
- Description: "The official Documenso documentation" → "The official SuiteOp documentation"
- Footer link: `https://documen.so` → `https://suiteop.com`
- Footer text: "Documenso" → "SuiteOp"
- Title template: "%s | Documenso Docs" → "%s | SuiteOp Docs"
- Primary hue: `100` → `248` (purple)
- Primary saturation: `48.47` → `99`

## 5. Color Palette Reference

### SuiteOp Purple Theme

**Primary Purple:**
- HSL: `248 99% 70%`
- Hex: `#3636A1` (used in links/accents)

**Color Scale:**
```
--new-primary-50:  248, 100%, 97%  (lightest)
--new-primary-100: 248, 100%, 95%
--new-primary-200: 248, 100%, 90%
--new-primary-300: 248, 100%, 85%
--new-primary-400: 248, 100%, 80%
--new-primary-500: 248, 99%, 70%   (base)
--new-primary-600: 248, 70%, 60%
--new-primary-700: 248, 60%, 50%
--new-primary-800: 248, 50%, 40%
--new-primary-900: 248, 45%, 30%
--new-primary-950: 248, 40%, 20%   (darkest)
```

## Design Philosophy

The white-labeling approach follows these principles:

1. **Minimal Changes, Maximum Impact**: Modified only the core variables and components that propagate throughout the entire application
2. **Source-Level Changes**: All modifications are in the source code, not runtime transforms
3. **Consistency**: Single source of truth for colors, logos, and branding
4. **Performance**: No runtime overhead for transformations
5. **Maintainability**: Clear, documented changes that are easy to understand and update

## Files NOT Modified

The following remain untouched as they inherit from the changed variables:
- Individual component styles (they use CSS variables)
- Most TypeScript/JSX files (they use the BrandingLogo component)
- Tailwind configuration (it reads CSS variables)

## Testing Recommendations

After applying these changes, test:
1. ✅ Homepage and all main navigation pages display SuiteOp logo
2. ✅ Primary color appears as purple throughout the UI
3. ✅ Email templates show correct branding and colors
4. ✅ Mobile navigation displays correct logo and footer
5. ✅ Documentation site shows SuiteOp branding
6. ⚠️ No hydration warnings in browser console
7. ⚠️ Dark mode still functions correctly

## Reverting Changes

To revert to Documenso branding:
1. Restore `packages/ui/styles/theme.css` (green color palette)
2. Restore `apps/remix/app/components/general/branding-logo.tsx` (Documenso logo SVG)
3. Restore email footer and template changes
4. Restore text/metadata references

Or simply use git to revert the white-labeling commit.

## 8. User Profile on Login/Signup Page

### User Profile Component
**File: `apps/remix/app/components/general/user-profile-timur.tsx`**

Updated the demo user profile shown on signup/login pages:

**Before:**
- Name: "Timur Ercan"
- URL: `/u/timur`
- Greeting: "Hey I'm Timur"
- Image: `packages/assets/images/timur.png`

**After:**
- Name: "Jean-Emmanuel Losi"
- URL: `/u/jean`
- Greeting: "Hey I'm Jean-Emmanuel"
- Image: Still uses `timur.png` (needs manual replacement with your photo)

**To Replace Photo:**
Replace the file at `packages/assets/images/timur.png` with your own professional photo (recommended: 200x200px, PNG format, circular cropping looks best).

---

## Additional Notes

- The original Documenso green was HSL `95.08 71.08% 67.45%` / Hex `#7AC455`
- The new SuiteOp purple is HSL `248 99% 70%` / Hex `#8585FF` (lighter) or `#3636A1` (darker)
- All logo PNGs remain in place for backward compatibility but are not used in the main app
- Email static logo at `packages/email/static/logo.png` should be replaced with SuiteOp logo for production use
- User profile image at `packages/assets/images/timur.png` should be replaced with Jean-Emmanuel's photo

