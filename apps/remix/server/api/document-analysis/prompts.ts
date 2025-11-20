export const DETECT_OBJECTS_PROMPT = `You are analyzing a form document image to detect fillable fields for the Documenso document signing platform.

IMPORTANT RULES:
1. Only detect EMPTY/UNFILLED fields (ignore boxes that already contain text or data)
2. Analyze nearby text labels to determine the field type
3. Return bounding boxes for the fillable area only, NOT the label text
4. Each boundingBox must be in the format {ymin, xmin, ymax, xmax} where all coordinates are NORMALIZED to a 0-1000 scale

CRITICAL: UNDERSTANDING FILLABLE AREAS
The "fillable area" is ONLY the empty space where a user will write, type, sign, or check.
- ✓ CORRECT: The blank underscore where someone writes their name: "Name: _________" → box ONLY the underscores
- ✓ CORRECT: The empty white rectangle inside a box outline → box ONLY the empty space, not any printed text
- ✓ CORRECT: The blank space to the right of a label: "Email: [ empty box ]" → box ONLY the empty box, exclude "Email:"
- ✗ INCORRECT: Including the word "Signature:" that appears to the left of a signature line
- ✗ INCORRECT: Including printed labels, instructions, or descriptive text near the field
- ✗ INCORRECT: Extending the box to include text just because it's close to the fillable area

VISUALIZING THE DISTINCTION:
- If there's text (printed words/labels) near an empty box or line, they are SEPARATE elements
- The text is a LABEL telling the user what to fill
- The empty space is the FILLABLE AREA where they actually write/sign
- Your bounding box should capture ONLY the empty space, even if the label is immediately adjacent

FIELD TYPES TO DETECT:
• SIGNATURE - Signature lines, boxes labeled 'Signature', 'Sign here', 'Authorized signature', 'X____'
• INITIALS - Small boxes labeled 'Initials', 'Initial here', typically smaller than signature fields
• NAME - Boxes labeled 'Name', 'Full name', 'Your name', 'Print name', 'Printed name'
• EMAIL - Boxes labeled 'Email', 'Email address', 'E-mail', 'Email:'
• DATE - Boxes labeled 'Date', 'Date signed', "Today's date", or showing date format placeholders like 'MM/DD/YYYY', '__/__/____'
• CHECKBOX - Empty checkbox squares (☐) with or without labels, typically small square boxes
• RADIO - Empty radio button circles (○) in groups, typically circular selection options
• NUMBER - Boxes labeled with numeric context: 'Amount', 'Quantity', 'Phone', 'Phone number', 'ZIP', 'ZIP code', 'Age', 'Price', '#'
• DROPDOWN - Boxes with dropdown indicators (▼, ↓) or labeled 'Select', 'Choose', 'Please select'
• TEXT - Any other empty text input boxes, general input fields, unlabeled boxes, or when field type is uncertain

DETECTION GUIDELINES:
- Read text located near the box (above, to the left, or inside the box boundary) to infer the field type
- IMPORTANT: Use the nearby text to CLASSIFY the field type, but DO NOT include that text in the bounding box
- If you're uncertain which type fits best, default to TEXT
- For checkboxes and radio buttons: Detect each individual box/circle separately, not the label
- Signature fields are often longer horizontal lines or larger boxes
- Date fields often show format hints or date separators (slashes, dashes)
- Look for visual patterns: underscores (____), horizontal lines, box outlines

BOUNDING BOX PLACEMENT (CRITICAL):
- Your coordinates must capture ONLY the empty fillable space (the blank area where input goes)
- Once you find the fillable region, LOCK the box to the full boundary of that region (top, bottom, left, right). Do not leave the box floating over just the starting edge.
- If the field is defined by a line or a rectangular border, extend xmin/xmax/ymin/ymax across the entire line/border so the box spans the whole writable area end-to-end.
- EXCLUDE all printed text labels, even if they are:
  · Directly to the left of the field (e.g., "Name: _____")
  · Directly above the field (e.g., "Signature" printed above a line)
  · Very close to the field with minimal spacing
  · Inside the same outlined box as the fillable area
- The label text helps you IDENTIFY the field type, but must be EXCLUDED from the bounding box
- If you detect a label "Email:" followed by a blank box, draw the box around ONLY the blank box, not the word "Email:"
- The box should never cover only the leftmost few characters of a long field. For "Signature: ____________", the box must stretch from the first underscore to the last.

COORDINATE SYSTEM:
- {ymin, xmin, ymax, xmax} normalized to 0-1000 scale
- Top-left corner: ymin and xmin close to 0
- Bottom-right corner: ymax and xmax close to 1000
- Coordinates represent positions on a 1000x1000 grid overlaid on the image

FIELD SIZING STRATEGY FOR LINE-BASED FIELDS:
When detecting thin horizontal lines for SIGNATURE, INITIALS, NAME, EMAIL, DATE, TEXT, or NUMBER fields:
1. Analyze the visual context around the detected line:
   - Look at the empty space ABOVE the detected line
   - Observe the spacing to any text labels, headers, or other form elements above
   - Assess what would be a reasonable field height to make the field clearly visible when filled
2. Expand UPWARD from the detected line to create a usable field:
   - Keep ymax (bottom) at the detected line position (the line becomes the bottom edge)
   - Extend ymin (top) upward into the available whitespace
   - Aim to use 60-80% of the clear whitespace above the line, while being reasonable
   - The expanded field should provide comfortable space for signing/writing (minimum 30 units tall)
3. Apply minimum dimensions: height at least 30 units (3% of 1000-scale), width at least 36 units
4. Ensure ymin >= 0 (do not go off-page). If ymin would be negative, clamp to 0
5. Do NOT apply this expansion to CHECKBOX, RADIO, or DROPDOWN fields - use detected dimensions for those
6. Example: If you detect a signature line at ymax=500 with clear whitespace extending up to y=400:
   - Available whitespace: 100 units
   - Use 60-80% of that: 60-80 units
   - Expanded field: {ymin: 420, xmin: 200, ymax: 500, xmax: 600} (creates 80-unit tall field)
   - This gives comfortable signing space while respecting the form layout`;

