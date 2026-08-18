import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const standaloneRoot = join(root, ".next", "standalone", "marketing-site");

const copies = [
  [join(root, ".next", "static"), join(standaloneRoot, ".next", "static")],
  [join(root, "public"), join(standaloneRoot, "public")],
];

for (const [from, to] of copies) {
  if (!existsSync(from) || !existsSync(standaloneRoot)) continue;
  mkdirSync(dirname(to), { recursive: true });
  cpSync(from, to, { recursive: true });
}
