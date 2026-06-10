type TranscriptEntry = {
  role?: string;
  message?: string;
  content?: string;
};

export function formatTranscriptLines(entries: TranscriptEntry[]): string | undefined {
  const lines = entries
    .map((entry) => {
      const text = (entry.message ?? entry.content ?? "").trim();
      if (!text) {
        return undefined;
      }

      const role = entry.role ?? "unknown";
      return `${role}: ${text}`;
    })
    .filter((line): line is string => line !== undefined);

  return lines.length > 0 ? lines.join("\n") : undefined;
}
