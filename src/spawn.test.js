import assert from "node:assert/strict";
import test from "node:test";
import { buildArgs, extractText, parseLine } from "./spawn.ts";

function makeResult() {
  return {
    agent: "x",
    model: null,
    text: "",
    stopReason: null,
    exitCode: -1,
    usage: { input: 0, output: 0, turns: 0 },
    stderr: "",
  };
}

test("parseLine: message_end with assistant role updates text, usage, stopReason", () => {
  const result = makeResult();
  const line = JSON.stringify({
    type: "message_end",
    message: {
      role: "assistant",
      stopReason: "stop",
      usage: { input: 100, output: 42 },
      content: [
        { type: "thinking", text: "internal" },
        { type: "text", text: "the answer" },
      ],
    },
  });
  assert.equal(parseLine(line, result), true);
  assert.equal(result.text, "the answer");
  assert.equal(result.stopReason, "stop");
  assert.deepEqual(result.usage, { input: 100, output: 42, turns: 1 });
});

test("parseLine: message_update events are ignored (we only fold message_end)", () => {
  const result = makeResult();
  const line = JSON.stringify({
    type: "message_update",
    message: {
      role: "assistant",
      content: [{ type: "text", text: "partial" }],
    },
  });
  assert.equal(parseLine(line, result), false);
  assert.equal(result.text, "");
  assert.equal(result.usage.turns, 0);
});

test("parseLine: agent_end / turn_end with no message.role is ignored", () => {
  const result = makeResult();
  for (const type of ["agent_end", "turn_end"]) {
    assert.equal(parseLine(JSON.stringify({ type, message: {} }), result), false);
  }
  assert.equal(result.text, "");
});

test("parseLine: invalid JSON and blank lines do not throw", () => {
  const result = makeResult();
  assert.equal(parseLine("not json", result), false);
  assert.equal(parseLine("", result), false);
  assert.equal(parseLine("   ", result), false);
  assert.equal(result.text, "");
});

test("parseLine: multiple message_end events accumulate usage and overwrite text", () => {
  const result = makeResult();
  parseLine(JSON.stringify({
    type: "message_end",
    message: {
      role: "assistant",
      content: [{ type: "text", text: "first turn" }],
      usage: { input: 10, output: 5 },
    },
  }), result);
  parseLine(JSON.stringify({
    type: "message_end",
    message: {
      role: "assistant",
      content: [{ type: "text", text: "second turn" }],
      usage: { input: 20, output: 8 },
    },
  }), result);
  assert.equal(result.text, "second turn");
  assert.deepEqual(result.usage, { input: 30, output: 13, turns: 2 });
});

test("parseLine: message_end with non-assistant role is ignored", () => {
  const result = makeResult();
  const line = JSON.stringify({
    type: "message_end",
    message: { role: "user", content: [{ type: "text", text: "x" }] },
  });
  assert.equal(parseLine(line, result), false);
  assert.equal(result.text, "");
});

test("extractText collects text parts and skips thinking parts", () => {
  const content = [
    { type: "text", text: "hi" },
    { type: "thinking", text: "should-be-skipped" },
    { type: "text", text: "there" },
  ];
  assert.equal(extractText(content), "hi\nthere");
});

test("extractText passes string content through (with trim from join)", () => {
  assert.equal(extractText("plain string"), "plain string");
});

test("extractText returns empty for empty array", () => {
  assert.equal(extractText([]), "");
});

test("extractText returns empty for non-array, non-string content", () => {
  assert.equal(extractText(undefined), "");
  assert.equal(extractText(null), "");
  assert.equal(extractText(123), "");
  assert.equal(extractText({ random: "obj" }), "");
});

test("extractText skips text parts without a string text field", () => {
  const content = [
    { type: "text" },
    { type: "text", text: 42 },
    { type: "text", text: "valid" },
  ];
  assert.equal(extractText(content), "valid");
});

const baseAgent = {
  name: "scout",
  description: "",
  systemPrompt: "",
  filePath: "",
};

test("buildArgs — minimal: only agent.model, no settings, no system prompt", () => {
  const args = buildArgs({
    agent: { ...baseAgent, model: "qwen:latest" },
    task: "find foo",
    systemPromptPath: null,
    settings: { model: null, extensions: [] },
  });
  assert.deepEqual(args, [
    "--mode",
    "json",
    "-p",
    "--no-session",
    "--no-extensions",
    "--model",
    "qwen:latest",
    "find foo",
  ]);
});

test("buildArgs — full: thinking, settings.extensions, systemPromptPath", () => {
  const args = buildArgs({
    agent: { ...baseAgent, model: "gemma4-think:latest", thinking: "medium" },
    task: "plan it",
    systemPromptPath: "/tmp/sys.md",
    settings: { model: "ignored", extensions: ["/a.ts", "/b.ts"] },
  });
  assert.deepEqual(args, [
    "--mode",
    "json",
    "-p",
    "--no-session",
    "--no-extensions",
    "--extension",
    "/a.ts",
    "--extension",
    "/b.ts",
    "--model",
    "gemma4-think:latest",
    "--thinking",
    "medium",
    "--append-system-prompt",
    "/tmp/sys.md",
    "plan it",
  ]);
});

test("buildArgs — agent.model wins over settings.model", () => {
  const args = buildArgs({
    agent: { ...baseAgent, model: "agent-model" },
    task: "t",
    systemPromptPath: null,
    settings: { model: "settings-model", extensions: [] },
  });
  const idx = args.indexOf("--model");
  assert.equal(args[idx + 1], "agent-model");
});

test("buildArgs — falls back to settings.model when agent.model is missing", () => {
  const args = buildArgs({
    agent: { ...baseAgent },
    task: "t",
    systemPromptPath: null,
    settings: { model: "settings-model", extensions: [] },
  });
  const idx = args.indexOf("--model");
  assert.equal(args[idx + 1], "settings-model");
});

test("buildArgs — no model flag when neither agent nor settings provide one", () => {
  const args = buildArgs({
    agent: { ...baseAgent },
    task: "t",
    systemPromptPath: null,
    settings: { model: null, extensions: [] },
  });
  assert.equal(args.indexOf("--model"), -1);
});

test("buildArgs — task is always the last positional", () => {
  const args = buildArgs({
    agent: { ...baseAgent, model: "m", thinking: "low" },
    task: "the task",
    systemPromptPath: "/sys",
    settings: { model: null, extensions: ["/x"] },
  });
  assert.equal(args[args.length - 1], "the task");
});

test("buildArgs — always includes --no-extensions", () => {
  const args = buildArgs({
    agent: { ...baseAgent },
    task: "t",
    systemPromptPath: null,
    settings: { model: null, extensions: [] },
  });
  assert.ok(args.includes("--no-extensions"));
});
