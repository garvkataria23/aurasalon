import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const standaloneBase = join(root, ".next", "standalone");
const serverFile = [
  join(standaloneBase, "marketing-site", "server.js"),
  join(standaloneBase, "server.js"),
].find((file) => existsSync(file));

if (!serverFile) {
  console.error("Standalone server.js was not found. Run `npm run build` before `npm start`.");
  process.exit(1);
}

const standaloneRoot = dirname(serverFile);
const requiredArtifacts = [
  join(standaloneRoot, ".next", "BUILD_ID"),
  join(standaloneRoot, ".next", "server", "app"),
  join(standaloneRoot, ".next", "server", "app-paths-manifest.json"),
];
const missingArtifact = requiredArtifacts.find((file) => !existsSync(file));

if (missingArtifact) {
  console.error("Standalone build is incomplete. Stop the running server and run `npm run build` before `npm start`.");
  console.error(`Missing: ${missingArtifact}`);
  process.exit(1);
}

const child = spawn(process.execPath, [serverFile], {
  cwd: standaloneRoot,
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
