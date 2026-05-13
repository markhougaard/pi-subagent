import assert from "node:assert/strict";
import test from "node:test";
import register from "./index.ts";

test("default export registers a tool named 'subagent' with the expected schema", () => {
  let registered = null;
  const fakePi = {
    registerTool(def) {
      registered = def;
    },
  };
  register(fakePi);

  assert.ok(registered, "registerTool was not called");
  assert.equal(registered.name, "subagent");
  assert.equal(registered.label, "Subagent");
  assert.equal(typeof registered.description, "string");
  assert.ok(registered.description.length > 0);
  assert.equal(typeof registered.execute, "function");

  // TypeBox schema has the shape we expect: top-level object with agent + task string properties.
  const schema = registered.parameters;
  assert.equal(schema.type, "object");
  assert.ok(schema.properties, "schema.properties missing");
  assert.equal(schema.properties.agent.type, "string");
  assert.equal(schema.properties.task.type, "string");
  assert.deepEqual(schema.required?.sort(), ["agent", "task"]);
});
