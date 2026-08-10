import { describe, expect, it } from "vitest";
import {
  analyzeChatExport,
  localChatAffinity,
} from "./localChatSignals";

describe("local chat signals", () => {
  it("extracts only fixed aggregate topics from a CSV export", () => {
    const signals = analyzeChatExport(
      [
        "Date,Sender,Text",
        '2026-01-01,Ada,"The museum and architecture tour was wonderful"',
        '2026-01-02,Sam,"Want to read another science fiction novel?"',
      ].join("\n"),
      "messages.csv",
    );

    expect(signals.messageCount).toBe(2);
    expect(signals.topics).toContainEqual({
      label: "architecture and design",
      count: 1,
    });
    expect(signals.topics).toContainEqual({
      label: "science fiction",
      count: 1,
    });
    expect(localChatAffinity(signals)).toContain("art and museums");
    expect(JSON.stringify(signals)).not.toContain("Ada");
    expect(JSON.stringify(signals)).not.toContain("wonderful");
  });

  it("parses nested JSON and rejects prose without recognized topics", () => {
    expect(
      analyzeChatExport(
        JSON.stringify({
          conversations: [{ messages: [{ body: "A funny movie night" }] }],
        }),
        "chat.json",
      ).topics,
    ).toEqual(
      expect.arrayContaining([
        { label: "film and television", count: 1 },
        { label: "comedy", count: 1 },
      ]),
    );
    expect(() => analyzeChatExport("hello there", "chat.txt")).toThrow(
      /No supported/,
    );
  });
});
