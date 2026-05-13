import assert from "node:assert/strict";
import test from "node:test";
import { buildArgs, extractText } from "./spawn.ts";

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
