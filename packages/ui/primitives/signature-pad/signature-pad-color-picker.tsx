import { Trans } from '@lingui/react/macro';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@documenso/ui/primitives/select';

import { cn } from '../../lib/utils';

export type SignaturePadColorPickerProps = {
  selectedColor: string;
  setSelectedColor: (color: string) => void;
  className?: string;
};

export const SignaturePadColorPicker = ({
  selectedColor,
  setSelectedColor,
  className,
}: SignaturePadColorPickerProps) => {
  return (
    <div className={cn('text-foreground absolute right-2 top-2 filter', className)}>
      <Select defaultValue={selectedColor} onValueChange={(value) => setSelectedColor(value)}>
        <SelectTrigger className="h-auto w-auto border-none p-0.5">
          <SelectValue placeholder="" />
        </SelectTrigger>

        <SelectContent className="w-[100px]" align="end">
          <SelectItem value="black">
            <div className="text-muted-foreground flex items-center text-[0.688rem]">
              <div className="border-border mr-1 h-4 w-4 rounded-full border-2 bg-black shadow-sm" />
              <Trans>Black</Trans>
            </div>
          </SelectItem>

          <SelectItem value="red">
            <div className="text-muted-foreground flex items-center text-[0.688rem]">
              <div className="border-border mr-1 h-4 w-4 rounded-full border-2 bg-[red] shadow-sm" />
              <Trans>Red</Trans>
            </div>
          </SelectItem>

          <SelectItem value="blue">
            <div className="text-muted-foreground flex items-center text-[0.688rem]">
              <div className="border-border mr-1 h-4 w-4 rounded-full border-2 bg-[blue] shadow-sm" />
              <Trans>Blue</Trans>
            </div>
          </SelectItem>

          <SelectItem value="green">
            <div className="text-muted-foreground flex items-center text-[0.688rem]">
              <div className="border-border mr-1 h-4 w-4 rounded-full border-2 bg-[green] shadow-sm" />
              <Trans>Green</Trans>
            </div>
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
};
