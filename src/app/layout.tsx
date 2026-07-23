import type { Metadata } from "next";
import type { ReactNode } from "react";

import { SITE_DESCRIPTION, SITE_NAME } from "@/shared/constants";
import { PwaRegister } from "@/shared/ui";

import "./styles.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
  title: SITE_NAME,
  description: SITE_DESCRIPTION,
  icons: { icon: "/assets/smansa-logo.webp" },
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="id" data-scroll-behavior="smooth">
      <body>
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
