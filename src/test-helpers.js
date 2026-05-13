import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

export function makeTempAgentDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-subagent-test-"));
  const prev = process.env.PI_CODING_AGENT_DIR;
  process.env.PI_CODING_AGENT_DIR = dir;
  return {
    dir,
    agentsDir: path.join(dir, "agents"),
    settingsPath: path.join(dir, "settings.json"),
    cleanup() {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch {
        // ignore
      }
      if (prev === undefined) delete process.env.PI_CODING_AGENT_DIR;
      else process.env.PI_CODING_AGENT_DIR = prev;
    },
  };
}

export function writeAgentFile(dir, filename, frontmatter, body = "Test prompt body.") {
  fs.mkdirSync(dir, { recursive: true });
  const fmLines = ["---"];
  for (const [k, v] of Object.entries(frontmatter)) {
    if (v === undefined) continue;
    fmLines.push(`${k}: ${v}`);
  }
  fmLines.push("---", "", body, "");
  fs.writeFileSync(path.join(dir, filename), fmLines.join("\n"), "utf-8");
}

export function writeSettings(settingsPath, content) {
  fs.writeFileSync(
    settingsPath,
    typeof content === "string" ? content : JSON.stringify(content),
    "utf-8",
  );
}
