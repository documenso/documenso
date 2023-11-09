import { Point } from './point';

export class Canvas {
  private readonly $canvas: HTMLCanvasElement;
  private readonly $offscreenCanvas: HTMLCanvasElement;

  private currentCanvasWidth = 0;
  private currentCanvasHeight = 0;

  private points: Point[] = [];
  private onChangeHandlers: Array<(_canvas: Canvas, _cleared: boolean) => void> = [];

  private isPressed = false;
  private lastVelocity = 0;

  private readonly VELOCITY_FILTER_WEIGHT = 0.5;
  private readonly DPI = 2;

  constructor(canvas: HTMLCanvasElement) {
    this.$canvas = canvas;
    this.$offscreenCanvas = document.createElement('canvas');

    const { width, height } = this.$canvas.getBoundingClientRect();

    this.currentCanvasWidth = width * this.DPI;
    this.currentCanvasHeight = height * this.DPI;

    this.$canvas.width = this.currentCanvasWidth;
    this.$canvas.height = this.currentCanvasHeight;

    Object.assign(this.$canvas.style, {
      touchAction: 'none',
      msTouchAction: 'none',
      userSelect: 'none',
    });

    window.addEventListener('resize', this.onResize.bind(this));

    this.$canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
    this.$canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
    this.$canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
    this.$canvas.addEventListener('mouseenter', this.onMouseEnter.bind(this));
    this.$canvas.addEventListener('mouseleave', this.onMouseLeave.bind(this));
    this.$canvas.addEventListener('pointerdown', this.onMouseDown.bind(this));
    this.$canvas.addEventListener('pointermove', this.onMouseMove.bind(this));
    this.$canvas.addEventListener('pointerup', this.onMouseUp.bind(this));
  }

  /**
   * Calculates the minimum stroke width as a percentage of the current canvas suitable for a signature.
   */
  private minStrokeWidth(): number {
    return Math.min(this.currentCanvasWidth, this.currentCanvasHeight) * 0.005;
  }

  /**
   * Calculates the maximum stroke width as a percentage of the current canvas suitable for a signature.
   */
  private maxStrokeWidth(): number {
    return Math.min(this.currentCanvasWidth, this.currentCanvasHeight) * 0.035;
  }

  /**
   * Retrieves the HTML canvas element.
   */
  public getCanvas(): HTMLCanvasElement {
    return this.$canvas;
  }

  /**
   * Retrieves the 2D rendering context of the canvas.
   * Throws an error if the context is not available.
   */
  public getContext(): CanvasRenderingContext2D {
    const ctx = this.$canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Canvas context is not available.');
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    return ctx;
  }

  /**
   * Handles the resize event of the canvas.
   * Adjusts the canvas size and preserves the content using image data.
   */
  private onResize(): void {
    const { width, height } = this.$canvas.getBoundingClientRect();

    const oldWidth = this.currentCanvasWidth;
    const oldHeight = this.currentCanvasHeight;

    const ctx = this.getContext();

    const imageData = ctx.getImageData(0, 0, oldWidth, oldHeight);

    this.$canvas.width = width * this.DPI;
    this.$canvas.height = height * this.DPI;

    this.currentCanvasWidth = width * this.DPI;
    this.currentCanvasHeight = height * this.DPI;

    ctx.putImageData(imageData, 0, 0, 0, 0, width * this.DPI, height * this.DPI);
  }

  /**
   * Handles the mouse down event on the canvas.
   * Adds the starting point for the signature.
   */
  private onMouseDown(event: MouseEvent | PointerEvent | TouchEvent): void {
    if (event.cancelable) {
      event.preventDefault();
    }

    this.isPressed = true;

    const point = Point.fromEvent(event, this.DPI);

    this.addPoint(point);
  }

  /**
   * Handles the mouse move event on the canvas.
   * Adds a point to the signature if the mouse is pressed, based on the sample rate.
   */
  private onMouseMove(event: MouseEvent | PointerEvent | TouchEvent): void {
    if (event.cancelable) {
      event.preventDefault();
    }

    if (!this.isPressed) {
      return;
    }

    const point = Point.fromEvent(event, this.DPI);

    if (point.distanceTo(this.points[this.points.length - 1]) > 10) {
      this.addPoint(point);
    }
  }

