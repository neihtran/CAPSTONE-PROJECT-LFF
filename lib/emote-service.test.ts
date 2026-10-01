import { describe, it, expect } from "vitest";
import { parseEmotesInMessage } from "@/lib/emote-service";

describe("EmoteService", () => {
  const emotes = [
    { id: "e1", code: "pog", imageUrl: "https://cdn/pog.png", scope: "GLOBAL", channelId: null, width: 64, height: 64 },
    { id: "e2", code: "KEKW", imageUrl: "https://cdn/kekw.png", scope: "GLOBAL", channelId: null, width: 64, height: 64 },
    { id: "e3", code: "ha", imageUrl: "https://cdn/ha.png", scope: "CHANNEL", channelId: "u1", width: 64, height: 64 },
  ];

  it("should parse single emote at start", () => {
    const result = parseEmotesInMessage(":pog: Hello!", emotes);
    // Output: [emote("pog"), text(" Hello!")]
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ type: "emote", code: "pog", imageUrl: "https://cdn/pog.png" });
    expect(result[1]).toEqual({ type: "text", value: " Hello!" });
  });

  it("should parse emote at end", () => {
    const result = parseEmotesInMessage("Hello :pog:", emotes);
    // Output: [text("Hello "), emote("pog")]
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ type: "text", value: "Hello " });
    expect(result[1]).toEqual({ type: "emote", code: "pog", imageUrl: "https://cdn/pog.png" });
  });

  it("should parse multiple emotes", () => {
    const result = parseEmotesInMessage(":pog: :KEKW: :ha:", emotes);
    // Output: [emote(pog), text(" "), emote(KEKW), text(" "), emote(ha)]
    expect(result).toHaveLength(5);
    expect(result[0]).toEqual({ type: "emote", code: "pog", imageUrl: "https://cdn/pog.png" });
    expect(result[1]).toEqual({ type: "text", value: " " });
    expect(result[2]).toEqual({ type: "emote", code: "KEKW", imageUrl: "https://cdn/kekw.png" });
    expect(result[3]).toEqual({ type: "text", value: " " });
    expect(result[4]).toEqual({ type: "emote", code: "ha", imageUrl: "https://cdn/ha.png" });
  });

  it("should return plain text when no emotes", () => {
    const result = parseEmotesInMessage("Hello world", emotes);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ type: "text", value: "Hello world" });
  });

  it("should return plain text when emotes array empty", () => {
    const result = parseEmotesInMessage(":pog: Hello", []);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ type: "text", value: ":pog: Hello" });
  });

  it("should treat unknown codes as text", () => {
    const result = parseEmotesInMessage(":unknown: test", emotes);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ type: "text", value: ":unknown: test" });
  });

  it("should match KEKW case-sensitively", () => {
    const result = parseEmotesInMessage(":KEKW: hello", emotes);
    expect(result[0]).toEqual({ type: "emote", code: "KEKW", imageUrl: "https://cdn/kekw.png" });
    // lowercase doesn't match
    const result2 = parseEmotesInMessage(":kekw: hello", emotes);
    expect(result2[0]).toEqual({ type: "text", value: ":kekw: hello" });
  });
});
