import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import test from "node:test";
import { discoverAgents } from "./agents.ts";
import { makeTempAgentDir, writeAgentFile } from "./test-helpers.js";

test("discoverAgents loads a valid role from the user dir", () => {
  const ctx = makeTempAgentDir();
  try {
    writeAgentFile(
      ctx.agentsDir,
      "scout.md",
      {
        name: "scout",
        description: "fast reconnaissance",
        model: "qwen-coder:latest",
        thinking: "off",
      },
      "You are a scout.",
    );
    const { agents } = discoverAgents(ctx.dir);
    assert.equal(agents.length, 1);
    assert.equal(agents[0].name, "scout");
    assert.equal(agents[0].description, "fast reconnaissance");
    assert.equal(agents[0].model, "qwen-coder:latest");
    assert.equal(agents[0].thinking, "off");
    assert.equal(agents[0].systemPrompt, "You are a scout.");
  } finally {
    ctx.cleanup();
  }
});

test("discoverAgents skips files missing name or description", () => {
  const ctx = makeTempAgentDir();
  try {
    writeAgentFile(ctx.agentsDir, "no-name.md", { description: "x" });
    writeAgentFile(ctx.agentsDir, "no-desc.md", { name: "x" });
    writeAgentFile(ctx.agentsDir, "good.md", { name: "good", description: "ok" });
    const { agents } = discoverAgents(ctx.dir);
    assert.deepEqual(
      agents.map((a) => a.name),
      ["good"],
    );
  } finally {
    ctx.cleanup();
  }
});

test("discoverAgents skips files with bad frontmatter", () => {
  const ctx = makeTempAgentDir();
  try {
    fs.mkdirSync(ctx.agentsDir, { recursive: true });
    fs.writeFileSync(path.join(ctx.agentsDir, "garbled.md"), "no frontmatter at all", "utf-8");
    fs.writeFileSync(path.join(ctx.agentsDir, "halfopen.md"), "---\nname: foo\n(no closing)", "utf-8");
    writeAgentFile(ctx.agentsDir, "good.md", { name: "good", description: "ok" });
    const { agents } = discoverAgents(ctx.dir);
    assert.deepEqual(
      agents.map((a) => a.name),
      ["good"],
    );
  } finally {
    ctx.cleanup();
  }
});

test("project agents override user agents with the same name", () => {
  const ctx = makeTempAgentDir();
  const projectRoot = fs.mkdtempSync(path.join(ctx.dir, "proj-"));
  try {
    writeAgentFile(
      ctx.agentsDir,
      "scout.md",
      { name: "scout", description: "user-level" },
      "user body",
    );
    const projectAgents = path.join(projectRoot, ".pi", "agents");
    writeAgentFile(
      projectAgents,
      "scout.md",
      { name: "scout", description: "project-level" },
      "project body",
    );
    const { agents, projectAgentsDir } = discoverAgents(projectRoot);
    assert.equal(agents.length, 1);
    assert.equal(agents[0].description, "project-level");
    assert.equal(agents[0].systemPrompt, "project body");
    assert.equal(projectAgentsDir, projectAgents);
  } finally {
    ctx.cleanup();
  }
});

test("findProjectAgentsDir walks up from a nested cwd", () => {
  const ctx = makeTempAgentDir();
  const projectRoot = fs.mkdtempSync(path.join(ctx.dir, "proj-"));
  const nested = path.join(projectRoot, "deep", "deeper");
  fs.mkdirSync(nested, { recursive: true });
  try {
    const projectAgents = path.join(projectRoot, ".pi", "agents");
    writeAgentFile(
      projectAgents,
      "scout.md",
      { name: "scout", description: "found" },
      "ok",
    );
    const { projectAgentsDir, agents } = discoverAgents(nested);
    assert.equal(projectAgentsDir, projectAgents);
    assert.equal(agents[0]?.name, "scout");
  } finally {
    ctx.cleanup();
  }
});

test("discoverAgents returns empty when nothing exists", () => {
  const ctx = makeTempAgentDir();
  try {
    const { agents, projectAgentsDir } = discoverAgents(ctx.dir);
    assert.deepEqual(agents, []);
    assert.equal(projectAgentsDir, null);
  } finally {
    ctx.cleanup();
  }
});

test("discoverAgents returns roles sorted by name", () => {
  const ctx = makeTempAgentDir();
  try {
    writeAgentFile(ctx.agentsDir, "zebra.md", { name: "zebra", description: "z" });
    writeAgentFile(ctx.agentsDir, "apple.md", { name: "apple", description: "a" });
    writeAgentFile(ctx.agentsDir, "mango.md", { name: "mango", description: "m" });
    const names = discoverAgents(ctx.dir).agents.map((a) => a.name);
    assert.deepEqual(names, ["apple", "mango", "zebra"]);
  } finally {
    ctx.cleanup();
  }
});
