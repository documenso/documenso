import * as React from 'react';

import * as PopoverPrimitive from '@radix-ui/react-popover';

import { cn } from '../lib/utils';

const Popover = PopoverPrimitive.Root;

const PopoverTrigger = PopoverPrimitive.Trigger;

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = 'center', sideOffset = 4, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        'bg-popover text-popover-foreground animate-in data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 w-72 rounded-md border p-4 shadow-md outline-none',
        className,
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
));

PopoverContent.displayName = PopoverPrimitive.Content.displayName;

type PopoverHoverProps = {
  trigger: React.ReactNode;
  children: React.ReactNode;
  contentProps?: React.ComponentPropsWithoutRef<typeof PopoverContent>;
};

const PopoverHover = ({ trigger, children, contentProps }: PopoverHoverProps) => {
  const [open, setOpen] = React.useState(false);

  const isControlled = React.useRef(false);
  const isMouseOver = React.useRef<boolean>(false);

  const onMouseEnter = () => {
    isMouseOver.current = true;

    if (isControlled.current) {
      return;
    }

    setOpen(true);
  };

  const onMouseLeave = () => {
    isMouseOver.current = false;

    if (isControlled.current) {
      return;
    }

    setTimeout(() => {
      setOpen(isMouseOver.current);
    }, 200);
  };

  const onOpenChange = (newOpen: boolean) => {
    isControlled.current = newOpen;

    setOpen(newOpen);
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger
        className="flex cursor-pointer outline-none"
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        {trigger}
      </PopoverTrigger>

      <PopoverContent
        side="top"
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        {...contentProps}
      >
        {children}
      </PopoverContent>
    </Popover>
  );
};

export { Popover, PopoverTrigger, PopoverContent, PopoverHover };
