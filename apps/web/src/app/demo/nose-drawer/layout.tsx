import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Nose Drawing Demo',
  description: 'Draw with your nose using face detection technology',
};

export default function NoseDrawerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
