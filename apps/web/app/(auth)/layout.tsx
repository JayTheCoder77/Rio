import React from "react";
import { BubbleBackground } from "@/components/animate-ui/components/backgrounds/bubble";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-2">
      {/* Left: animated bubble background (hidden on mobile) */}
      <div className="hidden border-r border-border lg:block">
        <BubbleBackground interactive className="h-full" />
      </div>

      {/* Right: login content, vertically centered */}
      <div className="flex items-center justify-center px-4 py-16">
        {children}
      </div>
    </div>
  );
}