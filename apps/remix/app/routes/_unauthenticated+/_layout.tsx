import { Outlet } from 'react-router';

import backgroundPattern from '@documenso/assets/images/background-pattern.png';

export default function Layout() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-12 md:p-12 lg:p-24">
      <div>
        <div className="absolute -inset-[min(600px,max(400px,60vw))] -z-[1] flex items-center justify-center opacity-70">
          <img
            src={backgroundPattern}
            alt="background pattern"
            className="dark:brightness-95 dark:contrast-[70%] dark:invert dark:sepia"
            style={{
              mask: 'radial-gradient(rgba(255, 255, 255, 1) 0%, transparent 80%)',
              WebkitMask: 'radial-gradient(rgba(255, 255, 255, 1) 0%, transparent 80%)',
            }}
          />
        </div>

        <div className="relative w-full">
          <Outlet />
        </div>
      </div>
    </main>
  );
}
