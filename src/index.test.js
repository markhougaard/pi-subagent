import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import test from "node:test";
import register, { toToolResult } from "./index.ts";
import { makeTempAgentDir, writeAgentFile } from "./test-helpers.js";

function makeFakePi() {
  const registrations = [];
  const handlers = new Map();
  return {
    pi: {
      registerTool(def) {
        registrations.push(def);
      },
      on(event, handler) {
        handlers.set(event, handler);
      },
    },
    registrations,
    emit(event, ...args) {
      const handler = handlers.get(event);
      assert.ok(handler, `no handler registered for "${event}"`);
      return handler(...args);
    },
    get last() {
      return registrations[registrations.length - 1];
    },
    get agentEnum() {
      return this.last.parameters.properties.agent.enum;
    },
  };
}

test("registers the subagent tool at load time, before any session event", () => {
  const temp = makeTempAgentDir();
  try {
    writeAgentFile(temp.agentsDir, "scout.md", {
      name: "scout",
      description: "fast reconnaissance",
    });

    const fake = makeFakePi();
    register(fake.pi);

    // Load-time registration is what lets pi detect a tool-name collision with
    // another extension; registering only from session_start bypasses it.
    assert.equal(fake.registrations.length, 1);
    const def = fake.last;
    assert.equal(def.name, "subagent");
    assert.equal(def.label, "Subagent");
    assert.equal(typeof def.execute, "function");
    assert.match(def.description, /call this tool multiple times in the same turn/);

    const schema = def.parameters;
    assert.equal(schema.type, "object");
    assert.equal(schema.properties.task.type, "string");
    assert.deepEqual(schema.required?.sort(), ["agent", "task"]);
  } finally {
    temp.cleanup();
  }
});

test("constrains the agent parameter to the roles discovered for the cwd", () => {
  const temp = makeTempAgentDir();
  try {
    writeAgentFile(temp.agentsDir, "scout.md", { name: "scout", description: "recon" });
    writeAgentFile(temp.agentsDir, "architect.md", { name: "architect", description: "plans" });

    const fake = makeFakePi();
    register(fake.pi);
    fake.emit("session_start", {}, { cwd: process.cwd() });

    assert.deepEqual(fake.agentEnum, ["architect", "scout"]);
    assert.match(fake.last.parameters.properties.agent.description, /architect, scout/);
  } finally {
    temp.cleanup();
  }
});

test("omits the enum entirely when no roles are discoverable", () => {
  const temp = makeTempAgentDir();
  try {
    const fake = makeFakePi();
    register(fake.pi);

    // An empty enum would make the tool impossible to call at all.
    assert.equal(fake.agentEnum, undefined);
    assert.equal(fake.last.parameters.properties.agent.type, "string");
  } finally {
    temp.cleanup();
  }
});

test("session_start picks up project roles from the session cwd", () => {
  const temp = makeTempAgentDir();
  const projectDir = fs.mkdtempSync(path.join(temp.dir, "project-"));
  try {
    writeAgentFile(temp.agentsDir, "scout.md", { name: "scout", description: "recon" });
    writeAgentFile(path.join(projectDir, ".pi", "agents"), "local.md", {
      name: "local",
      description: "project-only role",
    });

    const fake = makeFakePi();
    register(fake.pi);
    assert.deepEqual(fake.agentEnum, ["scout"]);

    fake.emit("session_start", {}, { cwd: projectDir });
    assert.deepEqual(fake.agentEnum, ["local", "scout"]);
  } finally {
    temp.cleanup();
  }
});

test("re-registers only when the set of roles actually changes", () => {
  const temp = makeTempAgentDir();
  try {
    writeAgentFile(temp.agentsDir, "scout.md", { name: "scout", description: "recon" });

    const fake = makeFakePi();
    register(fake.pi);
    assert.equal(fake.registrations.length, 1);

    fake.emit("session_start", {}, { cwd: process.cwd() });
    assert.equal(fake.registrations.length, 1, "unchanged roles should not re-register");

    writeAgentFile(temp.agentsDir, "sme.md", { name: "sme", description: "domain expert" });
    fake.emit("before_agent_start", {
      systemPrompt: "base",
      systemPromptOptions: { cwd: process.cwd() },
    });
    assert.equal(fake.registrations.length, 2, "a new role should refresh the schema");
    assert.deepEqual(fake.agentEnum, ["scout", "sme"]);
  } finally {
    temp.cleanup();
  }
});

