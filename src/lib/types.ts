// Data model for one altar. It is stored in Supabase (see store/db.ts).
// Binary data (photos, generated images) is stored separately as files and
// referenced here by id.

export type Mood = "festive" | "quiet";

export const ELEMENT_KEYS = [
  "cempasuchil",
  "candles",
  "water",
  "salt",
  "copal",
  "papel_picado",
  "pan_de_muerto",
  "calaveritas",
] as const;

export type ElementKey = (typeof ELEMENT_KEYS)[number];

export const PRONOUNS = ["she", "he", "they"] as const;
export type Pronouns = (typeof PRONOUNS)[number];

// The interview's steps, in order. The welcome comes before them and the
// goodbye after.
export const INTERVIEW_STEPS = ["who", "photo", "objects", "memories", "elements"] as const;
export type InterviewStep = (typeof INTERVIEW_STEPS)[number];

export interface LovedOne {
  id: string;
  name: string;
  relation?: string;
  isChild: boolean;
  photoId?: string;
  pronouns?: Pronouns;
}

export interface Alebrije {
  name: string;
  traits: { animal: string; color: string; place: string };
  intro: string;
  personality: string;
  imageSubject: string;
  imageId?: string;
}

export type ImageStatus = "none" | "pending" | "done" | "error";

export interface Memory {
  id: string;
  lovedOneId: string;
  type: "text" | "photo";
  text: string;
  mediaId?: string;
  illustrate: boolean;
  illustrationPrompt?: string;
  illustrationId?: string;
  illustrationStatus: ImageStatus;
  createdAt: number;
  source: "chat" | "manual";
}

export interface AltarObject {
  id: string;
  lovedOneId: string;
  name: string;
  description: string;
  imageSubject: string;
  imageId?: string;
  // A ready-made painting from the starter set, served from /public.
  imageSrc?: string;
  imageStatus: ImageStatus;
  createdAt: number;
}

export type CardState = "proposed" | "accepted" | "declined";

// Things the alebrije's tool calls attach to its chat messages.
export type ChatCard =
  | { kind: "memory"; memoryId: string }
  | {
      kind: "object";
      callId: string;
      name: string;
      description: string;
      imageSubject: string;
      state: CardState;
      objectId?: string;
    }
  | {
      kind: "illustrate";
      callId: string;
      memoryId: string;
      prompt: string;
      state: CardState;
    }
  | {
      kind: "element";
      callId: string;
      element: ElementKey;
      reason: string;
      state: CardState;
    }
  | { kind: "pause"; callId: string; reason: string; state: CardState }
  | { kind: "support"; callId: string }
  // Interview cards.
  | {
      kind: "choices";
      callId: string;
      mode: "yes_no" | "single" | "multi";
      options: string[];
      allowFreeText: boolean;
      answered: boolean;
    }
  | { kind: "photo"; callId: string; state: CardState }
  | { kind: "starter-objects"; callId: string; preselect: string[]; picked?: string[] }
  | {
      kind: "objects";
      callId: string;
      objects: { name: string; description: string; imageSubject: string }[];
      state: CardState;
    }
  | { kind: "memories"; memoryIds: string[] }
  | { kind: "elements-pick"; callId: string; elements: ElementKey[]; picked?: ElementKey[] }
  | { kind: "finish"; callId: string };

export interface ChatMessage {
  id: string;
  // "note" messages are invisible context for the model, such as
  // "the user placed the blue thermos on the altar".
  role: "user" | "assistant" | "note";
  text: string;
  photoId?: string;
  cards?: ChatCard[];
  skipped?: boolean;
  createdAt: number;
}

export interface AltarState {
  version: 1;
  id: string;
  createdAt: number;
  mood: Mood;
  lovedOne: LovedOne;
  // Previously welcomed people; lovedOne remains the active conversation.
  people?: LovedOne[];
  alebrije: Alebrije | null;
  elements: ElementKey[];
  memories: Memory[];
  objects: AltarObject[];
  messages: ChatMessage[];
  // Altars started by talking: "interview" until the user opens the altar.
  stage?: "interview" | "altar";
  interview?: { done: InterviewStep[] };
}
