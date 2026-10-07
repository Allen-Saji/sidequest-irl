import {
  ArrowUpRight,
  Clock3,
  Lightbulb,
  MapPin,
  Mic,
  Monitor,
  Wrench,
} from "lucide-react";
import type { Profile, Quest, QuestKind } from "@/lib/types";
import { KIND_LABELS } from "@/lib/types";
import { Avatar } from "./illustrations";
export const QuestIcon = ({
  kind,
  size = 20,
}: {
  kind: QuestKind;
  size?: number;
}) => {
  const Icon = { pitch: Mic, debug: Wrench, learn: Lightbulb, demo: Monitor }[
    kind
  ];
  return <Icon size={size} strokeWidth={1.8} aria-hidden="true" />;
};
export function QuestCard({
  quest,
  creator,
  onClick,
}: {
  quest: Quest;
  creator?: Profile;
  onClick: () => void;
}) {
  return (
    <button className={`quest-card quest-${quest.kind}`} onClick={onClick}>
      <div className="quest-card-top">
        <span className="kind-label">
          <QuestIcon kind={quest.kind} />
          {KIND_LABELS[quest.kind]}
        </span>
        <span className={`status-label status-${quest.status}`}>
          {quest.status === "open" ? "Available" : quest.status}
        </span>
      </div>
      <h3>{quest.title}</h3>
      <p>{quest.ask}</p>
      <div className="quest-meta">
        <span>
          <Clock3 size={16} />
          {quest.minutes} min
        </span>
        <span>
          <MapPin size={16} />
          {quest.meetingPoint}
        </span>
      </div>
      <div className="quest-card-foot">
        <span>
          <Avatar
            name={creator?.name ?? "Participant"}
            color={creator?.color}
            size="small"
          />
          {creator?.name ?? "Participant"}
          {quest.demo && <span className="demo-label">Demo</span>}
        </span>
        <ArrowUpRight size={23} />
      </div>
    </button>
  );
}
