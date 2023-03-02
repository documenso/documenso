"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _const = require("./const");

var _pdfkitReferenceMock = _interopRequireDefault(require("./pdfkitReferenceMock"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// eslint-disable-next-line import/no-unresolved

/**
 * Adds the objects that are needed for Adobe.PPKLite to read the signature.
 * Also includes a placeholder for the actual signature.
 * Returns an Object with all the added PDFReferences.
 * @param {PDFDocument} pdf
 * @param {string} reason
 * @returns {object}
 */
const pdfkitAddPlaceholder = ({
  pdf,
  pdfBuffer,
  reason,
  contactInfo = 'emailfromp1289@gmail.com',
  name = 'Name from p12',
  location = 'Location from p12',
  signatureLength = _const.DEFAULT_SIGNATURE_LENGTH,
  byteRangePlaceholder = _const.DEFAULT_BYTE_RANGE_PLACEHOLDER,
  subFilter = _const.SUBFILTER_ADOBE_PKCS7_DETACHED
}) => {
  /* eslint-disable no-underscore-dangle,no-param-reassign */
  // Generate the signature placeholder
  const signature = pdf.ref({
    Type: 'Sig',
    Filter: 'Adobe.PPKLite',
    SubFilter: subFilter,
    ByteRange: [0, byteRangePlaceholder, byteRangePlaceholder, byteRangePlaceholder],
    Contents: Buffer.from(String.fromCharCode(0).repeat(signatureLength)),
    Reason: new String(reason),
    // eslint-disable-line no-new-wrappers
    M: new Date(),
    ContactInfo: new String(contactInfo),
    // eslint-disable-line no-new-wrappers
    Name: new String(name),
    // eslint-disable-line no-new-wrappers
    Location: new String(location) // eslint-disable-line no-new-wrappers

  }); // Check if pdf already contains acroform field

  const acroFormPosition = pdfBuffer.lastIndexOf('/Type /AcroForm');
  const isAcroFormExists = acroFormPosition !== -1;
  let fieldIds = [];
  let acroFormId;

  if (isAcroFormExists) {
    let acroFormStart = acroFormPosition; // 10 is the distance between "/Type /AcroForm" and AcroFrom ID

    const charsUntilIdEnd = 10;
    const acroFormIdEnd = acroFormPosition - charsUntilIdEnd; // Let's find AcroForm ID by trying to find the "\n" before the ID
    // 12 is a enough space to find the "\n"
    // (generally it's 2 or 3, but I'm giving a big space though)

    const maxAcroFormIdLength = 12;
    let foundAcroFormId = '';
    let index = charsUntilIdEnd + 1;

    for (index; index < charsUntilIdEnd + maxAcroFormIdLength; index += 1) {
      const acroFormIdString = pdfBuffer.slice(acroFormPosition - index, acroFormIdEnd).toString();

      if (acroFormIdString[0] === '\n') {
        break;
      }

      foundAcroFormId = acroFormIdString;
      acroFormStart = acroFormPosition - index;
    }

    const pdfSlice = pdfBuffer.slice(acroFormStart);
    const acroForm = pdfSlice.slice(0, pdfSlice.indexOf('endobj')).toString();
    acroFormId = parseInt(foundAcroFormId);
    const acroFormFields = acroForm.slice(acroForm.indexOf('/Fields [') + 9, acroForm.indexOf(']'));
    fieldIds = acroFormFields.split(' ').filter((element, i) => i % 3 === 0).map(fieldId => new _pdfkitReferenceMock.default(fieldId));
  }

  const signatureName = 'Signature'; // Generate signature annotation widget

  const widget = pdf.ref({
    Type: 'Annot',
    Subtype: 'Widget',
    FT: 'Sig',
    Rect: [0, 0, 0, 0],
    V: signature,
    T: new String(signatureName + (fieldIds.length + 1)),
    // eslint-disable-line no-new-wrappers
    F: 4,
    P: pdf.page.dictionary // eslint-disable-line no-underscore-dangle

  });
  pdf.page.dictionary.data.Annots = [widget]; // Include the widget in a page

  let form;

  if (!isAcroFormExists) {
    // Create a form (with the widget) and link in the _root
    form = pdf.ref({
      Type: 'AcroForm',
      SigFlags: 3,
      Fields: [...fieldIds, widget]
    });
  } else {
    // Use existing acroform and extend the fields with newly created widgets
    form = pdf.ref({
      Type: 'AcroForm',
      SigFlags: 3,
      Fields: [...fieldIds, widget]
    }, acroFormId);
  }

  pdf._root.data.AcroForm = form;
  return {
    signature,
    form,
    widget
  };
  /* eslint-enable no-underscore-dangle,no-param-reassign */
};

var _default = pdfkitAddPlaceholder;
exports.default = _default;