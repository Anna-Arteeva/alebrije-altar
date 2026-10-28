import type { Metadata } from "next";
import { OfrendaHome } from "@/components/OfrendaHome";

export const metadata: Metadata = { title: "Start an altar with Alebrije · Alebrije Altar" };

export default function TalkPage() {
  return <OfrendaHome />;
}
