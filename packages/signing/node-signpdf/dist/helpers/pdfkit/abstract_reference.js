"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

/*
PDFAbstractReference by Devon Govett used below.
The class is part of pdfkit. See https://github.com/foliojs/pdfkit
LICENSE: MIT. Included in this folder.
Modifications may have been applied for the purposes of node-signpdf.
*/

/*
PDFAbstractReference - abstract class for PDF reference
*/
class PDFAbstractReference {
  toString() {
    throw new Error('Must be implemented by subclasses');
  }

}

var _default = PDFAbstractReference;
exports.default = _default;