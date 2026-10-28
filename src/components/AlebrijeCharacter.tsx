"use client";

import Image from "next/image";
import { AlebrijeAvatar } from "@/components/AlebrijeAvatar";
import type { Alebrije } from "@/lib/types";

// Where the alebrije appears in a conversation. The animated character is
// still being made; until it lands here, Alebrije is its reference painting,
// framed around the head, breathing gently and leaning in while it thinks.
// Alebrijes born from the form keep their own painted portrait.

export type CharacterState = "idle" | "listening" | "thinking" | "speaking";

export function AlebrijeCharacter({
  alebrije,
  state = "idle",
  size = 56,
}: {
  alebrije: Pick<Alebrije, "name" | "imageId" | "traits">;
  state?: CharacterState;
  size?: number;
}) {
  if (alebrije.imageId || alebrije.traits.animal) return <AlebrijeAvatar alebrije={alebrije} size={size} />;

  return (
    <span
      className="alebrije-character"
      data-state={state}
      style={{ "--avatar-size": `${size}px` } as React.CSSProperties}
      role="img"
      aria-label={state === "thinking" ? `${alebrije.name} is thinking` : `${alebrije.name}, your alebrije guide`}
    >
      <Image src="/character/reference.png" alt="" width={1139} height={1381} sizes={`${size * 3}px`} priority />
    </span>
  );
}
