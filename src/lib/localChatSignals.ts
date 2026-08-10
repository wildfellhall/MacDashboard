export type LocalChatSignals = {
  importedAt: string;
  messageCount: number;
  topics: Array<{ label: string; count: number }>;
};

const MAX_TEXT_CHARACTERS = 5_000_000;
const MAX_MESSAGES = 5_000;
const TOPIC_TAXONOMY: Array<{
  label: string;
  pattern: RegExp;
}> = [
  {
    label: "science fiction",
    pattern: /\b(?:sci[ -]?fi|science fiction|speculative fiction)\b/i,
  },
  {
    label: "books and literature",
    pattern: /\b(?:book|books|novel|novels|read|reading|literary|poetry)\b/i,
  },
  {
    label: "film and television",
    pattern: /\b(?:film|films|movie|movies|cinema|television|tv|show|shows)\b/i,
  },
  {
    label: "art and museums",
    pattern: /\b(?:art|artist|artists|museum|museums|painting|paintings|gallery)\b/i,
  },
  {
    label: "architecture and design",
    pattern: /\b(?:architecture|architect|building|buildings|interior|design)\b/i,
  },
  {
    label: "photography",
    pattern: /\b(?:photo|photos|photograph|photography|camera|portrait)\b/i,
  },
  {
    label: "travel and landscapes",
    pattern: /\b(?:travel|trip|vacation|beach|coast|mountain|landscape|city|cities)\b/i,
  },
  {
    label: "nature and gardens",
    pattern: /\b(?:nature|garden|gardens|forest|flowers|plants|hiking|outdoors)\b/i,
  },
  {
    label: "food and cooking",
    pattern: /\b(?:food|cooking|cook|restaurant|baking|recipe|dinner|lunch)\b/i,
  },
  {
    label: "music",
    pattern: /\b(?:music|album|song|songs|concert|band|singer|playlist)\b/i,
  },
  {
    label: "history",
    pattern: /\b(?:history|historical|archive|archives|ancient|medieval)\b/i,
  },
  {
    label: "mysteries",
    pattern: /\b(?:mystery|mysteries|detective|crime novel|whodunit)\b/i,
  },
  {
    label: "comedy",
    pattern: /\b(?:comedy|comedies|comic|funny|humor|humour)\b/i,
  },
  {
    label: "technology and science",
    pattern: /\b(?:technology|coding|programming|software|computer|science|astronomy|biology)\b/i,
  },
  {
    label: "theater and performance",
    pattern: /\b(?:theater|theatre|play|musical|dance|performance)\b/i,
  },
  {
    label: "games",
    pattern: /\b(?:game|games|gaming|board game|puzzle|puzzles)\b/i,
  },
];

const parseCsvRow = (row: string) => {
  const values: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < row.length; index += 1) {
    const character = row[index];
    if (character === '"') {
      if (quoted && row[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      values.push(current.trim());
      current = "";
    } else {
      current += character;
    }
  }
  values.push(current.trim());
  return values;
};

const normalizeHeader = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, "");

const messagesFromCsv = (text: string) => {
  const rows = text
    .split(/\r?\n/)
    .filter((row) => row.trim())
    .map(parseCsvRow);
  if (rows.length < 2) return [];
  const headers = rows[0].map(normalizeHeader);
  const textIndex = headers.findIndex((header) =>
    ["text", "message", "body", "content", "messagetext"].includes(header),
  );
  if (textIndex < 0) return [];
  return rows
    .slice(1)
    .map((row) => row[textIndex])
    .filter((value): value is string => Boolean(value));
};

const collectJsonMessages = (value: unknown, output: string[]) => {
  if (output.length >= MAX_MESSAGES || value === null) return;
  if (Array.isArray(value)) {
    value.forEach((item) => collectJsonMessages(item, output));
    return;
  }
  if (typeof value !== "object") return;
  const record = value as Record<string, unknown>;
  const text =
    record.text ?? record.message ?? record.body ?? record.content;
  if (typeof text === "string" && text.trim()) output.push(text);
  for (const [key, child] of Object.entries(record)) {
    if (!["text", "message", "body", "content"].includes(key)) {
      collectJsonMessages(child, output);
    }
  }
};

const messagesFrom = (text: string, fileName: string) => {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".json") || text.trim().startsWith("[") || text.trim().startsWith("{")) {
    const output: string[] = [];
    collectJsonMessages(JSON.parse(text) as unknown, output);
    return output;
  }
  if (lower.endsWith(".csv")) return messagesFromCsv(text);
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
};

export const analyzeChatExport = (
  text: string,
  fileName: string,
): LocalChatSignals => {
  if (text.length > MAX_TEXT_CHARACTERS) {
    throw new Error("The selected chat export is larger than 5 MB.");
  }
  let messages: string[];
  try {
    messages = messagesFrom(text, fileName).slice(0, MAX_MESSAGES);
  } catch {
    throw new Error("The selected chat export is not valid TXT, CSV, or JSON.");
  }
  if (!messages.length) {
    throw new Error("No recognizable chat messages were found.");
  }
  const counts = new Map<string, number>();
  messages.forEach((message) => {
    TOPIC_TAXONOMY.forEach(({ label, pattern }) => {
      if (pattern.test(message)) {
        counts.set(label, (counts.get(label) ?? 0) + 1);
      }
    });
  });
  const topics = [...counts]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 12)
    .map(([label, count]) => ({ label, count }));
  if (!topics.length) {
    throw new Error(
      "No supported interest topics were found; no chat content was stored.",
    );
  }
  return {
    importedAt: new Date().toISOString(),
    messageCount: messages.length,
    topics,
  };
};

export const localChatAffinity = (signals: LocalChatSignals | null) =>
  signals?.topics.slice(0, 10).map((topic) => topic.label) ?? [];
