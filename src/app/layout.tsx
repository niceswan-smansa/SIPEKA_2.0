import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { SITE_DESCRIPTION, SITE_NAME } from "@/shared/constants";
import { PwaRegister } from "@/shared/ui";

import "./styles.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
  title: SITE_NAME,
  description: SITE_DESCRIPTION,
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      {
        url: "/assets/icons/favicon-32.png",
        sizes: "32x32",
        type: "image/png",
      },
      {
        url: "/assets/icons/sipeka-192.png",
        sizes: "192x192",
        type: "image/png",
      },
    ],
    apple: [
      {
        url: "/assets/icons/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
    shortcut: "/assets/icons/favicon-32.png",
  },
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#15458f",
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
