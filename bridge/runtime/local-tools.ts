import { promises as fs } from "node:fs";
import path from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { defineTool } from "../../src/agent/browser-tools";
import { aborted, type RunContext, type ToolOutput } from "../../src/agent/protocol";
import { validateToolArguments } from "../../src/agent/schema";

const text = { type: "string" };
const offset = { type: "integer", minimum: 0 };
export const LOCAL_TOOLS = [
  defineTool("fs_list", "List a directory inside the selected workspace; returns at most 400 entries with nextOffset for pagination.", { path: text, offset }, ["path"]),
  defineTool("fs_read", "Read numbered lines from a UTF-8 workspace file (up to 8 MB). startLine is 1-based; limit defaults to 200, maximum 2000. Follow nextLine for the rest.", { path: text, startLine: { type: "integer", minimum: 1 }, limit: { type: "integer", minimum: 1, maximum: 2000 } }, ["path"]),
  defineTool("fs_write", "Create or replace a UTF-8 file inside the workspace, with user approval. Provide expectedContent when replacing a file to protect concurrent edits.", { path: text, content: text, expectedContent: text }, ["path", "content"]),
  defineTool("fs_edit", "Apply a precise text replacement with approval. oldText must occur exactly once; include surrounding lines to disambiguate. Checks the file again after approval to protect concurrent edits.", { path: text, oldText: text, newText: text }, ["path", "oldText", "newText"]),
  defineTool("fs_search", "Search text in workspace files; ignores hidden directories, node_modules and build output. Literal case-insensitive search, maximum 100 hits.", { query: text }, ["query"]),
  defineTool("shell_start", "Execute a shell command from the workspace AFTER explicit approval. This is not an OS sandbox: commands can access anything allowed to the OS user. Returns a process ID for long commands.", { command: text }, ["command"]),
  defineTool("process_read", "Read output/status of a process started in this turn.", { processId: text }, ["processId"]),
  defineTool("process_stop", "Stop a process started in this turn.", { processId: text }, ["processId"])
];
export async function workspacePath(root: string, relative: string, creating = false): Promise<string> {
  if (typeof relative !== "string" || relative.includes("\0")) throw new Error("Invalid path");
  const base = await fs.realpath(root);
  const resolved = path.resolve(base, relative);
  let canonical: string;
  try { canonical = await fs.realpath(resolved); }
  catch (error) {
    if (!creating || (error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    canonical = path.join(await fs.realpath(path.dirname(resolved)), path.basename(resolved));
  }
  if (canonical !== base && !canonical.startsWith(base + path.sep)) throw new Error("Path escapes the authorized workspace");
  return canonical;
}
export function killProcess(child: ChildProcess): void {
  try {
    if (process.platform !== "win32" && child.pid) {
      process.kill(-child.pid, "SIGTERM");
      // Keep the runtime alive until escalation runs: the shell may have exited
      // while a background descendant ignores SIGTERM with all stdio redirected.
      setTimeout(() => { try { process.kill(-child.pid!, "SIGKILL"); } catch { /* already gone */ } }, 2000);
    } else if (child.pid) {
      const killer = spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
      killer.on("error", () => child.kill());
    } else child.kill();
  } catch { child.kill(); }
}
export function localExecutor(workspace: string, context: RunContext) {
  const processes = new Map<string, { child: ChildProcess; output: string; code: number | null; done: boolean }>();
  const approve = async (id: string, title: string, detail: string) => {
    if (await context.ask({ id, kind: "approval", title, detail }) !== "allow") throw new Error("User denied operation; do not bypass.");
    aborted(context.signal);
  };
  return {
    close: () => { for (const { child } of processes.values()) killProcess(child); },
    async execute(name: string, args: Record<string, unknown>, id: string): Promise<ToolOutput> {
      aborted(context.signal);
      validateToolArguments(LOCAL_TOOLS, name, args);
      if (name === "fs_list") {
        const entries = await fs.readdir(await workspacePath(workspace, String(args.path)), { withFileTypes: true });
        entries.sort((a, b) => a.name.localeCompare(b.name));
        const start = Number(args.offset ?? 0);
        return { text: JSON.stringify({ entries: entries.slice(start, start + 400).map(entry => ({ name: entry.name, directory: entry.isDirectory() })), total: entries.length, nextOffset: start + 400 < entries.length ? start + 400 : null }) };
      }
      if (name === "fs_read") {
        const target = await workspacePath(workspace, String(args.path));
        const stat = await fs.stat(target);
        if (!stat.isFile() || stat.size > 8 * 1024 * 1024) throw new Error("Only text files up to 8 MB can be read; use an approved command for larger files");
        const content = await fs.readFile(target, "utf8");
        if (content.includes("\0")) throw new Error("Binary file: use a tool suitable for this format");
        const lines = content.split("\n"); const start = Number(args.startLine ?? 1); const limit = Number(args.limit ?? 200);
        const selected: string[] = []; let length = 0;
        for (let index = start - 1; index < Math.min(lines.length, start - 1 + limit); index++) {
          if (lines[index].length > 55_000) throw new Error(`Line ${index + 1} exceeds the output limit; use an approved command to inspect it`);
          if (length + lines[index].length > 55_000) break;
          selected.push(`${index + 1}: ${lines[index]}`); length += lines[index].length + 10;
        }
        return { text: JSON.stringify({ path: args.path, startLine: start, totalLines: lines.length, nextLine: start + selected.length <= lines.length ? start + selected.length : null, content: selected.join("\n") }) };
      }
      if (name === "fs_write" || name === "fs_edit") {
        const target = await workspacePath(workspace, String(args.path), name === "fs_write");
        let previous: string | undefined;
        let mode = 0o600;
        try {
          const stat = await fs.stat(target); mode = stat.mode & 0o777;
          if (!stat.isFile() || stat.size > 8 * 1024 * 1024) throw new Error("Only text files up to 8 MB can be edited");
          previous = await fs.readFile(target, "utf8");
          if (previous.includes("\0")) throw new Error("Cannot edit a binary file as text");
        } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
        let content: string;
        if (name === "fs_edit") {
          const oldText = String(args.oldText); const newText = String(args.newText);
          if (!oldText || oldText.length > 100_000 || newText.length > 100_000 || previous === undefined) throw new Error("Invalid edit");
          const position = previous.indexOf(oldText);
          if (position < 0 || previous.indexOf(oldText, position + 1) !== -1) throw new Error("oldText must match exactly once; read the current file and include enough context");
          content = previous.slice(0, position) + newText + previous.slice(position + oldText.length);
        } else {
          if (typeof args.content !== "string" || args.content.length > 100_000) throw new Error("Invalid file content");
          if (previous !== undefined && args.expectedContent !== previous) throw new Error("Read the file and provide its exact expectedContent before replacing it");
          content = args.content;
        }
        await approve(id, name, JSON.stringify({ path: target, before: name === "fs_edit" ? args.oldText : previous ?? "(new file)", after: name === "fs_edit" ? args.newText : content }));
        if (await workspacePath(workspace, String(args.path), true) !== target) throw new Error("Path changed during approval");
        if (previous !== undefined && await fs.readFile(target, "utf8") !== previous) throw new Error("File changed during approval");
        const temp = path.join(path.dirname(target), `.wam-${crypto.randomUUID()}.tmp`);
        try {
          await fs.writeFile(temp, content, { flag: "wx", mode });
          aborted(context.signal);
          if (previous === undefined) { await fs.link(temp, target); await fs.unlink(temp); }
          else await fs.rename(temp, target);
        } finally { await fs.unlink(temp).catch(() => undefined); }
        return { text: `Saved ${target}` };
      }
      if (name === "fs_search") {
        if (typeof args.query !== "string" || !args.query || args.query.length > 500) throw new Error("Invalid search query");
        const needle = args.query.toLowerCase();
        const hits: unknown[] = [];
        let visited = 0;
        const walk = async (dir: string) => {
          for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
            aborted(context.signal);
            if (hits.length >= 100 || ++visited > 3000) return;
            if (entry.isSymbolicLink() || entry.name.startsWith(".") || ["node_modules", "target", "dist"].includes(entry.name)) continue;
            const file = path.join(dir, entry.name);
            if (entry.isDirectory()) await walk(file);
            else if (entry.isFile() && (await fs.stat(file)).size <= 8 * 1024 * 1024) {
              const content = await fs.readFile(file, "utf8");
              if (content.includes("\0")) continue;
              content.split("\n").forEach((line, index) => { if (hits.length < 100 && line.toLowerCase().includes(needle)) hits.push({ path: path.relative(workspace, file), line: index + 1, text: line.slice(0, 300) }); });
            }
          }
        };
        await walk(await fs.realpath(workspace));
        return { text: JSON.stringify({ hits, limited: visited > 3000 || hits.length >= 100 }) };
      }
      if (name === "shell_start") {
        if (typeof args.command !== "string" || !args.command.trim() || args.command.length > 8000) throw new Error("Invalid command");
        if ([...processes.values()].filter(item => !item.done).length >= 4) throw new Error("At most four concurrent processes per turn");
        await approve(id, name, `Working directory: ${workspace}\nCommand: ${args.command}\nThis command is NOT sandboxed. It runs with your OS user's permissions.`);
        if (processes.size >= 32) {
          const completed = [...processes].find(([, item]) => item.done);
          if (completed) { killProcess(completed[1].child); processes.delete(completed[0]); }
        }
        // Never expose provider credentials to arbitrary child commands.
        const env = { ...process.env };
        for (const key of Object.keys(env)) if (/TOKEN|SECRET|API_KEY|PASSWORD/i.test(key)) delete env[key];
        const child = spawn(args.command, { cwd: workspace, shell: true, detached: process.platform !== "win32", env, stdio: ["ignore", "pipe", "pipe"] });
        const processId = crypto.randomUUID();
        const item = { child, output: "", code: null as number | null, done: false };
        processes.set(processId, item);
        const append = (data: Buffer) => { item.output = (item.output + data.toString()).slice(-60000); };
        child.stdout?.on("data", append); child.stderr?.on("data", append);
        child.on("error", error => { item.output += error.message; item.done = true; item.code = -1; });
        child.on("close", code => { item.code = code; item.done = true; });
        await new Promise(resolve => setTimeout(resolve, 300));
        return { text: JSON.stringify({ processId, output: item.output, done: item.done, exitCode: item.code }), isError: item.done && item.code !== 0 };
      }
      const item = processes.get(String(args.processId));
      if (!item) throw new Error("Unknown process from this turn");
      if (name === "process_stop") killProcess(item.child);
      else if (name !== "process_read") throw new Error("Unknown local tool");
      return { text: JSON.stringify({ processId: args.processId, output: item.output, done: item.done, exitCode: item.code }), isError: name === "process_read" && item.done && item.code !== 0 };
    }
  };
}
