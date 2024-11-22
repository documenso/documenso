'use client';

import { useState } from 'react';

import { NoseCanvasDrawer } from '~/components/nose-canvas-drawer';

export default function NoseDrawerDemo() {
  const [capturedImage, setCapturedImage] = useState<string | null>(null);

  const handleCapture = (dataUrl: string) => {
    setCapturedImage(dataUrl);
  };

  return (
    <main className="container mx-auto p-4">
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-6 text-3xl font-bold">Nose Drawing Demo</h1>

        <div className="space-y-8">
          {/* Instructions */}
          <div className="bg-muted rounded-lg p-4">
            <h2 className="mb-2 font-semibold">How to use:</h2>
            <ol className="list-inside list-decimal space-y-2">
              <li>Click &quot;Play&quot; to start your camera</li>
              <li>Move your nose to draw on the canvas</li>
              <li>Click &quot;Export as PNG&quot; to save your drawing</li>
              <li>Use &quot;Clear&quot; to start over</li>
            </ol>
          </div>

          {/* Canvas drawer */}
          <div className="bg-background rounded-lg border p-4">
            <NoseCanvasDrawer onCapture={handleCapture} />
          </div>

          {/* Preview captured image */}
          {capturedImage && (
            <div className="rounded-lg border p-4">
              <h2 className="mb-4 font-semibold">Captured Drawing</h2>
              <img
                src={capturedImage}
                alt="Captured nose drawing"
                className="max-w-full rounded-lg"
              />
              <div className="mt-4">
                <a
                  href={capturedImage}
                  download="nose-drawing.png"
                  className="text-primary hover:underline"
                >
                  Download Image
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
