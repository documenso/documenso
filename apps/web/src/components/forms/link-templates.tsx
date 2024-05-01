'use client';

import { File } from 'lucide-react';

import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';

export const LinkTemplatesForm = () => {
  return (
    <div className={cn('flex max-w-xl flex-row items-center justify-between')}>
      <div>
        <h3 className="text-lg font-medium">My templates</h3>

        <p className="text-muted-foreground text-sm md:mt-2">
          Create templates to display in your public profile
        </p>
      </div>

      <div>
        <Button type="submit" variant="outline" className="self-end p-4">
          <File className="mr-2" /> Link template
        </Button>
      </div>
    </div>
  );
};
