import Konva from 'konva';

const SNAP_THRESHOLD = 10;

type SnapPoint = {
  position: number;
  type: 'edge' | 'center';
  direction: 'horizontal' | 'vertical';
};

type SnapResult = {
  x: number;
  y: number;
  horizontalGuide?: number;
  verticalGuide?: number;
};

type ResizeSnapResult = {
  x: number;
  y: number;
  width: number;
  height: number;
  horizontalGuides: number[];
  verticalGuides: number[];
};

export function initializeSnapGuides(stage: Konva.Stage): Konva.Layer {
  // Remove any existing snap guide layers from this stage
  const existingSnapLayers = stage.find('.snap-guide-layer');
  existingSnapLayers.forEach((layer) => layer.destroy());

  const snapGuideLayer = new Konva.Layer({
    name: 'snap-guide-layer',
  });
  stage.add(snapGuideLayer);
  return snapGuideLayer;
}

export function calculateSnapPositions(
  stage: Konva.Stage,
  excludeId?: string,
): { horizontal: SnapPoint[]; vertical: SnapPoint[] } {
  const fieldGroups = stage
    .find('.field-group')
    .filter((node): node is Konva.Group => node instanceof Konva.Group);
  const horizontal: SnapPoint[] = [];
  const vertical: SnapPoint[] = [];

  fieldGroups.forEach((group) => {
    if (excludeId && group.id() === excludeId) {
      return;
    }

    const rect = group.getClientRect();

    // Vertical snap points (for horizontal alignment)
    horizontal.push(
      { position: rect.y, type: 'edge', direction: 'horizontal' },
      { position: rect.y + rect.height / 2, type: 'center', direction: 'horizontal' },
      { position: rect.y + rect.height, type: 'edge', direction: 'horizontal' },
    );

    // Horizontal snap points (for vertical alignment)
    vertical.push(
      { position: rect.x, type: 'edge', direction: 'vertical' },
      { position: rect.x + rect.width / 2, type: 'center', direction: 'vertical' },
      { position: rect.x + rect.width, type: 'edge', direction: 'vertical' },
    );
  });

  return { horizontal, vertical };
}

export function calculateSnapSizes(
  stage: Konva.Stage,
  excludeId?: string,
): { widths: number[]; heights: number[] } {
  const fieldGroups = stage
    .find('.field-group')
    .filter((node): node is Konva.Group => node instanceof Konva.Group);
  const widths: number[] = [];
  const heights: number[] = [];

  fieldGroups.forEach((group) => {
    if (excludeId && group.id() === excludeId) {
      return;
    }

    const rect = group.getClientRect();
    widths.push(rect.width);
    heights.push(rect.height);
  });

  return { widths, heights };
}

export function getSnappedPosition(
  stage: Konva.Stage,
  movingGroup: Konva.Group,
  newX: number,
  newY: number,
): SnapResult {
  const { horizontal, vertical } = calculateSnapPositions(stage, movingGroup.id());
  const rect = movingGroup.getClientRect();

  let snappedX = newX;
  let snappedY = newY;
  let horizontalGuide: number | undefined;
  let verticalGuide: number | undefined;

  // Calculate the moving field's snap points
  const movingTop = newY;
  const movingBottom = newY + rect.height;
  const movingCenterY = newY + rect.height / 2;
  const movingLeft = newX;
  const movingRight = newX + rect.width;
  const movingCenterX = newX + rect.width / 2;

  // Check horizontal snapping (Y position)
  for (const snapPoint of horizontal) {
    const distanceTop = Math.abs(movingTop - snapPoint.position);
    const distanceBottom = Math.abs(movingBottom - snapPoint.position);
    const distanceCenter = Math.abs(movingCenterY - snapPoint.position);

    if (distanceTop <= SNAP_THRESHOLD) {
      snappedY = snapPoint.position;
      horizontalGuide = snapPoint.position;
      break;
    } else if (distanceBottom <= SNAP_THRESHOLD) {
      snappedY = snapPoint.position - rect.height;
      horizontalGuide = snapPoint.position;
      break;
    } else if (distanceCenter <= SNAP_THRESHOLD) {
      snappedY = snapPoint.position - rect.height / 2;
      horizontalGuide = snapPoint.position;
      break;
    }
  }

  // Check vertical snapping (X position)
  for (const snapPoint of vertical) {
    const distanceLeft = Math.abs(movingLeft - snapPoint.position);
    const distanceRight = Math.abs(movingRight - snapPoint.position);
    const distanceCenter = Math.abs(movingCenterX - snapPoint.position);

    if (distanceLeft <= SNAP_THRESHOLD) {
      snappedX = snapPoint.position;
      verticalGuide = snapPoint.position;
      break;
    } else if (distanceRight <= SNAP_THRESHOLD) {
      snappedX = snapPoint.position - rect.width;
      verticalGuide = snapPoint.position;
      break;
    } else if (distanceCenter <= SNAP_THRESHOLD) {
      snappedX = snapPoint.position - rect.width / 2;
      verticalGuide = snapPoint.position;
      break;
    }
  }

  return {
    x: snappedX,
    y: snappedY,
    horizontalGuide,
    verticalGuide,
  };
}

