import type { Metadata } from "next";
import { Onboarding } from "@/components/Onboarding";

export const metadata: Metadata = { title: "Start an altar · Alebrije Altar" };

export default function NewAltarPage() {
  return <Onboarding />;
}
