import { Suspense } from "react";
import { DemoNotice } from "@/components/store/demo-notice";
import { StoreAnnouncement } from "@/components/store/store-branding";
import { StoreFooter } from "@/components/store/store-footer";
import { StoreHeader } from "@/components/store/store-header";

export default function StoreLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-10 focus:bg-paper focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <DemoNotice />
      <Suspense fallback={null}>
        <StoreAnnouncement />
      </Suspense>
      <StoreHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <StoreFooter />
    </>
  );
}
