import { Metadata } from "next";
import { Montserrat, Qwigley } from "next/font/google";
import { cn } from "../lib/utils";
import "../styles/tailwind.css";

export const metadata: Metadata = {
  title: {
    default: "Documenso",
    template: "%s | Documenso",
  },
};

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
  variable: "--font-sans",
});

const qwigley = Qwigley({
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
  variable: "--font-qwigley",
});

interface RootLayoutProps {
  children: React.ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body
        className={cn(
          "bg-background min-h-screen font-sans antialiased",
          montserrat.variable,
          qwigley.variable
        )}>
        {children}
      </body>
    </html>
  );
}
