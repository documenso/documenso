"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _pdfobject = _interopRequireDefault(require("../pdfkit/pdfobject"));

var _pdfkitReferenceMock = _interopRequireDefault(require("../pdfkitReferenceMock"));

var _removeTrailingNewLine = _interopRequireDefault(require("../removeTrailingNewLine"));

var _const = require("../const");

var _pdfkitAddPlaceholder = _interopRequireDefault(require("../pdfkitAddPlaceholder"));

var _getIndexFromRef = _interopRequireDefault(require("./getIndexFromRef"));

var _readPdf = _interopRequireDefault(require("./readPdf"));

var _getPageRef = _interopRequireDefault(require("./getPageRef"));

var _createBufferRootWithAcroform = _interopRequireDefault(require("./createBufferRootWithAcroform"));

var _createBufferPageWithAnnotation = _interopRequireDefault(require("./createBufferPageWithAnnotation"));

var _createBufferTrailer = _interopRequireDefault(require("./createBufferTrailer"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const isContainBufferRootWithAcroform = pdf => {
  const bufferRootWithAcroformRefRegex = /\/AcroForm\s+(\d+\s\d+\sR)/g;
  const match = bufferRootWithAcroformRefRegex.exec(pdf.toString());
  return match != null && match[1] != null && match[1] !== '';
};
/**
 * Adds a signature placeholder to a PDF Buffer.
 *
 * This contrasts with the default pdfkit-based implementation.
 * Parsing is done using simple string operations.
 * Adding is done with `Buffer.concat`.
 * This allows node-signpdf to be used on any PDF and
 * not only on a freshly created through PDFKit one.
 */


const plainAddPlaceholder = ({
  pdfBuffer,
  reason,
  contactInfo = 'emailfromp1289@gmail.com',
  name = 'Name from p12',
  location = 'Location from p12',
  signatureLength = _const.DEFAULT_SIGNATURE_LENGTH,
  subFilter = _const.SUBFILTER_ADOBE_PKCS7_DETACHED
}) => {
  let pdf = (0, _removeTrailingNewLine.default)(pdfBuffer);
  const info = (0, _readPdf.default)(pdf);
  const pageRef = (0, _getPageRef.default)(pdf, info);
  const pageIndex = (0, _getIndexFromRef.default)(info.xref, pageRef);
  const addedReferences = new Map();
  const pdfKitMock = {
    ref: (input, additionalIndex) => {
      info.xref.maxIndex += 1;
      const index = additionalIndex != null ? additionalIndex : info.xref.maxIndex;
      addedReferences.set(index, pdf.length + 1); // + 1 new line

      pdf = Buffer.concat([pdf, Buffer.from('\n'), Buffer.from(`${index} 0 obj\n`), Buffer.from(_pdfobject.default.convert(input)), Buffer.from('\nendobj\n')]);
      return new _pdfkitReferenceMock.default(info.xref.maxIndex);
    },
    page: {
      dictionary: new _pdfkitReferenceMock.default(pageIndex, {
        data: {
          Annots: []
        }
      })
    },
    _root: {
      data: {}
    }
  };
  const {
    form,
    widget
  } = (0, _pdfkitAddPlaceholder.default)({
    pdf: pdfKitMock,
    pdfBuffer,
    reason,
    contactInfo,
    name,
    location,
    signatureLength,
    subFilter
  });

  if (!isContainBufferRootWithAcroform(pdf)) {
    const rootIndex = (0, _getIndexFromRef.default)(info.xref, info.rootRef);
    addedReferences.set(rootIndex, pdf.length + 1);
    pdf = Buffer.concat([pdf, Buffer.from('\n'), (0, _createBufferRootWithAcroform.default)(pdf, info, form)]);
  }

  addedReferences.set(pageIndex, pdf.length + 1);
  pdf = Buffer.concat([pdf, Buffer.from('\n'), (0, _createBufferPageWithAnnotation.default)(pdf, info, pageRef, widget)]);
  pdf = Buffer.concat([pdf, Buffer.from('\n'), (0, _createBufferTrailer.default)(pdf, info, addedReferences)]);
  return pdf;
};

var _default = plainAddPlaceholder;
exports.default = _default;