  /**
   * Handles the mouse up event on the canvas.
   * Adds the final point for the signature and resets the points array.
   */
  private onMouseUp(event: MouseEvent | PointerEvent | TouchEvent, addPoint = true): void {
    if (event.cancelable) {
      event.preventDefault();
    }

    this.isPressed = false;

    const point = Point.fromEvent(event, this.DPI);

    if (addPoint) {
      this.addPoint(point);
    }

    this.onChangeHandlers.forEach((handler) => handler(this, false));

    this.points = [];
  }

  private onMouseEnter(event: MouseEvent): void {
    if (event.cancelable) {
      event.preventDefault();
    }

    event.buttons === 1 && this.onMouseDown(event);
  }

  private onMouseLeave(event: MouseEvent): void {
    if (event.cancelable) {
      event.preventDefault();
    }

    this.onMouseUp(event, false);
  }

  /**
   * Adds a point to the signature and performs smoothing and drawing.
   */
  private addPoint(point: Point): void {
    const lastPoint = this.points[this.points.length - 1] ?? point;

    this.points.push(point);

    const smoothedPoints = this.smoothSignature(this.points);

    let velocity = point.velocityFrom(lastPoint);
    velocity =
      this.VELOCITY_FILTER_WEIGHT * velocity +
      (1 - this.VELOCITY_FILTER_WEIGHT) * this.lastVelocity;

    const newWidth =
      velocity > 0 && this.lastVelocity > 0 ? this.strokeWidth(velocity) : this.minStrokeWidth();

    this.drawSmoothSignature(smoothedPoints, newWidth);

    this.lastVelocity = velocity;
  }

  /**
   * Applies a smoothing algorithm to the signature points.
   */
  private smoothSignature(points: Point[]): Point[] {
    const smoothedPoints: Point[] = [];

    const startPoint = points[0];
    const endPoint = points[points.length - 1];

    smoothedPoints.push(startPoint);

    for (let i = 0; i < points.length - 1; i++) {
      const p0 = i > 0 ? points[i - 1] : startPoint;
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = i < points.length - 2 ? points[i + 2] : endPoint;

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;

      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      smoothedPoints.push(new Point(cp1x, cp1y));
      smoothedPoints.push(new Point(cp2x, cp2y));
      smoothedPoints.push(p2);
    }

    return smoothedPoints;
  }

  /**
   * Draws the smoothed signature on the canvas.
   */
  private drawSmoothSignature(points: Point[], width: number): void {
    const ctx = this.getContext();

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();

    const startPoint = points[0];

    ctx.moveTo(startPoint.x, startPoint.y);

    ctx.lineWidth = width;

    for (let i = 1; i < points.length; i += 3) {
      const cp1 = points[i];
      const cp2 = points[i + 1];
      const endPoint = points[i + 2];

      ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, endPoint.x, endPoint.y);
    }

    ctx.stroke();
    ctx.closePath();
  }

  /**
   * Calculates the stroke width based on the velocity.
   */
  private strokeWidth(velocity: number): number {
    return Math.max(this.maxStrokeWidth() / (velocity + 1), this.minStrokeWidth());
  }

  public registerOnChangeHandler(handler: (_canvas: Canvas, _cleared: boolean) => void): void {
    this.onChangeHandlers.push(handler);
  }

  public unregisterOnChangeHandler(handler: (_canvas: Canvas, _cleared: boolean) => void): void {
    this.onChangeHandlers = this.onChangeHandlers.filter((l) => l !== handler);
  }

  /**
   * Retrieves the signature as a data URL.
   */
  public toDataURL(type?: string, quality?: number): string {
    return this.$canvas.toDataURL(type, quality);
  }

  /**
   * Clears the signature from the canvas.
   */
  public clear(): void {
    const ctx = this.getContext();

    ctx.clearRect(0, 0, this.currentCanvasWidth, this.currentCanvasHeight);

    this.onChangeHandlers.forEach((handler) => handler(this, true));

    this.points = [];
  }

  /**
   * Retrieves the signature as an image blob.
   */
  public async toBlob(type?: string, quality?: number): Promise<Blob> {
    const promise = new Promise<Blob>((resolve, reject) => {
      this.$canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Could not convert canvas to blob.'));
            return;
          }

          resolve(blob);
        },
        type,
        quality,
      );
    });

    return await promise;
  }
}
