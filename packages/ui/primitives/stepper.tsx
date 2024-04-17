import React, { createContext, useContext, useState } from 'react';
import type { FC } from 'react';

type StepContextValue = {
  isCompleting: boolean;
  stepIndex: number;
  currentStep: number;
  totalSteps: number;
  isFirst: boolean;
  isLast: boolean;
  nextStep: () => void;
  previousStep: () => void;
};

const StepContext = createContext<StepContextValue | null>(null);

type StepperProps = {
  children: React.ReactNode;
  onComplete?: () => void | Promise<void>;
  onStepChanged?: (currentStep: number) => void;
  currentStep?: number; // external control prop
  setCurrentStep?: (step: number) => void; // external control function
};

export const Stepper: FC<StepperProps> = ({
  children,
  onComplete,
  onStepChanged,
  currentStep: propCurrentStep,
  setCurrentStep: propSetCurrentStep,
}) => {
  const [stateCurrentStep, stateSetCurrentStep] = useState(1);
  const [isCompleting, setIsCompleting] = useState(false);

  // Determine if props are provided, otherwise use state
  const isControlled = propCurrentStep !== undefined && propSetCurrentStep !== undefined;
  const currentStep = isControlled ? propCurrentStep : stateCurrentStep;
  const setCurrentStep = isControlled ? propSetCurrentStep : stateSetCurrentStep;

  const totalSteps = React.Children.count(children);

  const handleComplete = async () => {
    try {
      if (!onComplete) {
        return;
      }

      setIsCompleting(true);

      await onComplete();

      setIsCompleting(false);
    } catch (error) {
      setIsCompleting(false);

      throw error;
    }
  };

  const handleStepChange = (nextStep: number) => {
    setCurrentStep(nextStep);
    onStepChanged?.(nextStep);
  };

  const nextStep = () => {
    if (currentStep < totalSteps) {
      void handleStepChange(currentStep + 1);
    } else {
      void handleComplete();
    }
  };

  const previousStep = () => {
    if (currentStep > 1) {
      void handleStepChange(currentStep - 1);
    }
  };

  // Empty stepper
  if (totalSteps === 0) {
    return null;
  }

  const currentChild = React.Children.toArray(children)[currentStep - 1];

  const stepContextValue: StepContextValue = {
    isCompleting,
    stepIndex: currentStep - 1,
    currentStep,
    totalSteps,
    isFirst: currentStep === 1,
    isLast: currentStep === totalSteps,
    nextStep,
    previousStep,
  };

  return <StepContext.Provider value={stepContextValue}>{currentChild}</StepContext.Provider>;
};

/** Hook for children to use the step context */
export const useStep = (): StepContextValue => {
  const context = useContext(StepContext);

  if (!context) {
    throw new Error('useStep must be used within a Stepper');
  }

  return context;
};