test("before_agent_start appends the discovered roles to the system prompt", () => {
  const temp = makeTempAgentDir();
  try {
    writeAgentFile(temp.agentsDir, "scout.md", {
      name: "scout",
      description: "fast reconnaissance",
    });

    const fake = makeFakePi();
    register(fake.pi);
    const result = fake.emit("before_agent_start", {
      systemPrompt: "base prompt",
      systemPromptOptions: { cwd: process.cwd() },
    });

    assert.match(result.systemPrompt, /^base prompt/);
    assert.match(result.systemPrompt, /## Available subagent roles/);
    assert.match(result.systemPrompt, /- scout: fast reconnaissance/);
  } finally {
    temp.cleanup();
  }
});

test("a stale runtime during refresh does not break the turn", () => {
  const temp = makeTempAgentDir();
  try {
    writeAgentFile(temp.agentsDir, "scout.md", { name: "scout", description: "recon" });

    const fake = makeFakePi();
    register(fake.pi);
    fake.pi.registerTool = () => {
      throw new Error("This extension ctx is stale after session replacement");
    };

    writeAgentFile(temp.agentsDir, "sme.md", { name: "sme", description: "domain expert" });
    const result = fake.emit("before_agent_start", {
      systemPrompt: "base",
      systemPromptOptions: { cwd: process.cwd() },
    });
    assert.match(result.systemPrompt, /- sme: domain expert/);
  } finally {
    temp.cleanup();
  }
});

test("execute reports unknown roles with the cwd that was searched", async () => {
  const temp = makeTempAgentDir();
  try {
    writeAgentFile(temp.agentsDir, "scout.md", { name: "scout", description: "recon" });

    const fake = makeFakePi();
    register(fake.pi);
    const res = await fake.last.execute(
      "call-1",
      { agent: "nope", task: "t" },
      undefined,
      () => {},
      { cwd: process.cwd() },
    );

    assert.equal(res.isError, true);
    assert.match(res.content[0].text, /Unknown subagent "nope"/);
    assert.match(res.content[0].text, /scout/);
    assert.equal(res.details.result, null);
  } finally {
    temp.cleanup();
  }
});

test("toToolResult — a provider error reported alongside exit 0 is an error", () => {
  const res = toToolResult("scout", {
    agent: "scout",
    model: "llama-cpp/some-model",
    text: "",
    stopReason: "error",
    errorMessage: "Connection error.",
    exitCode: 0,
    usage: { input: 0, output: 0, turns: 3 },
    stderr: "",
  });

  assert.equal(res.isError, true, "a provider failure must not read as success");
  assert.match(res.content[0].text, /Connection error\./);
  assert.match(res.content[0].text, /llama-cpp\/some-model/);
  assert.notEqual(res.content[0].text, "(empty response)");
});

test("toToolResult — a genuinely empty but successful run stays a success", () => {
  const res = toToolResult("scout", {
    agent: "scout",
    model: "m",
    text: "",
    stopReason: "stop",
    errorMessage: null,
    exitCode: 0,
    usage: { input: 5, output: 0, turns: 1 },
    stderr: "",
  });

  assert.notEqual(res.isError, true);
  assert.equal(res.content[0].text, "(empty response)");
});

test("toToolResult — a nonzero exit includes the provider error and stderr", () => {
  const res = toToolResult("scout", {
    agent: "scout",
    model: "m",
    text: "",
    stopReason: null,
    errorMessage: "Model not found.",
    exitCode: 1,
    usage: { input: 0, output: 0, turns: 0 },
    stderr: "boom",
  });

  assert.equal(res.isError, true);
  assert.match(res.content[0].text, /exit 1/);
  assert.match(res.content[0].text, /Model not found\./);
  assert.match(res.content[0].text, /boom/);
});

test("toToolResult — normal output passes through untouched", () => {
  const res = toToolResult("scout", {
    agent: "scout",
    model: "m",
    text: "the findings",
    stopReason: "stop",
    errorMessage: null,
    exitCode: 0,
    usage: { input: 10, output: 4, turns: 1 },
    stderr: "",
  });

  assert.notEqual(res.isError, true);
  assert.equal(res.content[0].text, "the findings");
});
