import assert from "node:assert/strict";
import * as os from "node:os";
import * as path from "node:path";
import test from "node:test";
import { readSettings } from "./settings.ts";
import { makeTempAgentDir, writeSettings } from "./test-helpers.js";

test("readSettings parses model + extensions and expands ~", () => {
  const ctx = makeTempAgentDir();
  try {
    writeSettings(ctx.settingsPath, {
      "pi-subagent": {
        model: "qwen-coder:latest",
        extensions: ["~/foo.ts", "/abs/bar.ts"],
      },
    });
    const result = readSettings();
    assert.equal(result.model, "qwen-coder:latest");
    assert.deepEqual(result.extensions, [path.join(os.homedir(), "foo.ts"), "/abs/bar.ts"]);
  } finally {
    ctx.cleanup();
  }
});

test("readSettings returns defaults when pi-subagent block is absent", () => {
  const ctx = makeTempAgentDir();
  try {
    writeSettings(ctx.settingsPath, { someOtherBlock: { x: 1 } });
    assert.deepEqual(readSettings(), { model: null, extensions: [] });
  } finally {
    ctx.cleanup();
  }
});

test("readSettings returns defaults when settings.json is missing", () => {
  const ctx = makeTempAgentDir();
  try {
    assert.deepEqual(readSettings(), { model: null, extensions: [] });
  } finally {
    ctx.cleanup();
  }
});

test("readSettings returns defaults when settings.json is malformed", () => {
  const ctx = makeTempAgentDir();
  try {
    writeSettings(ctx.settingsPath, "{ not valid json");
    assert.deepEqual(readSettings(), { model: null, extensions: [] });
  } finally {
    ctx.cleanup();
  }
});

test("readSettings ignores wrong-typed fields", () => {
  const ctx = makeTempAgentDir();
  try {
    writeSettings(ctx.settingsPath, {
      "pi-subagent": {
        model: 42,
        extensions: "not-an-array",
      },
    });
    assert.deepEqual(readSettings(), { model: null, extensions: [] });
  } finally {
    ctx.cleanup();
  }
});

test("readSettings filters non-string entries inside extensions", () => {
  const ctx = makeTempAgentDir();
  try {
    writeSettings(ctx.settingsPath, {
      "pi-subagent": { extensions: ["/a.ts", 123, null, "/b.ts"] },
    });
    assert.deepEqual(readSettings().extensions, ["/a.ts", "/b.ts"]);
  } finally {
    ctx.cleanup();
  }
});
