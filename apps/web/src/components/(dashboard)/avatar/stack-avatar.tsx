import { Avatar, AvatarFallback } from '@documenso/ui/primitives/avatar';

const ZIndexes: { [key: string]: string } = {
  '10': 'z-10',
  '20': 'z-20',
  '30': 'z-30',
  '40': 'z-40',
  '50': 'z-50',
};

export type StackAvatarProps = {
  first?: boolean;
  zIndex?: string;
  fallbackText?: string;
  type: 'unsigned' | 'waiting' | 'opened' | 'completed';
};

export const StackAvatar = ({ first, zIndex, fallbackText = '', type }: StackAvatarProps) => {
  let classes = '';
  let zIndexClass = '';
  const firstClass = first ? '' : '-ml-3';

  if (zIndex) {
    zIndexClass = ZIndexes[zIndex] ?? '';
  }

  switch (type) {
    case 'unsigned':
      classes = 'bg-dawn-200 text-dawn-900';
      break;
    case 'opened':
      classes = 'bg-yellow-200 text-yellow-700';
      break;
    case 'waiting':
      classes = 'bg-water text-water-700';
      break;
    case 'completed':
      classes = 'bg-documenso-200 text-documenso-800';
      break;
    default:
      break;
  }

  return (
    <Avatar
      className={`
        ${zIndexClass}
        ${firstClass}
        dark:border-border h-10 w-10 border-2 border-solid border-white`}
    >
      <AvatarFallback className={classes}>{fallbackText}</AvatarFallback>
    </Avatar>
  );
};
