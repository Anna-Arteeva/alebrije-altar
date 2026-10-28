import type { Metadata } from "next";
import { Atkinson_Hyperlegible_Next, Young_Serif } from "next/font/google";
import { ServiceNotice } from "@/components/ServiceNotice";
import "./globals.css";

const display = Young_Serif({
  variable: "--type-display",
  weight: "400",
  subsets: ["latin", "latin-ext"],
});

const body = Atkinson_Hyperlegible_Next({
  variable: "--type-body",
  subsets: ["latin", "latin-ext"],
  adjustFontFallback: false,
  fallback: ["system-ui", "sans-serif"],
});

export const metadata: Metadata = {
  title: "Alebrije Altar",
  description:
    "Build a Día de Muertos ofrenda for someone you love, guided by a friendly alebrije.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <ServiceNotice />
        {children}
      </body>
    </html>
  );
}
