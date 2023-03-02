"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _findObject = _interopRequireDefault(require("./findObject"));

var _getIndexFromRef = _interopRequireDefault(require("./getIndexFromRef"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const createBufferPageWithAnnotation = (pdf, info, pagesRef, widget) => {
  const pagesDictionary = (0, _findObject.default)(pdf, info.xref, pagesRef).toString(); // Extend page dictionary with newly created annotations

  let annotsStart;
  let annotsEnd;
  let annots;
  annotsStart = pagesDictionary.indexOf('/Annots');

  if (annotsStart > -1) {
    annotsEnd = pagesDictionary.indexOf(']', annotsStart);
    annots = pagesDictionary.substr(annotsStart, annotsEnd + 1 - annotsStart);
    annots = annots.substr(0, annots.length - 1); // remove the trailing ]
  } else {
    annotsStart = pagesDictionary.length;
    annotsEnd = pagesDictionary.length;
    annots = '/Annots [';
  }

  const pagesDictionaryIndex = (0, _getIndexFromRef.default)(info.xref, pagesRef);
  const widgetValue = widget.toString();
  annots = `${annots} ${widgetValue}]`; // add the trailing ] back

  const preAnnots = pagesDictionary.substr(0, annotsStart);
  let postAnnots = '';

  if (pagesDictionary.length > annotsEnd) {
    postAnnots = pagesDictionary.substr(annotsEnd + 1);
  }

  return Buffer.concat([Buffer.from(`${pagesDictionaryIndex} 0 obj\n`), Buffer.from('<<\n'), Buffer.from(`${preAnnots + annots + postAnnots}\n`), Buffer.from('\n>>\nendobj\n')]);
};

var _default = createBufferPageWithAnnotation;
exports.default = _default;