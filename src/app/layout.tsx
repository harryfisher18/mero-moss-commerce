import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Mero & Moss — Well-made essentials for everyday living",
    template: "%s · Mero & Moss",
  },
  description:
    "Mero & Moss sells considered home organization, table and kitchen, workspace and travel essentials.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
