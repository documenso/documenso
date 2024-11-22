'use client';

import { useEffect, useRef, useState } from 'react';

import * as faceLandmarksDetection from '@tensorflow-models/face-landmarks-detection';
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';
import { Play, Square, X } from 'lucide-react';
import type { StrokeOptions } from 'perfect-freehand';
import { getStroke } from 'perfect-freehand';
import Webcam from 'react-webcam';

import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import { getSvgPathFromStroke } from '@documenso/ui/primitives/signature-pad/helper';

export type NoseCanvasDrawerProps = {
  className?: string;
  onStart?: () => void;
  onStop?: () => void;
  onCapture?: (dataUrl: string) => void;
};

export const NoseCanvasDrawer = ({
  className,
  onStart,
  onStop,
  onCapture,
}: NoseCanvasDrawerProps) => {
  const $el = useRef<HTMLDivElement>(null);

  const $webcam = useRef<Webcam>(null);
  const $canvas = useRef<HTMLCanvasElement>(null);

  const $detector = useRef<faceLandmarksDetection.FaceLandmarksDetector | null>(null);
  const $animationFrameId = useRef<number | null>(null);

  const $previousNosePosition = useRef<{ x: number; y: number } | null>(null);
  const $lines = useRef<{ x: number; y: number }[]>([]);

  const $scaleFactor = useRef(1);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const onTogglePlayingClick = () => {
    setIsPlaying((playing) => {
      if (playing && $animationFrameId.current) {
        cancelAnimationFrame($animationFrameId.current);

        if ($canvas.current) {
          const ctx = $canvas.current.getContext('2d');

          if (ctx) {
            ctx.save();

            onCapture?.($canvas.current.toDataURL('image/png'));
          }

          $lines.current = [];
        }
      }

      return !playing;
    });
  };

  const onClearClick = () => {
    if (isPlaying) {
      return;
    }

    if ($canvas.current) {
      const ctx = $canvas.current.getContext('2d');

      if (ctx) {
        ctx.clearRect(0, 0, $canvas.current.width, $canvas.current.height);
        ctx.save();

        onCapture?.($canvas.current.toDataURL('image/png'));
      }
    }

    $lines.current = [];
  };

  const loadModel = async () => {
    await tf.ready();

    return await faceLandmarksDetection.createDetector(
      faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh,
      {
        runtime: 'mediapipe',
        solutionPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh',
        refineLandmarks: true,
        maxFaces: 1,
      },
    );
  };

  const detectAndDraw = async () => {
    if (!$detector.current || !$canvas.current) {
      return;
    }

    const canvas = $canvas.current;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      return;
    }

    const video = $webcam.current?.video;

    if (!video) {
      return;
    }

    if (!isPlaying) {
      return;
    }

    console.log('about to predict');

    const predictions = await $detector.current.estimateFaces(video, {
      flipHorizontal: true,
      staticImageMode: false,
    });

    console.log({ predictions });

    if (predictions.length > 0) {
      const keypoints = predictions[0].keypoints;
      const nose = keypoints[1]; // Nose tip keypoint

      const currentPosition = {
        x: nose.x * $scaleFactor.current,
        y: nose.y * $scaleFactor.current,
      };

      if ($previousNosePosition.current) {
        $lines.current.push(currentPosition);

        ctx.restore();

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.fillStyle = 'red';

        const strokeOptions: StrokeOptions = {
          size: 5,
          thinning: 0.25,
          streamline: 0.5,
          smoothing: 0.5,
          end: {
            taper: 5,
          },
        };

        const pathData = new Path2D(getSvgPathFromStroke(getStroke($lines.current, strokeOptions)));

        ctx.fill(pathData);

        ctx.save();
      }

      $previousNosePosition.current = currentPosition;
    } else {
      $previousNosePosition.current = null;
    }

    $animationFrameId.current = requestAnimationFrame(() => void detectAndDraw());
  };

  useEffect(() => {
    setIsLoading(true);

    void loadModel().then((model) => {
      $detector.current = model;
      setIsLoading(false);
    });
  }, []);

  useEffect(() => {
    if (isPlaying) {
      void detectAndDraw();

      onStart?.();
    } else {
      onStop?.();
    }
  }, [isPlaying]);

  useEffect(() => {
    if (!$webcam.current?.video) {
      return;
    }

    const observer = new ResizeObserver((_entries) => {
      if ($webcam.current?.video) {
        const videoWidth = $webcam.current.video.videoWidth;
        const videoHeight = $webcam.current.video.videoHeight;

        const { width, height } = $webcam.current.video.getBoundingClientRect();

        $scaleFactor.current = Math.min(width / videoWidth, height / videoHeight);

        setIsPlaying(false);

        if ($animationFrameId.current) {
          cancelAnimationFrame($animationFrameId.current);
        }

        onClearClick();

        if ($canvas.current) {
          console.log('resizing canvas');
          $canvas.current.width = width;
          $canvas.current.height = height;

          const ctx = $canvas.current.getContext('2d');

          if (ctx) {
            ctx.moveTo(0, 0);

            ctx.save();
            ctx.scale(-1, 1);
            ctx.drawImage($webcam.current.video, 0, 0, width, height);
            ctx.restore();
          }
        }
      }
    });

    observer.observe($webcam.current.video);

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div ref={$el} className={cn('relative inline-block aspect-[4/3] h-full', className)}>
      <Webcam ref={$webcam} videoConstraints={{ facingMode: 'user' }} className="scale-x-[-1]" />

      <canvas ref={$canvas} className="absolute inset-0 z-10" />

      <div className="absolute bottom-2 right-2 z-20 flex items-center gap-x-2">
        <Button
          disabled={isLoading}
          onClick={onTogglePlayingClick}
          className="text-primary-foreground/80 h-8 w-8 rounded-full p-0"
        >
          {isPlaying ? <Square className="h-4 w-4" /> : <Play className="-mr-0.5 h-4 w-4" />}
        </Button>

        <Button
          disabled={isLoading || isPlaying}
          onClick={onClearClick}
          className="text-primary-foreground/80 h-8 w-8 rounded-full p-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
