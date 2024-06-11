'use client';

import React, { forwardRef, useRef } from 'react';

import { FileText, Hexagon, Shapes } from 'lucide-react';
import { LiaGoogleDrive } from 'react-icons/lia';
import { PiMicrosoftTeamsLogo } from 'react-icons/pi';
import { TbBrandAirtable, TbBrandZapier } from 'react-icons/tb';

import { AnimatedDataFlow } from '@documenso/ui/components/animate/animated-data-flow';
import { cn } from '@documenso/ui/lib/utils';

// eslint-disable-next-line react/display-name
const Circle = forwardRef<HTMLDivElement, { className?: string; children?: React.ReactNode }>(
  ({ className, children }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'border-border z-10 flex h-12 w-12 items-center justify-center rounded-full border-2 bg-white p-3 shadow-[0_0_20px_-12px_rgba(0,0,0,0.8)]',
          className,
        )}
      >
        {children}
      </div>
    );
  },
);

export function DocumensoIntegrationsDataFlow() {
  const containerRef = useRef<HTMLDivElement>(null);
  const div1Ref = useRef<HTMLDivElement>(null);
  const div2Ref = useRef<HTMLDivElement>(null);
  const div3Ref = useRef<HTMLDivElement>(null);
  const div4Ref = useRef<HTMLDivElement>(null);
  const div5Ref = useRef<HTMLDivElement>(null);
  const div6Ref = useRef<HTMLDivElement>(null);
  const div7Ref = useRef<HTMLDivElement>(null);

  return (
    <div
      className="bg-background relative z-[-2] flex h-full w-full max-w-[32rem] items-center justify-center overflow-hidden p-10"
      ref={containerRef}
    >
      <div className="flex h-full w-full flex-row items-stretch justify-between gap-10">
        <div className="flex flex-col justify-center gap-2">
          <Circle className="bg-background" ref={div1Ref}>
            <Shapes color="#A2E771" className="h-6 w-6" />
          </Circle>
          <Circle className="bg-background" ref={div2Ref}>
            <Hexagon color="#A2E771" className="h-6 w-6" />
          </Circle>
          <Circle className="bg-background" ref={div3Ref}>
            <FileText color="#A2E771" className="h-6 w-6" />
          </Circle>
        </div>
        <div className="flex flex-col justify-center">
          <Circle ref={div4Ref} className="bg-background h-16 w-16">
            <TbBrandZapier color="#FF4A00" className="h-6 w-6" />
          </Circle>
        </div>
        <div className="flex flex-col justify-center gap-2">
          <Circle className="bg-background" ref={div5Ref}>
            <LiaGoogleDrive color="#A2E771" className="h-6 w-6" />
          </Circle>
          <Circle className="bg-background" ref={div6Ref}>
            <PiMicrosoftTeamsLogo color="#A2E771" className="h-6 w-6" />
          </Circle>
          <Circle className="bg-background" ref={div7Ref}>
            <TbBrandAirtable color="#A2E771" className="h-6 w-6" />
          </Circle>
        </div>
      </div>

      <AnimatedDataFlow containerRef={containerRef} fromRef={div1Ref} toRef={div4Ref} />
      <AnimatedDataFlow containerRef={containerRef} fromRef={div2Ref} toRef={div4Ref} />
      <AnimatedDataFlow containerRef={containerRef} fromRef={div3Ref} toRef={div4Ref} />
      <AnimatedDataFlow containerRef={containerRef} fromRef={div4Ref} toRef={div5Ref} />
      <AnimatedDataFlow containerRef={containerRef} fromRef={div4Ref} toRef={div6Ref} />
      <AnimatedDataFlow containerRef={containerRef} fromRef={div4Ref} toRef={div7Ref} />
    </div>
  );
}
