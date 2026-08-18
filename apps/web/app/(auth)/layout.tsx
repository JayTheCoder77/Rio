import React from "react";
import { VideoPlaceholder } from "@/components/marketing/video-placeholder";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-2">
      {/* Left: product demo video placeholder (hidden on mobile) */}
      <div className="hidden border-r border-border p-8 lg:block">
        <VideoPlaceholder label="Login page video placeholder" />
      </div>

      {/* Right: login content, vertically centered */}
      <div className="flex items-center justify-center px-4 py-16">
        {children}
      </div>
    </div>
  );
}