"use client";

import { useBlobUrl } from "@/lib/store/altar-store";
import type { Alebrije } from "@/lib/types";

// The alebrije's portrait, or a patterned placeholder with its initial while
// the painting is missing.

export function AlebrijeAvatar({
  alebrije,
  size = 48,
  painting = false,
}: {
  alebrije: Pick<Alebrije, "name" | "imageId">;
  size?: number;
  painting?: boolean;
}) {
  const url = useBlobUrl(alebrije.imageId);

  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- local blob URL
      <img
        src={url}
        alt={`${alebrije.name}, your alebrije guide`}
        width={size}
        height={size}
        className="alebrije-avatar shrink-0 rounded-full bg-marigold-tint object-contain"
        style={{ "--avatar-size": `${size}px` } as React.CSSProperties}
      />
    );
  }

  return (
    <div
      role="img"
      aria-label={painting ? `${alebrije.name} is being painted` : alebrije.name}
      className={`alebrije-avatar grid shrink-0 place-items-center rounded-full font-display text-paper-raised ${painting ? "skeleton" : "alebrije-placeholder"}`}
      style={{ "--avatar-size": `${size}px` } as React.CSSProperties}
    >
      {!painting && alebrije.name.charAt(0)}
    </div>
  );
}
