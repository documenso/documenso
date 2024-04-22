import * as React from 'react';

import { Eye, EyeOff } from 'lucide-react';
import { Dot } from 'lucide-react';
import { Check } from 'lucide-react';
import { GoTriangleDown, GoTriangleRight } from 'react-icons/go';

import { cn } from '../lib/utils';
import { Button } from './button';
import type { InputProps } from './input';
import { Input } from './input';

interface Validation {
  hint: string;
  success: boolean;
}

const PASSWORD_REGEX = {
  UPPER_CASE: /^(?=.*[A-Z])/,
  LOWER_CASE: /^(?=.*[a-z])/,
  NUMBER: /\d/,
  SPECIAL_CHARACTER: /[\W_]/,
};

const DEFAULT_VALIDATIONS = [
  { hint: 'An uppercase character', success: false },
  { hint: 'A lowercase character', success: false },
  { hint: 'A number', success: false },
  { hint: 'A special character', success: false },
  { hint: '8+ characters long', success: false },
];

const HintedPasswordInput = React.forwardRef<HTMLInputElement, Omit<InputProps, 'type'>>(
  ({ className, ...props }, ref) => {
    const [showPassword, setShowPassword] = React.useState(false);
    const [isFocused, setIsFocused] = React.useState(false);
    const [validations, setValidations] = React.useState<Validation[]>(DEFAULT_VALIDATIONS);

    const handleFocus = () => setIsFocused(true);
    const handleBlur = () => setIsFocused(false);

    function handleInputChange(inputVal: string) {
      const newValidations = [...DEFAULT_VALIDATIONS];
      const currentInput = inputVal;

      newValidations.forEach((validation) => {
        validation.success = false;
      });
      PASSWORD_REGEX.UPPER_CASE.test(currentInput) && (newValidations[0].success = true);
      PASSWORD_REGEX.LOWER_CASE.test(currentInput) && (newValidations[1].success = true);
      PASSWORD_REGEX.NUMBER.test(currentInput) && (newValidations[2].success = true);
      PASSWORD_REGEX.SPECIAL_CHARACTER.test(currentInput) && (newValidations[3].success = true);
      currentInput.length >= 8 && currentInput.length <= 72 && (newValidations[4].success = true);

      setValidations(newValidations);
    }

    const validationHints = (
      <ul className="-ml-1 max-w-xs py-4 pr-4">
        {validations.map((validation, index) => (
          <li
            key={index}
            className={`${
              validation.success ? 'text-green-500' : 'text-muted-foreground'
            } ml-3 flex items-center text-xs font-medium`}
            style={{ whiteSpace: 'nowrap' }}
          >
            {validation.success ? (
              <Check className="my-1 mr-2 h-4 w-4 text-green-500 " />
            ) : (
              <Dot className="text-muted-foreground" />
            )}
            {validation.hint}
          </li>
        ))}
      </ul>
    );

    return (
      <div className="relative">
        <Input
          type={showPassword ? 'text' : 'password'}
          className={cn('pr-10', className)}
          ref={ref}
          {...props}
          value={props.value}
          onChange={(e) => {
            props.onChange && props.onChange(e);
            handleInputChange(e.target.value);
          }}
          onFocus={handleFocus}
          onBlur={handleBlur}
        />

        {isFocused && (
          <div className="absolute -top-[5.25rem] right-1/2 flex -translate-y-1/2 transform items-center justify-center max-lg:left-1/2 max-lg:flex-col lg:right-full lg:top-1/2">
            <div className="z-50 -mr-1 rounded-md bg-gray-50 shadow dark:bg-neutral-900 max-lg:-mb-1">
              {validationHints}
            </div>
            <GoTriangleRight className="max-lg:hidden" />
            <GoTriangleDown className="lg:hidden" />
          </div>
        )}

        <Button
          variant="link"
          type="button"
          className="absolute right-0 top-0 flex h-full items-center justify-center pr-3"
          aria-label={showPassword ? 'Mask password' : 'Reveal password'}
          onClick={() => setShowPassword((show) => !show)}
        >
          {showPassword ? (
            <EyeOff aria-hidden className="text-muted-foreground h-5 w-5" />
          ) : (
            <Eye aria-hidden className="text-muted-foreground h-5 w-5" />
          )}
        </Button>
      </div>
    );
  },
);

HintedPasswordInput.displayName = 'HintedPasswordInput';

export { HintedPasswordInput };
