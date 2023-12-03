import { createContext, useContext } from 'react';

type StepperContext = {
  currentStep: number;
  totalSteps: number;
  isFirstStep: boolean;
  isLastStep: boolean;
  nextStep: () => void;
  prevStep: () => void;
};

export const StepperProvider = createContext<StepperContext>({
  currentStep: 1,
  totalSteps: 1,
  isFirstStep: true,
  isLastStep: false,
  nextStep: () => undefined,
  prevStep: () => undefined,
});

export const useStepper = () => {
  const context = useContext(StepperProvider);

  if (!context) {
    throw Error('useContext hook should be called inside the Stepper Provider');
  }

  return context;
};
