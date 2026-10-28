"use client";

import { useSyncExternalStore } from "react";
import { ElementArt } from "@/components/ElementArt";
import { ELEMENTS, supportLinesFor } from "@/content/ofrenda";
import { decideCard } from "@/lib/altar-actions";
import { InterviewCard } from "@/components/InterviewCards";
import { useBlobUrl } from "@/lib/store/altar-store";
import type { AgentChat } from "@/lib/use-chat";
import type { AltarState, ChatCard } from "@/lib/types";

// What the alebrije's tool calls look like in the conversation. Anything that
// adds something beyond the user's own words waits for their answer.

export function ChatCardView({
  card,
  messageId,
  altar,
  chat,
}: {
  card: ChatCard;
  messageId: string;
  altar: AltarState;
  chat: AgentChat;
}) {
  switch (card.kind) {
    case "memory": {
      const memory = altar.memories.find((m) => m.id === card.memoryId);
      if (!memory) return null;
      return (
        <Card tone="quiet">
          <p className="eyebrow text-ink-soft">Saved to the altar</p>
          <p className="mt-1 text-sm">&ldquo;{memory.text}&rdquo;</p>
        </Card>
      );
    }

    case "object":
      return (
        <Proposal
          state={card.state}
          question={`Place ${lowerFirst(card.name)} on the altar?`}
          detail={card.description}
          yes="Place it"
          acceptedText={`${card.name} is on the altar.`}
          declinedText="Not now."
          onDecide={(accept) => decideCard(messageId, card, accept)}
          art={<ObjectThumb objectId={card.objectId} altar={altar} />}
        />
      );

    case "illustrate": {
      const memory = altar.memories.find((m) => m.id === card.memoryId);
      return (
        <Proposal
          state={card.state}
          question="Paint a small picture for this memory?"
          detail={memory ? `“${memory.text}”` : undefined}
          yes="Paint it"
          no="Keep as words"
          acceptedText="Painting it for the altar."
          declinedText="Kept as words."
          onDecide={(accept) => decideCard(messageId, card, accept)}
        />
      );
    }

    case "element": {
      const info = ELEMENTS[card.element];
      return (
        <Proposal
          state={card.state}
          question={`Add ${info.name} (${info.gloss})?`}
          detail={info.meaning}
          yes="Add it"
          acceptedText={`${info.name} is on the altar.`}
          declinedText="Not now."
          onDecide={(accept) => decideCard(messageId, card, accept)}
          art={<ElementArt element={card.element} size={44} />}
        />
      );
    }

    case "pause":
      return (
        <Proposal
          state={card.state}
          question="Shall we rest here?"
          detail="Everything is saved. Come back whenever you like."
          yes="Rest here"
          no="Keep going"
          acceptedText="Resting. Your altar will be here."
          declinedText="Kept going."
          onDecide={(accept) => {
            decideCard(messageId, card, accept);
            if (!accept) chat.continueTalking();
          }}
        />
      );

    case "support":
      return <SupportCard />;

    default:
      return <InterviewCard card={card} messageId={messageId} altar={altar} chat={chat} />;
  }
}

export function Proposal(props: {
  state: "proposed" | "accepted" | "declined";
  question: string;
  detail?: string;
  yes: string;
  no?: string;
  acceptedText: string;
  declinedText: string;
  onDecide: (accept: boolean) => void;
  art?: React.ReactNode;
}) {
  if (props.state !== "proposed") {
    return (
      <Card tone="quiet">
        <p className="flex items-center gap-2 text-sm text-ink-soft">
          {props.state === "accepted" && (
            <svg viewBox="0 0 16 16" className="size-4 text-leaf" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M3 8.5 L6.5 12 L13 4.5" />
            </svg>
          )}
          {props.state === "accepted" ? props.acceptedText : props.declinedText}
        </p>
      </Card>
    );
  }
  return (
    <Card>
      <div className="flex gap-3">
        {props.art && <div className="shrink-0">{props.art}</div>}
        <div className="min-w-0">
          <p className="font-semibold">{props.question}</p>
          {props.detail && <p className="mt-1 text-sm text-ink-soft">{props.detail}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="btn btn-primary btn-sm" onClick={() => props.onDecide(true)}>
              {props.yes}
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => props.onDecide(false)}>
              {props.no ?? "Not now"}
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
}

function ObjectThumb({ objectId, altar }: { objectId?: string; altar: AltarState }) {
  const object = altar.objects.find((o) => o.id === objectId);
  const url = useBlobUrl(object?.imageId) ?? object?.imageSrc;
  if (!url) return null;
  // eslint-disable-next-line @next/next/no-img-element -- local blob URL
  return <img src={url} alt="" className="size-11 object-contain" />;
}

const noop = () => () => {};

function SupportCard() {
  const locales = useSyncExternalStore(
    noop,
    () => navigator.languages,
    () => ["de-DE"] as readonly string[],
  );
  const lines = supportLinesFor(locales);
  return (
    <Card tone="support">
      <p className="font-semibold">You don&rsquo;t have to carry this alone.</p>
      <p className="mt-1 text-sm">If things feel like too much right now, talking to someone can help. These lines are free and confidential.</p>
      <ul className="mt-3 space-y-2 text-sm">
        {lines.map((line) => (
          <li key={line.name}>
            <span className="block text-ink-soft">{line.region}</span>
            {line.phone ? (
              <a className="font-semibold underline" href={`tel:${line.phone.replace(/\s/g, "")}`}>
                {line.name}: {line.phone}
              </a>
            ) : (
              <a className="font-semibold underline" href={line.url} target="_blank" rel="noreferrer">
                {line.name}
              </a>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-sm">If you are in immediate danger, call your local emergency number.</p>
    </Card>
  );
}

export function Card({ children, tone = "default" }: { children: React.ReactNode; tone?: "default" | "quiet" | "support" }) {
  const styles = {
    default: "surface-card",
    quiet: "surface-card-quiet",
    support: "surface-card-support",
  }[tone];
  return <div className={`rise mt-2 px-4 py-3 ${styles}`}>{children}</div>;
}

function lowerFirst(text: string) {
  return /^(Her|His|Their|The|A|An|My)\b/.test(text) ? text.charAt(0).toLowerCase() + text.slice(1) : text;
}
