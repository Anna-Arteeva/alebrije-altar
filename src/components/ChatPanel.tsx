"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { AlebrijeCharacter } from "@/components/AlebrijeCharacter";
import { ChatCardView } from "@/components/ChatCards";
import { useServices } from "@/lib/services";
import { useBlobUrl } from "@/lib/store/altar-store";
import type { AgentChat } from "@/lib/use-chat";
import type { AltarState, ChatMessage } from "@/lib/types";

type Chat = AgentChat;

export function ChatPanel({
  altar,
  chat,
  subtitle = "Your alebrije guide",
  aside,
}: {
  altar: AltarState;
  chat: Chat;
  subtitle?: string;
  // Extra controls at the end of the header.
  aside?: React.ReactNode;
}) {
  const alebrije = altar.alebrije!;
  const { ai } = useServices();
  const visible = altar.messages.filter((m) => m.role !== "note");
  const end = useRef<HTMLDivElement>(null);
  const last = visible.at(-1);
  const canSkip = !chat.busy && last?.role === "assistant" && last.text.trim().endsWith("?");

  useEffect(() => {
    const history = end.current?.parentElement;
    history?.scrollTo({ top: history.scrollHeight, behavior: "smooth" });
  }, [visible.length, chat.streaming?.text, last?.cards?.length]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="app-header flex items-center gap-3 px-4 py-3">
        <AlebrijeCharacter
          alebrije={alebrije}
          size={52}
          state={!chat.busy ? "idle" : chat.streaming?.text ? "speaking" : "thinking"}
        />
        <div className="mr-auto">
          <p className="font-display text-lg leading-tight">{alebrije.name}</p>
          <p className="text-sm text-ink-soft">{subtitle}</p>
        </div>
        {aside}
      </header>

      <div className="chat-history min-h-0 flex-1 overflow-y-auto px-4 py-4" aria-live="polite">
        <ol className="space-y-4">
          {visible.map((message) => (
            <li key={message.id}>
              <Message
                message={message}
                altar={altar}
                streamingText={chat.streaming?.id === message.id ? chat.streaming.text : undefined}
                chat={chat}
              />
            </li>
          ))}
        </ol>
        {chat.error && ai !== false && (
          <div className="mt-4 rounded-xl bg-rosa-tint px-4 py-3 text-sm" role="alert">
            <p>{chat.error}</p>
            <button type="button" className="mt-1 font-semibold underline" onClick={chat.continueTalking}>
              Try again
            </button>
          </div>
        )}
        <div ref={end} />
      </div>

      {ai === false ? <Resting name={alebrije.name} /> : <Composer chat={chat} canSkip={canSkip} name={alebrije.name} />}
    </div>
  );
}

function Message({
  message,
  altar,
  streamingText,
  chat,
}: {
  message: ChatMessage;
  altar: AltarState;
  streamingText?: string;
  chat: Chat;
}) {
  const photo = useBlobUrl(message.photoId);

  if (message.role === "user") {
    return (
      <div className="flex flex-col items-end gap-1">
        {photo && (
          // eslint-disable-next-line @next/next/no-img-element -- local blob URL
          <img src={photo} alt="Photo you shared" className="max-h-48 rounded-xl object-cover" />
        )}
        {message.skipped ? (
          <p className="text-sm italic text-ink-soft">Skipped</p>
        ) : (
          message.text && (
            <p className="chat-user-message max-w-[85%] whitespace-pre-wrap px-4 py-2.5">
              {message.text}
            </p>
          )
        )}
      </div>
    );
  }

  const text = streamingText ?? message.text;
  return (
    <div className="chat-assistant-message max-w-[92%]">
      {text ? (
        <p className="chat-bubble whitespace-pre-wrap">{text}</p>
      ) : (
        streamingText !== undefined && <TypingDots />
      )}
      {message.cards?.map((card, i) => (
        <ChatCardView
          key={"callId" in card ? card.callId : `${card.kind}-${i}`}
          card={card}
          messageId={message.id}
          altar={altar}
          chat={chat}
        />
      ))}
    </div>
  );
}

