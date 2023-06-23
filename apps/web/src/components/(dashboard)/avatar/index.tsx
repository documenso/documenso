import { Avatar, AvatarFallback } from '@documenso/ui/primitives/avatar';

export type StackAvatarProps = {
  first?: boolean;
  zIndex?: string;
  fallbackText?: string;
  type: 'unsigned' | 'waiting' | 'completed';
};

export const StackAvatar = ({ first, zIndex, fallbackText, type }: StackAvatarProps) => {
  let classes = '';
  switch (type) {
    case 'unsigned':
      classes = 'bg-dawn-400 text-dawn-900';
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
        ${zIndex && `z-${zIndex}`} 
        ${!first && '-ml-3'} 
        h-10 w-10 border-2 border-solid border-white `}
    >
      <AvatarFallback className={classes}>{fallbackText ?? 'UK'}</AvatarFallback>
    </Avatar>
  );
};
