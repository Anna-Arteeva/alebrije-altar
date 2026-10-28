import type { AltarState, ChatMessage } from './types';

// Session boundaries keep each person's interview context separate without
// discarding the shared conversation or requiring a database migration.
export const PERSON_MARKER = 'Remembering person: ';
export function peopleOnAltar(altar: AltarState) {
  return [...(altar.people ?? []).filter((p) => p.id !== altar.lovedOne.id), altar.lovedOne];
}
export function activePersonId(messages: { role: string; text: string }[]) {
  return messages.findLast((m) => m.role === 'note' && m.text.startsWith(PERSON_MARKER))?.text.slice(PERSON_MARKER.length);
}
export function personConversation(messages: ChatMessage[]) {
  const start = messages.findLastIndex((m) => m.role === 'note' && m.text.startsWith(PERSON_MARKER));
  return messages.slice(Math.max(0, start));
}
