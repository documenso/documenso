import type { ReactNode } from 'react';
import { Children, isValidElement, useState } from 'react';

import { StepperProvider } from './stepper-context';

type StepperProps = {
  children: ReactNode;
};

function getValidChildren(children: ReactNode) {
  return Children.toArray(children).filter((child) => isValidElement(child));
}

export const Stepper = ({ children }: StepperProps) => {
  const [currentStep, setCurrentStep] = useState(1);
  const validChildren = getValidChildren(children);
  const totalSteps = validChildren.length;

  if (validChildren.length === 0) {
    throw new Error('Stepper component should have children');
  }

  const activeStep = validChildren?.[currentStep - 1];

  const isFirstStep = currentStep === 1;

  const isLastStep = currentStep === totalSteps;

  const nextStep = () => {
    if (isLastStep) return;
    setCurrentStep(currentStep + 1);
  };

  const prevStep = () => {
    if (isFirstStep) return;
    setCurrentStep(currentStep - 1);
  };

  return (
    <StepperProvider.Provider
      value={{ totalSteps, currentStep, isFirstStep, isLastStep, nextStep, prevStep }}
    >
      {activeStep}
    </StepperProvider.Provider>
  );
};
