import assert from "node:assert/strict";
import test from "node:test";
import register from "./index.ts";
import { makeTempAgentDir, writeAgentFile } from "./test-helpers.js";

test("default export registers a cwd-aware subagent tool", () => {
  const temp = makeTempAgentDir();
  try {
    writeAgentFile(temp.agentsDir, "scout.md", {
      name: "scout",
      description: "fast reconnaissance",
    });

    let registered = null;
    let beforeAgentStart = null;
    const fakePi = {
      registerTool(def) {
        registered = def;
      },
      on(event, handler) {
        if (event === "session_start") handler({}, { cwd: process.cwd() });
        if (event === "before_agent_start") beforeAgentStart = handler;
      },
    };
    register(fakePi);

    assert.ok(registered, "registerTool was not called");
    assert.equal(registered.name, "subagent");
    assert.equal(registered.label, "Subagent");
    assert.equal(typeof registered.description, "string");
    assert.ok(registered.description.length > 0);
    assert.equal(typeof registered.execute, "function");

    const schema = registered.parameters;
    assert.equal(schema.type, "object");
    assert.ok(schema.properties, "schema.properties missing");
    assert.deepEqual(schema.properties.agent.enum, ["scout"]);
    assert.equal(schema.properties.task.type, "string");
    assert.deepEqual(schema.required?.sort(), ["agent", "task"]);

    const prompt = beforeAgentStart({
      systemPrompt: "base",
      systemPromptOptions: { cwd: process.cwd() },
    });
    assert.match(prompt.systemPrompt, /- scout: fast reconnaissance/);
  } finally {
    temp.cleanup();
  }
});
