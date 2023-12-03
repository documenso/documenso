import type { ReactNode } from 'react';

import { motion } from 'framer-motion';

import { Button } from '../button';
import { useStepper } from './stepper-context';

const CurrentStep = () => {
  const { totalSteps: maxStep, currentStep: step } = useStepper();
  return (
    <div>
      <p className="text-muted-foreground text-sm">
        Step <span>{`${step} of ${maxStep}`}</span>
      </p>

      <div className="bg-muted relative mt-4 h-[2px] rounded-md">
        <motion.div
          layout="size"
          layoutId="document-flow-container-step"
          className="bg-documenso absolute inset-y-0 left-0"
          style={{
            width: `${(100 / maxStep) * step}%`,
          }}
        />
      </div>
    </div>
  );
};

type StepperActionProps = {
  nextLabel?: string;
  previousLabel?: string;
  onNext?: () => void;
  onPrevious?: () => void;
  isLoading?: boolean;
  disablePrevious?: boolean;
  disableNext?: boolean;
  canGoPrevious?: boolean;
  canGoNext?: boolean;
};

const StepperAction = ({
  nextLabel = 'Continue',
  previousLabel = 'Go Back',
  onNext,
  onPrevious,
  isLoading,
  disableNext,
  disablePrevious,
  canGoNext,
  canGoPrevious,
}: StepperActionProps) => {
  const { nextStep, prevStep, isFirstStep, isLastStep } = useStepper();

  const handleNext = () => {
    if (onNext) {
      onNext();
    }
    if (isLastStep) return;
    nextStep();
  };

  const handlePrevious = () => {
    if (onPrevious) {
      onPrevious();
    }
    if (isFirstStep) return;
    prevStep();
  };

  const isPreviousEnabled =
    canGoPrevious === true
      ? false
      : isFirstStep === true
      ? true
      : disablePrevious === true
      ? true
      : false;

  const isNextEnabled =
    canGoNext === true ? false : isLastStep === true ? true : disableNext === true ? true : false;

  return (
    <div className="mt-4 flex gap-x-4">
      <Button
        type="button"
        className="dark:bg-muted dark:hover:bg-muted/80 flex-1 bg-black/5 hover:bg-black/10"
        size="lg"
        variant="secondary"
        onClick={handlePrevious}
        disabled={isPreviousEnabled}
        loading={isLoading}
      >
        {previousLabel}
      </Button>

      <Button
        disabled={isNextEnabled}
        type="button"
        className="bg-documenso flex-1"
        size="lg"
        onClick={handleNext}
        loading={isLoading}
      >
        {nextLabel}
      </Button>
    </div>
  );
};

export type StepProps = {
  children: ReactNode;
  title: string;
  description: string;
} & StepperActionProps;

export const Step = ({ children, description, title, ...rest }: StepProps) => {
  return (
    <>
      <h3 className="text-foreground text-2xl font-semibold">{title}</h3>

      <p className="text-muted-foreground mt-2 text-sm">{description}</p>

      <hr className="border-border mb-8 mt-4" />

      {children}
      <div className="mt-4 flex-shrink-0">
        <CurrentStep />
        <StepperAction {...rest} />
      </div>
    </>
  );
};
