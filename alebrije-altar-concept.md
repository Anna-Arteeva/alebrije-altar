# Alebrije Altar: App Concept

*Working title. Starting point for building.*

## One-liner

A friendly alebrije guide helps you build a Día de Muertos altar for the people you love, through conversation. Every story you share becomes a memory on the altar, and many of them come to life as illustrations.

## Context

- **Type:** educational project demonstrating AI functionality in a product.
- **Audience:** anyone who wants to remember someone. Universal, not tied to one person or one culture, with a festive tone that also holds space for people who are grieving.
- **Theme:** Día de Muertos (Mexico, Nov 1 and 2), inspired by the spirit of Pixar's Coco: remembrance, family stories, music, alebrijes as guides.
- **AI features shown:**
  - Conversational LLM agent with tool calls that edit the altar
  - Image generation for objects, memories and the alebrije
  - Speech-to-text for voice notes
  - Optional text-to-speech for the alebrije's voice

## Core experience

1. **Start an altar.** The user names who it is for and adds a real photo of them (optional).
2. **Meet the alebrije.** The guide is born from 3 quick questions (for example: an animal they loved, a color, a place). It gets a name and a short intro.
3. **Talk.** The alebrije asks gentle questions, one at a time. The user answers by typing, speaking, or attaching a photo or voice note.
4. **The altar fills up.** Each answer becomes a memory. Tangible things become objects on the altar. The alebrije suggests, the user confirms.
5. **Revisit and add.** The user can come back, keep talking, or add things manually.

## Main components

### The alebrije (guide)

- A fantastical folk-art creature with its own name and personality. Warm, curious, a little playful.
- **Its role:** host and interviewer. It asks questions, listens, and helps place things on the altar.
- **It speaks only as itself.** It never speaks as, imitates, or channels the person being remembered.
- Generated once at the start from the 3 questions. Stretch goal: it evolves (gains patterns or colors) as the altar fills.

### The altar

- Center: the real photo of the person, unaltered. If there is no photo, a name card.
- Traditional elements, each with a short, tappable explanation of its meaning (see Cultural context).
- **Objects:** things that belonged to or represent the person, illustrated by image generation.
- **Memories:** stories, sayings, moments. Shown as cards, tags, or illustrated vignettes.

### Memories

Types:

- **Text:** typed answers in the chat or added manually.
- **Photo:** uploaded by the user. Kept as is, never edited by AI.
- **Voice note:** original audio kept untouched, plus a transcript so the alebrije can understand it and ask follow-ups.

Illustration rules:

| Memory content | Treatment |
|---|---|
| Objects, food, places, animals, simple scenes | Illustrate |
| Feelings, sayings, abstract or private memories | Keep as words (no image) |
| The person's face or body | Never generate. The real photo is the only image of them |

- The LLM proposes whether a memory gets an illustration. The user can always change it.
- Memory text stays in the user's own words, only lightly cleaned up (typos, transcript fillers). The AI never adds facts or embellishes.

## How the AI works

### Conversational agent (LLM with tools)

The alebrije is an LLM with a system prompt (persona plus safety rules) and tools that change the altar state. Each change that adds something visible is proposed and confirmed by the user.

Tool sketch:

```
add_memory(text, type: "text" | "photo" | "voice", source_message_id)
suggest_object(name, description)      // shows a confirm card: "Place her blue thermos on the altar?"
illustrate_memory(memory_id, prompt)   // only when the memory fits the illustration rules
add_traditional_element(element)       // e.g. "candle", "water", "marigolds", with its meaning
pause_conversation(reason)             // offers rest; used after several questions or when emotions run high
show_support_resources()               // used if acute distress is detected
```

### Image generation

- Objects and memory vignettes in one consistent style.
- The alebrije in its own consistent style.
- Prompt guards: no faces of real people, no horror elements, no references to Pixar or Coco.

### Speech-to-text

- Transcribes voice notes and optional voice input to the chat.
- The original audio is always stored and playable.

### Text-to-speech (optional)

- The alebrije can read its questions aloud in its own voice. Off by default.
- Never used to recreate or clone the voice of the person being remembered.

## Conversation design and safety

### Tone

- Warm, curious, lightly playful. Follows the user's mood: festive when they are, quiet when they are not.
- One question at a time. Short messages. Mirrors the user's words.

### Example questions

- What would you like me to call them?
- When you picture them happy, where are they?
- What did they always have with them?
- Was there a dish only they could make?
- What music do you hear when you think of them?
- What made them laugh?
- A small, ordinary moment you'd like to keep?
- Is there anything you'd like to tell them?

### Guardrails

