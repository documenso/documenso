import type { RecipientRole } from '@prisma/client';
import { BadgeCheck, Copy, Eye, PencilLine, User } from 'lucide-react';

export const ROLE_ICONS: Record<RecipientRole, JSX.Element> = {
  SIGNER: <PencilLine className="h-4 w-4" />,
  APPROVER: <BadgeCheck className="h-4 w-4" />,
  CC: <Copy className="h-4 w-4" />,
  VIEWER: <Eye className="h-4 w-4" />,
  ASSISTANT: <User className="h-4 w-4" />,
};
