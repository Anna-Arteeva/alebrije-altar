import assert from 'node:assert/strict';
import { activePersonId, peopleOnAltar, personConversation, PERSON_MARKER } from '../src/lib/people.ts';
import type { AltarState, ChatMessage } from '../src/lib/types.ts';

const rosa = { id: 'rosa', name: 'Rosa', isChild: false, photoId: 'original-photo' };
const mateo = { id: 'mateo', name: 'Mateo', isChild: false };
const messages: ChatMessage[] = [
  { id: '1', role: 'user', text: 'Rosa loved guitar.', createdAt: 1 },
  { id: '2', role: 'note', text: PERSON_MARKER + mateo.id, createdAt: 2 },
  { id: '3', role: 'user', text: 'Mateo loved lemons.', createdAt: 3 },
];
const altar: AltarState = { version: 1, id: 'altar', createdAt: 1, mood: 'festive', lovedOne: mateo, people: [rosa], alebrije: null, elements: [], memories: [], objects: [], messages };
assert.deepEqual(peopleOnAltar(altar), [rosa, mateo]);
assert.equal(peopleOnAltar(altar)[0].photoId, 'original-photo');
assert.equal(activePersonId(messages), 'mateo');
assert.deepEqual(personConversation(messages).map((m) => m.id), ['2', '3']);
assert.equal(activePersonId(messages.slice(0, 1)), undefined);
assert.deepEqual(personConversation(messages.slice(0, 1)), messages.slice(0, 1));
assert.deepEqual(peopleOnAltar({ ...altar, people: [rosa, { ...mateo, name: 'Old name' }] }), [rosa, mateo]);
console.log('7 multi-person compatibility and conversation-isolation checks passed.');
