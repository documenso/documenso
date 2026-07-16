import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <span className="flex items-center gap-2 font-semibold">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 79 108" className="h-6 w-auto">
            <path
              fill="currentColor"
              d="M1527.531,1205.49C1525.636,1208.311 1522.794,1213.585 1522.794,1213.585C1538.769,1204.643 1671.181,1124.666 1664,934L1616,971C1616,971 1626.117,994.032 1619,1020C1619,1020 1612.022,973.026 1607,982C1607,982 1580.661,1014.807 1570,1077C1570,1077 1582.109,1086.941 1574,1117C1574,1117 1578.822,1086.314 1564,1084C1564,1084 1570.982,1140.813 1527.531,1205.49Z"
              transform="matrix(-0.195024,-0.378544,-0.378544,0.195024,756.376578,447.744850)"
            />
          </svg>
          Keep Contracts
        </span>
      ),
    },
    githubUrl: 'https://github.com/documenso/documenso',
  };
}
