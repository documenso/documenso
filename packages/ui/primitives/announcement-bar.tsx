import Link from 'next/link';

interface AnnouncementBarProps {
  isShown: boolean;
}

export const AnnouncementBar: React.FC<AnnouncementBarProps> = ({ isShown }) => {
  return (
    isShown && (
      <div className="flex h-full w-full items-center justify-center gap-4 border-b-2 bg-green-400 p-1">
        <div className="text-center">
          <span className="text-sm text-gray-800">
            Claim your documenso public profile URL now!
          </span>{' '}
          <span className="text-sm font-medium text-gray-800">documenso.com/u/yourname</span>
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
