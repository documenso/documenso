import { Footer } from '~/components/(marketing)/footer';
import { LayoutHeader } from '~/components/(marketing)/layout-header';

export type MarketingLayoutProps = {
  children: React.ReactNode;
};

export default function MarketingLayout({ children }: MarketingLayoutProps) {
  return (
    <div className="relative flex min-h-[100vh] max-w-[100vw] flex-col overflow-y-auto overflow-x-hidden pt-20 md:pt-28">
      <LayoutHeader />

      <div className="relative max-w-screen-xl flex-1 px-4 sm:mx-auto lg:px-8">{children}</div>

      <Footer className="bg-background border-muted mt-24 border-t" />
    </div>
  );
}
