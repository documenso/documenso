import { Welcome } from '../welcome/welcome';
import type { Route } from './+types/home';

export function meta({}: Route.MetaArgs) {
  return [
    { title: 'New React Router App' },
    { name: 'description', content: 'Welcome to React Router!' },
  ];
}

export const loader = () => {
  return {
    message: 'Hello World' as const,
  };
};

export default function Home() {
  return <Welcome />;
}
