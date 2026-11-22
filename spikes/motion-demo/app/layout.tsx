import "@iserlabs/web-kit/motion/css";
import { MotionProvider, PageTransitions } from "@iserlabs/web-kit/motion";
import type { ReactNode } from "react";

export const metadata = { title: "Motion kit demo", description: "One page per part of the web-kit motion kit." };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "Georgia, serif", background: "#f6f1e8", color: "#2a2118" }}>
        <MotionProvider smoothScroll>
          <PageTransitions>{children}</PageTransitions>
        </MotionProvider>
      </body>
    </html>
  );
}
