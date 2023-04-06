import { FieldType } from "@prisma/client";

export const createField = (
  e: any,
  page: number,
  selectedRecipient: any,
  type: FieldType = FieldType.SIGNATURE,
  customText = ""
): any => {
  var rect = e.target.getBoundingClientRect();
  const fieldSize = { width: 192, height: 64 };
  var newFieldX = e.clientX - rect.left - fieldSize.width / 2; //x position within the element.
  var newFieldY = e.clientY - rect.top - fieldSize.height / 2; //y position within the element.
  if (newFieldX < 0) newFieldX = 0;
  if (newFieldY < 0) newFieldY = 0;

  if (newFieldX + fieldSize.width > rect.width) newFieldX = rect.width - fieldSize.width;
  if (newFieldY + fieldSize.height > rect.height) newFieldY = rect.height - fieldSize.height;

  const signatureField = {
    id: -1,
    page: page,
    type: type,
    positionX: newFieldX.toFixed(0),
    positionY: newFieldY.toFixed(0),
    Recipient: selectedRecipient,
    customText: customText,
  };

  return signatureField;
};
