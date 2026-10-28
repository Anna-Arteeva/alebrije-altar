import type { Metadata } from "next";
import { CharacterPreview } from "@/components/character/CharacterPreview";

export const metadata: Metadata = {
  title: "Meet your alebrije · Character study",
  description: "Explore a hand-painted alpaca alebrije in three dimensions.",
};

export default function CharacterPage() {
  return <CharacterPreview />;
}
