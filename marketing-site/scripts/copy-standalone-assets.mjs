import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const standaloneBase = join(root, ".next", "standalone");
const standaloneRoot = [
  join(standaloneBase, "marketing-site"),
  standaloneBase,
].find((dir) => existsSync(join(dir, "server.js")));

if (!standaloneRoot) {
  process.exit(0);
}

const copies = [
  [join(root, ".next", "static"), join(standaloneRoot, ".next", "static")],
  [join(root, "public"), join(standaloneRoot, "public")],
];

for (const [from, to] of copies) {
  if (!existsSync(from)) continue;
  mkdirSync(dirname(to), { recursive: true });
  cpSync(from, to, { recursive: true });
}
