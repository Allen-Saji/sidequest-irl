"use client";
import { useState } from "react";
import {
  ArrowRight,
  LoaderCircle,
  Mic,
  Wrench,
  Lightbulb,
  Monitor,
} from "lucide-react";
import type { Profile, QuestKind } from "@/lib/types";
import { KIND_LABELS } from "@/lib/types";
export type ProfileInput = {
  name: string;
  building: string;
  askAbout: string;
  needsHelp: string;
  visible: boolean;
  available: boolean;
};
export type QuestInput = {
  title: string;
  ask: string;
  minutes: number;
  meetingPoint: string;
  kind: QuestKind;
};
export function ProfileForm({
  profile,
  busy,
  onSubmit,
}: {
  profile: Profile | null;
  busy: string;
  onSubmit: (data: ProfileInput) => Promise<void>;
}) {
  const [visible, setVisible] = useState(profile?.visible ?? false);
  return (
    <form
      className="sheet-content form-stack"
      onSubmit={async (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        await onSubmit({
          name: String(data.get("name")),
          building: String(data.get("building")),
          askAbout: String(data.get("askAbout")),
          needsHelp: String(data.get("needsHelp")),
          visible,
          available: data.get("available") === "on",
        });
      }}
    >
      <p className="form-intro">Give someone a good reason to say hello.</p>
      <label>
        Your name
        <input
          name="name"
          required
          maxLength={40}
          autoComplete="nickname"
          defaultValue={profile?.name}
          placeholder="What should we call you?"
        />
      </label>
      <label>
        What are you building?
        <input
          name="building"
          required
          maxLength={100}
          defaultValue={profile?.building}
          placeholder="A tiny music app, a new idea..."
        />
      </label>
      <label>
        Ask me about <span className="optional">optional</span>
        <input
          name="askAbout"
          maxLength={100}
          defaultValue={profile?.askAbout}
          placeholder="Something you can help with"
        />
      </label>
      <label>
        I could use help with <span className="optional">optional</span>
        <input
          name="needsHelp"
          maxLength={140}
          defaultValue={profile?.needsHelp}
          placeholder="One small thing you are stuck on"
        />
      </label>
      <label className="check-row">
        <input
          type="checkbox"
          checked={visible}
          onChange={(event) => setVisible(event.target.checked)}
        />
        <span>
          <strong>Show my profile at this event</strong>
          <small>
            Anyone with the event link can see these details and your public
            wallet address. You can hide your profile later.
          </small>
        </span>
      </label>
      <label className="check-row">
        <input
          name="available"
          type="checkbox"
          defaultChecked={!!profile && profile.availableUntil > Date.now()}
        />
        <span>
          <strong>Open to chat for 20 minutes</strong>
          <small>
            Automatically switches off. Turn it on again when you are free.
          </small>
        </span>
      </label>
      <p className="fine-print">
        Profile text stays offchain. Testnet transactions and addresses are
        public and cannot be erased.
      </p>
      <button className="button primary" disabled={!!busy} type="submit">
        {busy ? (
          <>
            <LoaderCircle className="spin" size={19} />
            {busy}
          </>
        ) : (
          <>
            {profile ? "Save my profile" : "Join the adventure"}
            <ArrowRight size={19} />
          </>
        )}
      </button>
    </form>
  );
}
export function QuestForm({
  busy,
  onSubmit,
}: {
  busy: string;
  onSubmit: (data: QuestInput) => Promise<void>;
}) {
  const [kind, setKind] = useState<QuestKind>("pitch");
  const defaults: Record<QuestKind, { title: string; ask: string }> = {
    pitch: {
      title: "Find the hole in my pitch",
      ask: "Hear my 30-second pitch. Tell me the first unclear thing.",
    },
    debug: {
      title: "Give me a debugging nudge",
      ask: "Look at one error with me and suggest one next step.",
    },
    learn: {
      title: "Explain shared objects to me",
      ask: "Give me a simple analogy I can actually remember.",
    },
    demo: {
      title: "Be my demo detective",
      ask: "Try one screen and tell me where you get confused.",
    },
  };
  return (
    <form
      className="sheet-content form-stack"
      onSubmit={async (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        await onSubmit({
          title: String(data.get("title")),
          ask: String(data.get("ask")),
          minutes: Number(data.get("minutes")),
          meetingPoint: String(data.get("meetingPoint")),
          kind,
        });
      }}
    >
      <p className="form-intro">Keep it small. Make it easy to say yes.</p>
      <div className="kind-picker" aria-label="Quest type">
        {(Object.keys(defaults) as QuestKind[]).map((value) => {
          const Icon = {
            pitch: Mic,
            debug: Wrench,
            learn: Lightbulb,
            demo: Monitor,
          }[value];
          return (
            <button
              type="button"
              key={value}
              aria-pressed={kind === value}
              className={kind === value ? "selected" : ""}
              onClick={() => setKind(value)}
            >
              <Icon size={20} />
              {KIND_LABELS[value]}
            </button>
          );
        })}
      </div>
      <label>
        Quest title
        <input
          key={`title-${kind}`}
          name="title"
          required
          minLength={4}
          maxLength={64}
          defaultValue={defaults[kind].title}
        />
      </label>
      <label>
        The specific ask
        <textarea
          key={`ask-${kind}`}
          name="ask"
          required
          minLength={10}
          maxLength={280}
          rows={3}
          defaultValue={defaults[kind].ask}
        />
      </label>
      <div className="form-pair">
        <label>
          How long?
          <select name="minutes" defaultValue="5">
            <option value="5">5 minutes</option>
            <option value="10">10 minutes</option>
            <option value="15">15 minutes</option>
          </select>
        </label>
      </div>
      <label>
        Public meeting point
        <input
          name="meetingPoint"
          required
          minLength={3}
          maxLength={100}
          placeholder="Near the coffee counter"
        />
      </label>
      <p className="fine-print">
        Your ask and meeting point stay offchain. Your wallet will approve a
        real Sui testnet transaction. Testnet gas is required.
      </p>
      <button className="button primary" disabled={!!busy} type="submit">
        {busy ? (
          <>
            <LoaderCircle className="spin" size={19} />
            {busy}
          </>
        ) : (
          <>
            Put my quest out there
            <ArrowRight size={19} />
          </>
        )}
      </button>
    </form>
  );
}
