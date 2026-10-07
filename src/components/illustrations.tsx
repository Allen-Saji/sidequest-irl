import { Handshake } from "lucide-react";
import { useId } from "react";
export function Flag({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      width="32"
      height="38"
      viewBox="0 0 32 38"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M6 35L7.8 3"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path d="M9 5L29 11L8 19Z" fill="currentColor" />
      <path d="M9 4L27 9" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
export function Avatar({
  name,
  color = 0,
  size = "normal",
}: {
  name: string;
  color?: number;
  size?: "normal" | "small";
}) {
  const palette = ["#d5e7ec", "#eed8bc", "#e5ddbb", "#e6d9d3"];
  const flip = color % 2 === 1;
  return (
    <span
      className={`avatar avatar-${size}`}
      style={{ backgroundColor: palette[color % 4] }}
      role="img"
      aria-label={`${name}'s illustrated avatar`}
    >
      <svg viewBox="0 0 100 100" fill="none" aria-hidden="true">
        <g transform={flip ? "translate(100 0) scale(-1 1)" : undefined}>
          <path
            d="M14 100C17 82 31 76 48 74C69 74 87 82 92 100"
            fill="#333b35"
          />
          <path
            d="M35 74L37 60H64L66 80C55 91 43 87 35 74"
            fill="#f4d0a8"
            stroke="#292b25"
            strokeWidth="2"
          />
          <path
            d="M27 49C22 27 37 12 57 16C77 18 81 35 75 58C69 70 64 76 51 75C37 74 30 62 27 49Z"
            fill="#292b25"
          />
          <path
            d="M34 38C37 39 52 34 58 25C60 34 67 38 72 41L70 59C67 70 61 76 50 74C39 72 33 64 32 54Z"
            fill="#f4d0a8"
            stroke="#292b25"
            strokeWidth="2"
          />
          <path
            d="M49 50L47 56L52 57M45 64C49 67 56 66 59 62"
            stroke="#292b25"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle cx="40" cy="48" r="2" fill="#292b25" />
          <circle cx="60" cy="46" r="2" fill="#292b25" />
          {flip && (
            <g stroke="#292b25" strokeWidth="2">
              <rect x="33" y="41" width="15" height="13" rx="5" />
              <rect x="54" y="39" width="15" height="13" rx="5" />
              <path d="M48 45L54 44" />
            </g>
          )}
          {!flip && (
            <path
              d="M29 32C16 47 18 72 24 82L38 79C32 68 27 56 32 44M68 28C80 45 80 65 73 78L65 71"
              fill="#292b25"
            />
          )}
          <path d="M26 99L32 89M74 99L68 87" stroke="#d5e7ec" strokeWidth="2" />
        </g>
      </svg>
    </span>
  );
}
export function Stamp({
  creatorConfirmed,
  helperConfirmed,
  completed = false,
}: {
  creatorConfirmed: boolean;
  helperConfirmed: boolean;
  completed?: boolean;
}) {
  const id = useId().replace(/:/g, "");
  return (
    <div
      className={`stamp ${completed ? "stamp-complete" : ""}`}
      role="img"
      aria-label={
        completed
          ? "Both participants confirmed"
          : `${creatorConfirmed ? "Creator confirmed" : "Creator waiting"}, ${helperConfirmed ? "helper confirmed" : "helper waiting"}`
      }
    >
      <svg viewBox="0 0 220 220" aria-hidden="true">
        <path
          className={creatorConfirmed ? "stamp-half confirmed" : "stamp-half"}
          d="M16 108A94 94 0 0 1 204 108"
          fill="none"
          stroke={creatorConfirmed ? "#dd502b" : "#bdb7a9"}
          strokeWidth="7"
        />
        <path
          className={helperConfirmed ? "stamp-half confirmed" : "stamp-half"}
          d="M204 112A94 94 0 0 1 16 112"
          fill="none"
          stroke={helperConfirmed ? "#316d89" : "#bdb7a9"}
          strokeWidth="7"
        />
        <path
          d="M23 108A87 87 0 0 1 197 108M197 112A87 87 0 0 1 23 112"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          opacity=".5"
        />
        <defs>
          <path id={`stamp-top-${id}`} d="M41 108A69 69 0 0 1 179 108" />
          <path id={`stamp-bottom-${id}`} d="M28 126A85 85 0 0 0 192 126" />
        </defs>
        <text
          fill={creatorConfirmed ? "#bd3f1f" : "#706e63"}
          fontSize="23"
          fontWeight="800"
          letterSpacing="5"
        >
          <textPath
            href={`#stamp-top-${id}`}
            startOffset="50%"
            textAnchor="middle"
          >
            {completed ? "BOTH" : "YOUR QUEST"}
          </textPath>
        </text>
        <text
          fill={helperConfirmed ? "#316d89" : "#777267"}
          fontSize="22"
          fontWeight="800"
          letterSpacing="2"
        >
          <textPath
            href={`#stamp-bottom-${id}`}
            startOffset="50%"
            textAnchor="middle"
          >
            {completed ? "CONFIRMED" : "TWO HALVES"}
          </textPath>
        </text>
      </svg>
      <Handshake
        className="stamp-handshake"
        strokeWidth={1.7}
        aria-hidden="true"
      />
    </div>
  );
}
