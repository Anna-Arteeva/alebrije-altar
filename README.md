# Alebrije Altar

A friendly alebrije guide helps you build a Día de Muertos ofrenda for someone you love, through conversation. An educational project showing AI working inside a product: an LLM agent with tool calls that edit the altar, and image generation for the guide, objects and memories.

## Setup

```bash
npm install
cp .env.example .env.local   # optional: add your OPENAI_API_KEY and Supabase URL + publishable key
npm run dev
```

### Running without keys

Every key is optional, and the app runs with none of them, in a "demo mode" that a small notice explains:

- **No OpenAI key:** the 3D ofrenda, the traditional elements, the starter objects and adding memories by hand all work. Alebrije's conversation is replaced by a note, painting buttons are hidden, and the form at `/new` makes a plain guide from your answers. The API routes answer `503 { code: "ai_unavailable" }`, and `GET /api/status` tells the browser up front.
- **No Supabase:** the altar and its photos are kept in this browser's IndexedDB. If you add Supabase later, that altar is uploaded once, on the next visit.

To set up Supabase yourself, create a project, enable anonymous sign-ins, and run the SQL in `supabase/migrations/` (in the SQL editor, or with `supabase link` then `supabase db push`).

Optional, once: paint the eight traditional elements in the house style (otherwise simple drawn glyphs are used).

```bash
npm run art:elements
```

## How it works

- **Altar data is stored in Supabase** (or this browser, without it): the altar, memories, objects and conversation in tables, and photos and generated images in the private `altar-media` bucket. Each browser signs in as an anonymous Supabase user, and Row Level Security keeps every altar private to its owner. The schema is in `supabase/migrations/`. Export or delete everything from the altar's menu.
- **`/api/chat`** runs the alebrije's agent loop with the OpenAI Responses API: it streams the reply, validates each tool call (`add_memory`, `suggest_object`, `illustrate_memory`, `add_traditional_element`, `pause_conversation`, `show_support_resources`) and streams it to the browser as an action. Proposals show as confirm cards; nothing is placed without a yes.
- **`/api/alebrije`** turns the three onboarding answers into a name, intro and look.
- **`/api/image`** paints with a server-built prompt (house style plus guards: no people, no horror, no film references).
- The persona and guardrails live in `src/lib/ai/system-prompt.ts`; cultural content in `src/content/ofrenda.ts`.
- The central portrait is never sent to the AI. Photos attached in chat are sent once, downscaled, so the alebrije can ask about them.

## Checking the guardrails

With the dev server running:

```bash
npm run check:guardrails http://localhost:3001
```

It sends red-team messages (impersonation, "messages from beyond", cause of death, distress, face illustration, film references) and prints each reply and tool call for review.

## Not in this repository

Reference images and the source sculpture (`altar/`, `photo-placeholders/`, the JPGs in `illustration-style/`) are kept out of git, so `npm run art:altar` needs your own `altar/diademuertos_ofrenda_altar_v1.stl`. The converted `public/altar/ofrenda-altar.glb` is included.

## Before sharing publicly

- Keep the deployment private (Vercel deployment protection): the API routes have no auth and spend OpenAI credits.
- Have someone from Mexican culture review the content.