export const ANALYZE_RECIPIENTS_PROMPT = `You are analyzing a document to identify recipients who need to sign, approve, or receive copies.

TASK: Extract recipient information from this document.

RECIPIENT TYPES:
- SIGNER: People who must sign the document (look for signature lines, "Signed by:", "Signature:", "X____")
- APPROVER: People who must review/approve before signing (look for "Approved by:", "Reviewed by:", "Approval:")
- CC: People who receive a copy for information only (look for "CC:", "Copy to:", "For information:")

EXTRACTION RULES:
1. Look for signature lines with names printed above, below, or near them
2. Check for explicit labels like "Name:", "Signer:", "Party:", "Recipient:"
3. Look for "Approved by:", "Reviewed by:", "CC:" sections
4. Extract FULL NAMES as they appear in the document
5. If an email address is visible near a name, include it exactly in the "email" field
6. If NO email is found, leave the email field empty.
7. Assign signing order based on document flow (numbered items, "First signer:", "Second signer:", or top-to-bottom sequence)

IMPORTANT:
- Only extract recipients explicitly mentioned in the document
- Default role is SIGNER if unclear (signature lines = SIGNER)
- Signing order starts at 1 (first signer = 1, second = 2, etc.)
- If no clear ordering, omit signingOrder
- Return empty array if absolutely no recipients can be detected
- Do NOT invent recipients - only extract what's clearly present
- If a signature line exists but no name is associated with it, DO NOT return a recipient with name "<UNKNOWN>". Skip it.

EXAMPLES:
Good:
  - "Signed: _________ John Doe" → { name: "John Doe", role: "SIGNER", signingOrder: 1 }
  - "Approved by: Jane Smith (jane@example.com)" → { name: "Jane Smith", email: "jane@example.com", role: "APPROVER" }
  - "CC: Legal Team" → { name: "Legal Team", role: "CC" }

Bad:
  - Extracting the document title as a recipient name
  - Making up email addresses that aren't in the document
  - Adding people not mentioned in the document
  - Using placeholder names like "<UNKNOWN>", "Unknown", "Signer"`;
