import type { Metadata } from "next";
import type { ReactNode } from "react";

import { SITE_DESCRIPTION, SITE_NAME } from "@/shared/constants";

import "./styles.css";

export const metadata: Metadata = {
  title: SITE_NAME,
  description: SITE_DESCRIPTION,
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
