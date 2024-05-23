'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';

import Autoplay from 'embla-carousel-autoplay';
import useEmblaCarousel from 'embla-carousel-react';

import { Card } from '@documenso/ui/primitives/card';

import { Thumb } from './thumb';

type PropType = {
  slides: { label: string; imageSrc: string }[];
};

export const EmblaCarousel: React.FC<PropType> = ({ slides }) => {
  const [_isPlaying, setIsPlaying] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
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
  }, [emblaApi, emblaThumbsApi, setSelectedIndex]);

  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);

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

  return (
    <>
      <Card className="mx-auto mt-12 w-full max-w-4xl rounded-2xl p-1 before:rounded-2xl" gradient>
        <div className="overflow-hidden rounded-xl" ref={emblaRef}>
          <div className="flex touch-pan-y rounded-xl">
            {slides.map((slide, index) => (
              <div className="min-w-[10rem] flex-none basis-full rounded-xl" key={index}>
                <video
                  ref={(el) => (videoRefs.current[index] = el)}
                  muted
                  loop
                  className="h-auto w-full rounded-xl"
                >
                  <source src="/signing.mp4" type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <div className="mx-auto mt-12 max-w-4xl px-2">
        <div className="flex justify-between" ref={emblaThumbsRef}>
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
