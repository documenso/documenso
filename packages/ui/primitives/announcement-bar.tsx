import Link from 'next/link';

import { cn } from '../lib/utils';

interface AnnouncementBarProps {
  isShown: boolean;
  className: string;
}

export const AnnouncementBar: React.FC<AnnouncementBarProps> = ({ isShown, className }) => {
  return (
    isShown && (
      <div
        className={cn(
          'flex h-full w-full items-center justify-center gap-4 border-b-2 p-1',
          className,
        )}
      >
        <div className="text-center">
          <span className="text-sm text-white">Claim your documenso public profile URL now!</span>{' '}
          <span className="text-sm font-medium text-white">documenso.com/u/yourname</span>
        </div>

        <div className="flex items-center justify-center gap-4 rounded-lg bg-white px-3 py-1">
          <div className="text-xs text-gray-900">
            <Link href="https://app.documenso.com">Claim now</Link>
          </div>
        </div>
      </div>
    )
  );
};