function TypingDots() {
  return (
    <span className="chat-typing inline-flex gap-1 py-2" aria-label="Thinking">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="size-2 rounded-full bg-ink-faint motion-safe:animate-pulse"
          style={{ animationDelay: `${i * 0.2}s` }}
        />
      ))}
    </span>
  );
}

// In place of the composer when this copy has no AI service set up.
function Resting({ name }: { name: string }) {
  return (
    <div className="chat-composer border-t border-paper-edge bg-paper px-4 py-3 text-sm" role="status">
      <p className="font-semibold">{name} can&rsquo;t talk in this copy yet.</p>
      <p className="mt-1 text-ink-soft">
        The conversation and paintings need an OpenAI key: add <code>OPENAI_API_KEY</code> to{" "}
        <code>.env.local</code> and restart the server. You can still explore the ofrenda and its traditions.
      </p>
    </div>
  );
}

function Composer({ chat, canSkip, name }: { chat: Chat; canSkip: boolean; name: string }) {
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>();

  function choose(file: File | null) {
    if (preview) URL.revokeObjectURL(preview);
    setPhoto(file);
    setPreview(file ? URL.createObjectURL(file) : undefined);
  }

  function submit(event?: FormEvent) {
    event?.preventDefault();
    if (chat.busy || (!text.trim() && !photo)) return;
    chat.send(text.trim() || "Here's a photo.", photo ?? undefined);
    setText("");
    setPhoto(null);
    setPreview(undefined);
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  }

  return (
    <form onSubmit={submit} className="chat-composer border-t border-paper-edge bg-paper px-3 pb-3 pt-2">
      {(canSkip || preview) && (
        <div className="mb-2 flex items-center gap-2">
          {preview && (
            <span className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element -- local preview */}
              <img src={preview} alt="Photo to send" className="size-14 rounded-lg object-cover" />
              <button
                type="button"
                onClick={() => choose(null)}
                className="absolute -right-2 -top-2 grid size-6 place-items-center rounded-full bg-ink text-paper"
                aria-label="Remove photo"
              >
                <svg viewBox="0 0 20 20" className="size-3" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                  <path d="M5 5 L15 15 M15 5 L5 15" />
                </svg>
              </button>
            </span>
          )}
          {canSkip && !preview && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={chat.skip}>
              Skip this question
            </button>
          )}
        </div>
      )}
      <div className="flex items-end gap-2">
        <label className="btn btn-ghost size-11 shrink-0 cursor-pointer p-0" title="Attach a photo">
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <circle cx="12" cy="12" r="3.5" />
          </svg>
          <span className="sr-only">Attach a photo</span>
          <input type="file" accept="image/*" className="sr-only" onChange={(e) => choose(e.target.files?.[0] ?? null)} />
        </label>
        <label htmlFor="chat-input" className="sr-only">Message {name}</label>
        <textarea
          id="chat-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          rows={Math.min(5, Math.max(1, text.split("\n").length))}
          placeholder={`Answer ${name}…`}
          className="field min-h-11 flex-1 resize-none py-2.5"
        />
        {chat.busy ? (
          <button type="button" className="btn btn-secondary size-11 shrink-0 p-0" onClick={chat.stop} aria-label="Stop">
            <span className="size-3 rounded-[2px] bg-ink" />
          </button>
        ) : (
          <button
            type="submit"
            className="btn btn-primary size-11 shrink-0 p-0"
            disabled={!text.trim() && !photo}
            aria-label="Send"
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M5 12 H19 M13 6 L19 12 L13 18" />
            </svg>
          </button>
        )}
      </div>
      {preview && <p className="hint mt-2 text-xs">{name} will look at this photo to ask about it. It is stored privately with your altar.</p>}
    </form>
  );
}
