import React, { createContext, useContext, useEffect, useState } from 'react';
import type { FC } from 'react';

type StepContextType = {
  stepIndex: number;
  currentStep: number;
  totalSteps: number;
  isFirst: boolean;
  isLast: boolean;
  nextStep: () => void;
  previousStep: () => void;
};

const StepContext = createContext<StepContextType | null>(null);

type StepperProps = {
  children: React.ReactNode;
  onComplete?: () => void;
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

  // Empty stepper
  if (totalSteps === 0) return null;

  const currentChild = React.Children.toArray(children)[currentStep - 1];

  const stepContextValue: StepContextType = {
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
export const useStep = (): StepContextType => {
  const context = useContext(StepContext);
  if (!context) throw new Error('useStep must be used within a Stepper');
  return context;
};
