import type { Metadata } from "next";
import { OfrendaHome } from "@/components/OfrendaHome";

export const metadata: Metadata = { title: "Your ofrenda · Alebrije Altar" };

export default function AltarPage() {
  return <OfrendaHome />;
}