- Never speaks as the deceased. Politely declines requests like "pretend to be my mom" and offers to help write a letter to her instead.
- Never asks how the person died. If the user brings it up, it listens without probing.
- Never invents memories, facts, or messages "from beyond".
- Offers a pause every few questions ("Shall we rest here?"). Every question can be skipped.
- Detects signs of acute distress and shows support resources (for Germany: Telefonseelsorge, 0800 111 0 111; localize for other regions).
- No streaks, guilt notifications, or engagement pressure.
- Children (Nov 1 is for angelitos): if the person remembered was a child, extra gentleness and no humor unless the user leads with it.

## Cultural context

### Día de Muertos in short

- A living Mexican tradition with Indigenous and Catholic roots, inscribed by UNESCO as Intangible Cultural Heritage (2008).
- Families believe the dead return for a visit. The living welcome them with an altar (ofrenda), food, music, flowers and stories.
- Tone: a reunion and a celebration, with grief, humor and warmth side by side.
- Calendar: Oct 31 the altar is prepared, Nov 1 is for children (angelitos), Nov 2 for adults. Practices vary by region and family.

### Ofrenda elements and meanings

| Element | Meaning |
|---|---|
| Photo | Shows whose spirit is being welcomed |
| Cempasúchil (marigolds) | Their color and scent guide spirits home; petals form a path |
| Candles | Light the way |
| Water | Quenches thirst after the long journey |
| Salt | Purification |
| Copal (incense) | Cleanses the space, carries prayers |
| Papel picado | Represents wind; its movement signals presence |
| Pan de muerto and favorite foods | Hospitality; earth |
| Calaveritas (sugar skulls) | Sweet reminder of mortality, often with names on them |
| Personal objects | What they loved, so they feel at home |

The altar gathers the four elements: water, wind, earth and fire. Altars may have one, two, three or seven levels; there is no single correct version.

### Alebrijes

- Created by Pedro Linares López, a papier-mâché artisan in Mexico City, after a fever dream in 1936. Later adapted into carved and painted wood in Oaxaca (Manuel Jiménez).
- Coco popularized them as spirit guides. In this app the alebrije is a guide for the living.
- Credit Pedro Linares and the artisan tradition inside the app (for example, an "About alebrijes" card).

### Terminology

- Use *Día de Muertos* (common in Mexico) or *Día de los Muertos* (common in the US).
- Use the Spanish terms (ofrenda, cempasúchil, papel picado, pan de muerto, calaverita) with short explanations.
- Say "in many homes" or "many families" rather than "Mexicans always".

## Boundaries

### Do

- Keep the real photo central and unedited.
- Explain the meaning of each traditional element.
- Credit people and places behind the tradition.
- Let users export everything (photos, audio, text, illustrations).
- Keep altars private by default.
- Have someone from Mexican culture review the content before sharing publicly.

### Don't

- Don't impersonate the deceased, clone their voice, or generate their face.
- Don't generate "messages from the dead".
- Don't mix in Halloween or horror elements (pumpkins, bats, blood, zombies).
- Don't turn people into Catrinas or sugar-skull faces (no "skull filter" features).
- Don't use Coco's characters, song, title, logo, or recognizable designs. No alebrije resembling Pepita (winged jaguar) or Dante (Xolo dog). No "Pixar style" or "Coco style" in prompts.
- Don't use the "being forgotten / final death" idea as a threat or motivator.
- Don't invent rituals (for example, sky lanterns) and present them as tradition.

### Privacy

- Memories are intimate data about the user and their family. Store minimally, private by default, deletable at any time.
- Don't use memories for anything beyond building the user's altar.

## Data model sketch

```
Altar
  id, owner_id, created_at
  loved_ones: [LovedOne]
  alebrije: Alebrije
  elements: [TraditionalElement]

LovedOne
  id, name, photo_url (optional), relation (optional), is_child (bool)

Alebrije
  name, traits (animal, color, place), image_url, personality_notes

Memory
  id, loved_one_id, type (text | photo | voice)
  text (user's words), media_url, transcript
  illustrate (bool), illustration_url
  created_at, source (chat | manual)

AltarObject
  id, loved_one_id, name, description, image_url, confirmed (bool)
```

## Scope

### MVP

- One altar, one loved one
- Alebrije born from 3 questions
- Chat with tool calls: add memory, suggest object, illustrate
- Text and photo memories
- Traditional elements with meanings
- Basic guardrails in the system prompt

### Next

- Voice notes with transcription
- Several loved ones on one altar (including pets)
- Alebrije that evolves as memories grow
- Alebrije voice (TTS)
- Export as a printable altar or memory book
- Shared altar: family members add memories via a private link

## Open decisions

- One loved one per altar, or several? (MVP: one; data model already supports several.)
- Alebrije born at the start or evolving? (MVP: born at the start.)
- Festive default with a quiet mode, or user picks the mood at the start?
- Language: English, Spanish, or both?
- Platform and stack.
