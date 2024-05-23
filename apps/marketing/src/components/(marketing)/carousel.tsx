'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';

import Autoplay from 'embla-carousel-autoplay';
import useEmblaCarousel from 'embla-carousel-react';

import { Card } from '@documenso/ui/primitives/card';
import { Progress } from '@documenso/ui/primitives/progress';

import { Thumb } from './thumb';

const SLIDES = [
  {
    label: 'Signing Process',
    type: 'video',
    src: '/signing.mp4',
  },
  {
    label: 'Templates/Fields',
    type: 'video',
    src: '/signing.mp4',
  },
  {
    label: 'Zapier',
    type: 'video',
    src: '/signing.mp4',
  },
  {
    label: 'Webhooks',
    type: 'video',
    src: '/signing.mp4',
  },
  {
    label: 'API',
    type: 'video',
    src: '/signing.mp4',
  },
  {
    label: 'Teams',
    type: 'video',
    src: '/signing.mp4',
  },
  {
    label: 'Profile',
    type: 'video',
    src: '/signing.mp4',
  },
];

export const Carousel = () => {
  const slides = SLIDES;
  const [_isPlaying, setIsPlaying] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [progress, setProgress] = React.useState(0);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true }, [
    Autoplay({ playOnInit: true, delay: 5000 }),
  ]);
  const [emblaThumbsRef, emblaThumbsApi] = useEmblaCarousel(
    {
      loop: true,
      containScroll: 'keepSnaps',
      dragFree: true,
    },
    [Autoplay({ playOnInit: true, delay: 5000 })],
  );

  const onThumbClick = useCallback(
    (index: number) => {
      if (!emblaApi || !emblaThumbsApi) return;
      emblaApi.scrollTo(index);
    },
    [emblaApi, emblaThumbsApi],
  );

  const onSelect = useCallback(() => {
    if (!emblaApi || !emblaThumbsApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
    emblaThumbsApi.scrollTo(emblaApi.selectedScrollSnap());

    resetProgress();
    const autoplay = emblaApi.plugins()?.autoplay;

    console.log(autoplay);

    if (autoplay) {
      autoplay.reset();
    }
  }, [emblaApi, emblaThumbsApi, setSelectedIndex]);

  const resetProgress = useCallback(() => {
    setProgress(0);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const video = entry.target as HTMLVideoElement;
            video
              .play()
              .catch((error) => console.log('Error attempting to play the video:', error));
          } else {
            const video = entry.target as HTMLVideoElement;
            video.pause();
          }
        });
      },
      {
        threshold: 0.5,
      },
    );

    videoRefs.current.forEach((video) => {
      if (video) {
        observer.observe(video);
      }
    });

    return () => {
      observer.disconnect();
    };
  }, [slides]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();

    emblaApi.on('select', onSelect).on('reInit', onSelect);
  }, [emblaApi, onSelect]);

  useEffect(() => {
    const autoplay = emblaApi?.plugins()?.autoplay;
    if (!autoplay) return;

    setIsPlaying(autoplay.isPlaying());
    emblaApi
      .on('autoplay:play', () => setIsPlaying(true))
      .on('autoplay:stop', () => setIsPlaying(false))
      .on('reInit', () => setIsPlaying(autoplay.isPlaying()));
  }, [emblaApi]);

  useEffect(() => {
    const updateInterval = 50;
    const increment = 100 / (5000 / updateInterval);

    const timer = setInterval(() => {
      setProgress((prevProgress) => {
        if (prevProgress >= 100) {
          clearInterval(timer);
          return 100;
        }
        return prevProgress + increment;
      });
    }, updateInterval);

    return () => clearInterval(timer);
  }, [selectedIndex]);

  return (
    <>
      <Card className="mx-auto mt-12 w-full max-w-4xl rounded-2xl p-1 before:rounded-2xl" gradient>
        <div className="overflow-hidden rounded-xl" ref={emblaRef}>
          <div className="flex touch-pan-y rounded-xl">
            {slides.map((slide, index) => (
              <div className="min-w-[10rem] flex-none basis-full rounded-xl" key={index}>
                {slide.type === 'video' && (
                  <video
                    ref={(el) => (videoRefs.current[index] = el)}
                    muted
                    loop
                    className="h-auto w-full rounded-xl"
                  >
                    <source src={slide.src} type="video/mp4" />
                    Your browser does not support the video tag.
                  </video>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="absolute bottom-2 right-2 flex w-[5%] flex-col items-center space-y-1 rounded-lg bg-white p-1.5">
          <span className="text-foreground text-xs">
            {selectedIndex + 1}/{slides.length}
          </span>
          <Progress value={progress} className="h-1" />
        </div>
      </Card>

      <div className="mx-auto mt-12 max-w-4xl px-2">
        <div className="bg-muted-foreground/10 text-foreground inline-block rounded-xl px-3 py-2 text-sm">
          What's new
        </div>

        <div className="mt-2 flex justify-between" ref={emblaThumbsRef}>
          {slides.map((slide, index) => (
            <Thumb
              key={index}
              onClick={() => onThumbClick(index)}
              selected={index === selectedIndex}
              index={index}
              label={slide.label}
            />
          ))}
        </div>
      </div>
    </>
  );
};
