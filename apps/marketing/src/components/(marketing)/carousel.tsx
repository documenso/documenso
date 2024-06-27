'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';

import Autoplay from 'embla-carousel-autoplay';
import useEmblaCarousel from 'embla-carousel-react';
import { useTheme } from 'next-themes';

import { Card } from '@documenso/ui/primitives/card';
import { Progress } from '@documenso/ui/primitives/progress';

import { Slide } from './slide';

const SLIDES = [
  {
    label: 'Signing Process',
    type: 'video',
    srcLight: 'https://github.com/documenso/design/raw/main/marketing/signing.webm',
    srcDark: 'https://github.com/documenso/design/raw/main/marketing/dark/signing.webm',
  },
  {
    label: 'Teams',
    type: 'video',
    srcLight: 'https://github.com/documenso/design/raw/main/marketing/teams.webm',
    srcDark: 'https://github.com/documenso/design/raw/main/marketing/dark/teams.webm',
  },
  {
    label: 'Zapier',
    type: 'video',
    srcLight: 'https://github.com/documenso/design/raw/main/marketing/zapier.webm',
    srcDark: 'https://github.com/documenso/design/raw/main/marketing/dark/zapier.webm',
  },
  {
    label: 'Direct Link',
    type: 'video',
    srcLight: 'https://github.com/documenso/design/raw/main/marketing/direct-links.webm',
    srcDark: 'https://github.com/documenso/design/raw/main/marketing/dark/direct-links.webm',
  },
  {
    label: 'Webhooks',
    type: 'video',
    srcLight: 'https://github.com/documenso/design/raw/main/marketing/webhooks.webm',
    srcDark: 'https://github.com/documenso/design/raw/main/marketing/dark/webhooks.webm',
  },
  {
    label: 'API',
    type: 'video',
    srcLight: 'https://github.com/documenso/design/raw/main/marketing/api.webm',
    srcDark: 'https://github.com/documenso/design/raw/main/marketing/dark/api.webm',
  },
  {
    label: 'Profile',
    type: 'video',
    srcLight: 'https://github.com/documenso/design/raw/main/marketing/profile_teaser.webm',
    srcDark: 'https://github.com/documenso/design/raw/main/marketing/dark/profile_teaser.webm',
  },
];

export const Carousel = () => {
  const slides = SLIDES;
  const [_isPlaying, setIsPlaying] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const [autoplayDelay, setAutoplayDelay] = useState<number[]>([]);
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true }, [
    Autoplay({ playOnInit: true, delay: autoplayDelay[selectedIndex] || 5000 }),
  ]);
  const [emblaThumbsRef, emblaThumbsApi] = useEmblaCarousel(
    {
      loop: true,
      containScroll: 'keepSnaps',
      dragFree: true,
    },
    [Autoplay({ playOnInit: true, delay: autoplayDelay[selectedIndex] || 5000 })],
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

    if (autoplay) {
      autoplay.reset();
    }
  }, [emblaApi, emblaThumbsApi, setSelectedIndex]);

  const resetProgress = useCallback(() => {
    setProgress(0);
  }, []);

  useEffect(() => {
    const setVideoDurations = async () => {
      const durations = await Promise.all(
        videoRefs.current.map(
          async (video) =>
            new Promise<number>((resolve) => {
              if (video) {
                video.onloadedmetadata = () => resolve(video.duration * 1000);
              } else {
                resolve(5000);
              }
            }),
        ),
      );

      setAutoplayDelay(durations);
    };

    void setVideoDurations();
  }, [slides, mounted, resolvedTheme]);

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
  }, [slides, mounted, resolvedTheme]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();

    emblaApi.on('select', onSelect).on('reInit', onSelect);
  }, [emblaApi, onSelect, mounted, resolvedTheme]);

  useEffect(() => {
    const autoplay = emblaApi?.plugins()?.autoplay;
    if (!autoplay) return;

    setIsPlaying(autoplay.isPlaying());
    emblaApi
      .on('autoplay:play', () => setIsPlaying(true))
      .on('autoplay:stop', () => setIsPlaying(false))
      .on('reInit', () => setIsPlaying(autoplay.isPlaying()));
  }, [emblaApi, mounted, resolvedTheme]);

  useEffect(() => {
    if (autoplayDelay[selectedIndex] === undefined) return;

    const updateInterval = 50;
    const increment = 100 / (autoplayDelay[selectedIndex] / updateInterval);
    let progressValue = 0;

    const timer = setInterval(() => {
      setProgress((prevProgress) => {
        progressValue = prevProgress + increment;
        if (progressValue >= 100) {
          clearInterval(timer);
          if (emblaApi) {
            emblaApi.scrollNext();
          }
          return 100;
        }
        return progressValue;
      });
    }, updateInterval);

    return () => clearInterval(timer);
  }, [selectedIndex, autoplayDelay, emblaApi, mounted, resolvedTheme]);

  useEffect(() => {
    if (!emblaApi) return;

    const resetCarousel = () => {
      emblaApi.reInit();
      emblaApi.scrollTo(0);
    };

    resetCarousel();
  }, [emblaApi, autoplayDelay, mounted, resolvedTheme]);

  // Ensure the component renders only after mounting to avoid theme issues
  if (!mounted) return null;
  return (
    <>
      <Card className="mx-auto mt-12 w-full max-w-4xl rounded-2xl p-1 before:rounded-2xl" gradient>
        <div className="overflow-hidden rounded-xl" ref={emblaRef}>
          <div className="flex touch-pan-y rounded-xl">
            {slides.map((slide, index) => (
              <div className="min-w-[10rem] flex-none basis-full rounded-xl" key={index}>
                {slide.type === 'video' && (
                  <video
                    key={`${resolvedTheme}-${index}`}
                    ref={(el) => (videoRefs.current[index] = el)}
                    muted
                    loop
                    className="h-auto w-full rounded-xl"
                  >
                    <source
                      src={resolvedTheme === 'dark' ? slide.srcDark : slide.srcLight}
                      type="video/webm"
                    />
                    Your browser does not support the video tag.
                  </video>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="dark:bg-background absolute bottom-2 right-2 flex w-[20%] flex-col items-center space-y-1 rounded-lg bg-white p-1.5 sm:w-[5%]">
          <span className="text-foreground dark:text-muted-foreground text-[10px] sm:text-xs">
            {selectedIndex + 1}/{slides.length}
          </span>
          <Progress value={progress} className="h-1" />
        </div>
      </Card>

      <div className="mx-auto mt-6 w-full max-w-4xl px-2 sm:mt-12">
        <div className="mt-2 flex flex-wrap justify-between gap-6" ref={emblaThumbsRef}>
          {slides.map((slide, index) => (
            <Slide
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
