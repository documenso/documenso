import React, { useEffect, useState } from 'react';
import type { FC } from 'react';

type StepProps = {
  readonly useStep: () => {
    stepIndex: number;
    currentStep: number;
    totalSteps: number;
    isFirst: boolean;
    isLast: boolean;
    nextStep: () => void;
    previousStep: () => void;
  };
};

export type WithStep<T> = T & StepProps;

type StepperProps = {
  children: React.ReactNode;
  onComplete?: () => void;
  onStepChanged?: (currentStep: number) => void;
  currentStep?: number;
  setCurrentStep?: (step: number) => void;
};

export const Stepper: FC<StepperProps> = ({
  children,
  onComplete,
  onStepChanged,
  currentStep: propCurrentStep,
  setCurrentStep: propSetCurrentStep,
}) => {
  const [stateCurrentStep, stateSetCurrentStep] = useState(1);

  // Determine if props are provided, otherwise use state
  const isControlled = propCurrentStep !== undefined && propSetCurrentStep !== undefined;
  const currentStep = isControlled ? propCurrentStep : stateCurrentStep;
  const setCurrentStep = isControlled ? propSetCurrentStep : stateSetCurrentStep;

  const totalSteps = React.Children.count(children);

  const nextStep = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete && onComplete();
    }
  };

  const previousStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  useEffect(() => {
    onStepChanged && onStepChanged(currentStep);
  }, [currentStep, onStepChanged]);

  const useStep = (stepIndex: number) => ({
    stepIndex,
    currentStep,
    totalSteps,
    isFirst: currentStep === 1,
    isLast: currentStep === totalSteps,
    nextStep,
    previousStep,
  });

  const renderStep = (child: React.ReactNode, index: number) => {
    if (!React.isValidElement<StepProps>(child)) return null;
    return index + 1 === currentStep
      ? React.cloneElement(child, {
          useStep: () => useStep(index),
        })
      : null;
  };

  return <>{React.Children.toArray(children).map(renderStep)}</>;
};
