import type { UIMessage } from "ai";

export type TranscriptLine = {
  role: "candidate" | "interviewer";
  text: string;
};

export function messageText(message: UIMessage): string {
  return message.parts
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("")
    .trim();
}

export function toTranscript(messages: UIMessage[]): TranscriptLine[] {
  return messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      role:
        m.role === "user" ? ("candidate" as const) : ("interviewer" as const),
      text: messageText(m)
    }))
    .filter((line) => line.text.length > 0);
}

export function formatTranscript(lines: TranscriptLine[]): string {
  return lines
    .map(
      (l) =>
        `${l.role === "candidate" ? "Candidate" : "Interviewer"}: ${l.text}`
    )
    .join("\n\n");
}

export function candidateTurnCount(lines: TranscriptLine[]): number {
  return lines.filter((l) => l.role === "candidate").length;
}
