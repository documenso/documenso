import {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  TouchEvent as ReactTouchEvent,
} from 'react';

export type PointLike = {
  x: number;
  y: number;
  timestamp: number;
};

const isTouchEvent = (
  event:
    | ReactMouseEvent
    | ReactPointerEvent
    | ReactTouchEvent
    | MouseEvent
    | PointerEvent
    | TouchEvent,
): event is TouchEvent | ReactTouchEvent => {
  return 'touches' in event;
};

export class Point implements PointLike {
  public x: number;
  public y: number;
  public timestamp: number;

  constructor(x: number, y: number, timestamp?: number) {
    this.x = x;
    this.y = y;
    this.timestamp = timestamp ?? Date.now();
  }

  public distanceTo(point: PointLike): number {
    return Math.sqrt(Math.pow(point.x - this.x, 2) + Math.pow(point.y - this.y, 2));
  }

  public equals(point: PointLike): boolean {
    return this.x === point.x && this.y === point.y && this.timestamp === point.timestamp;
  }

  public velocityFrom(start: PointLike): number {
    const timeDifference = this.timestamp - start.timestamp;

    if (timeDifference !== 0) {
      return this.distanceTo(start) / timeDifference;
    }

    return 0;
  }

  public static fromPointLike({ x, y, timestamp }: PointLike): Point {
    return new Point(x, y, timestamp);
  }

  public static fromEvent(
    event:
      | ReactMouseEvent
      | ReactPointerEvent
      | ReactTouchEvent
      | MouseEvent
      | PointerEvent
      | TouchEvent,
    dpi = 1,
    el?: HTMLElement | null,
  ): Point {
    const target = el ?? event.target;

    if (!(target instanceof HTMLElement)) {
      throw new Error('Event target is not an HTMLElement.');
    }

    const { top, bottom, left, right } = target.getBoundingClientRect();

    let clientX, clientY;

    if (isTouchEvent(event)) {
      clientX = event.touches[0].clientX;
      clientY = event.touches[0].clientY;
    } else {
      clientX = event.clientX;
      clientY = event.clientY;
    }

    // create a new point snapping to the edge of the current target element if it exceeds
    // the bounding box of the target element
    let x = Math.min(Math.max(left, clientX), right) - left;
    let y = Math.min(Math.max(top, clientY), bottom) - top;

    // adjust for DPI
    x *= dpi;
    y *= dpi;

    return new Point(x, y);
  }
}
