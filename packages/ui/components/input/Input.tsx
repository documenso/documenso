import React, { InputHTMLAttributes, ReactNode, forwardRef, useId } from "react";
import { classNames } from "@documenso/lib";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  labelSrOnly?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>((props, ref) => {
  const { label, labelSrOnly, className, ...rest } = props;
  const id = useId();

  return (
    <div>
      {label && (
        <label
          htmlFor={id}
          className={classNames(
            "mb-1 block text-sm font-medium text-gray-700",
            labelSrOnly && "sr-only"
          )}>
          {label}
        </label>
      )}
      <input
        id={id}
        ref={ref}
        {...rest}
        className={classNames(
          "focus:border-neon focus:ring-neon block w-full rounded-md border border-gray-300 py-2 px-3 shadow-sm focus:outline-none sm:text-sm",
          className
        )}
      />
    </div>
  );
});
