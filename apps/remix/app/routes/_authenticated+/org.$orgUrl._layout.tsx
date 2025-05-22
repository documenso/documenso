import { Outlet } from 'react-router';

export default function Layout() {
  return (
    <div className="mx-auto w-full max-w-screen-xl px-4 md:px-8">
      <Outlet />
    </div>
  );
}