export function getSnappedResize(
  stage: Konva.Stage,
  resizingGroup: Konva.Group,
  newX: number,
  newY: number,
  newWidth: number,
  newHeight: number,
): ResizeSnapResult {
  const { horizontal, vertical } = calculateSnapPositions(stage, resizingGroup.id());
  const { widths, heights } = calculateSnapSizes(stage, resizingGroup.id());

  const snappedX = newX;
  const snappedY = newY;
  let snappedWidth = newWidth;
  let snappedHeight = newHeight;
  const horizontalGuides: number[] = [];
  const verticalGuides: number[] = [];

  // Snap width to other field widths
  for (const width of widths) {
    if (Math.abs(newWidth - width) <= SNAP_THRESHOLD) {
      snappedWidth = width;
      break;
    }
  }

  // Snap height to other field heights
  for (const height of heights) {
    if (Math.abs(newHeight - height) <= SNAP_THRESHOLD) {
      snappedHeight = height;
      break;
    }
  }

  // Calculate field edges with new snapped dimensions
  const movingTop = snappedY;
  const movingBottom = snappedY + snappedHeight;
  const movingLeft = snappedX;
  const movingRight = snappedX + snappedWidth;

  // Snap edges to alignment guides
  for (const snapPoint of horizontal) {
    if (Math.abs(movingTop - snapPoint.position) <= SNAP_THRESHOLD) {
      horizontalGuides.push(snapPoint.position);
    } else if (Math.abs(movingBottom - snapPoint.position) <= SNAP_THRESHOLD) {
      horizontalGuides.push(snapPoint.position);
    }
  }

  for (const snapPoint of vertical) {
    if (Math.abs(movingLeft - snapPoint.position) <= SNAP_THRESHOLD) {
      verticalGuides.push(snapPoint.position);
    } else if (Math.abs(movingRight - snapPoint.position) <= SNAP_THRESHOLD) {
      verticalGuides.push(snapPoint.position);
    }
  }

  return {
    x: snappedX,
    y: snappedY,
    width: snappedWidth,
    height: snappedHeight,
    horizontalGuides,
    verticalGuides,
  };
}

export function showSnapGuides(
  snapGuideLayer: Konva.Layer,
  horizontalGuide?: number,
  verticalGuide?: number,
  stageWidth?: number,
  stageHeight?: number,
): void {
  if (!snapGuideLayer) {
    return;
  }

  hideSnapGuides(snapGuideLayer);

  if (horizontalGuide !== undefined && stageWidth) {
    const horizontalLine = new Konva.Line({
      name: 'snap-guide-horizontal',
      points: [0, horizontalGuide, stageWidth, horizontalGuide],
      stroke: 'rgb(0, 161, 255)',
      strokeWidth: 1,
      dash: [5, 5],
      listening: false,
    });
    snapGuideLayer.add(horizontalLine);
  }

  if (verticalGuide !== undefined && stageHeight) {
    const verticalLine = new Konva.Line({
      name: 'snap-guide-vertical',
      points: [verticalGuide, 0, verticalGuide, stageHeight],
      stroke: 'rgb(0, 161, 255)',
      strokeWidth: 1,
      dash: [5, 5],
      listening: false,
    });
    snapGuideLayer.add(verticalLine);
  }

  snapGuideLayer.batchDraw();
}

export function showMultipleSnapGuides(
  snapGuideLayer: Konva.Layer,
  horizontalGuides: number[],
  verticalGuides: number[],
  stageWidth: number,
  stageHeight: number,
): void {
  if (!snapGuideLayer) {
    return;
  }

  hideSnapGuides(snapGuideLayer);

  // Show horizontal guides
  horizontalGuides.forEach((guide) => {
    const horizontalLine = new Konva.Line({
      name: 'snap-guide-horizontal',
      points: [0, guide, stageWidth, guide],
      stroke: 'rgb(0, 161, 255)',
      strokeWidth: 1,
      dash: [5, 5],
      listening: false,
    });
    snapGuideLayer.add(horizontalLine);
  });

  // Show vertical guides
  verticalGuides.forEach((guide) => {
    const verticalLine = new Konva.Line({
      name: 'snap-guide-vertical',
      points: [guide, 0, guide, stageHeight],
      stroke: 'rgb(0, 161, 255)',
      strokeWidth: 1,
      dash: [5, 5],
      listening: false,
    });
    snapGuideLayer.add(verticalLine);
  });

  snapGuideLayer.batchDraw();
}

export function hideSnapGuides(snapGuideLayer: Konva.Layer): void {
  if (!snapGuideLayer) {
    return;
  }

  const guides = snapGuideLayer.find('.snap-guide-horizontal, .snap-guide-vertical');
  guides.forEach((guide: Konva.Node) => guide.destroy());
  snapGuideLayer.batchDraw();
}
