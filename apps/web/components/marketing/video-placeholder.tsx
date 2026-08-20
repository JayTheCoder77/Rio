import Image from "next/image";

import { Play } from "lucide-react";

export function VideoPlaceholder({
  label,
  className,
  videoSrc,
  imageSrc,
  imageSrcDark,
  imageAlt,
  priority,
}: {
  label: string;
  className?: string;
  videoSrc?: string;
  imageSrc?: string;
  imageSrcDark?: string;
  imageAlt?: string;
  priority?: boolean;
}) {
  return (
    <div
      className={
        "overflow-hidden rounded-2xl border border-border bg-card shadow-[0_20px_60px_-20px_rgba(15,23,42,0.15)] " +
        (className ?? "")
      }
    >
      <div className="relative flex items-center border-b border-border bg-muted/50 px-4 py-3">
        <div className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-[#ff5f57]" />
          <span className="size-2.5 rounded-full bg-[#febc2e]" />
          <span className="size-2.5 rounded-full bg-[#28c840]" />
        </div>
        <span className="absolute left-1/2 -translate-x-1/2 text-xs font-medium text-muted-foreground">
          Rio
        </span>
      </div>

      <div className="relative flex aspect-video flex-col items-center justify-center gap-3">
        {videoSrc ? (
          <video
            src={videoSrc}
            autoPlay
            muted
            loop
            playsInline
            className="aspect-video w-full object-cover"
          />
        ) : imageSrc ? (
          imageSrcDark ? (
            <>
              <Image
                src={imageSrc}
                alt={imageAlt ?? label}
                fill
                sizes="(min-width: 768px) 1152px, 100vw"
                className="object-cover dark:hidden"
                priority={priority}
              />
              <Image
                src={imageSrcDark}
                alt={imageAlt ?? label}
                fill
                sizes="(min-width: 768px) 1152px, 100vw"
                className="hidden object-cover dark:block"
                priority={priority}
              />
            </>
          ) : (
            <Image
              src={imageSrc}
              alt={imageAlt ?? label}
              fill
              sizes="(min-width: 768px) 1152px, 100vw"
              className="object-cover"
              priority={priority}
            />
          )
        ) : (
          <>
            <span className="flex size-12 items-center justify-center rounded-full bg-muted">
              <Play className="size-5 text-muted-foreground" />
            </span>
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
          </>
        )}
      </div>
    </div>
  );
}