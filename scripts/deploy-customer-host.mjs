import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const parent = path.dirname(root);
const parentReal = fs.realpathSync(parent);

const isHostingerHbuilds = parentReal.includes("/hbuilds/") || parentReal.includes("\\hbuilds\\");
if (!isHostingerHbuilds) {
  console.log("deploy-customer-host: not a Hostinger hbuilds build — skipping customer static deploy");
  process.exit(0);
}

const appDir = path.join(root, "customer-app");
const src = path.join(appDir, "www", "browser");
const dest = path.join(parentReal, "public_html", "aurashinecustomer");

const run = (cmd, cwd, env) =>
  execSync(cmd, {
    cwd,
    stdio: "inherit",
    env: { ...process.env, ...env, NODE_OPTIONS: "--max-old-space-size=4096" },
  });

try {
  console.log("deploy-customer-host: building customer-app on Hostinger");
  try {
    run("npm --prefix customer-app run build", root, {});
  } catch {
    console.log("deploy-customer-host: build failed, installing customer-app deps and retrying");
    run("npm --prefix customer-app install --legacy-peer-deps --no-audit --no-fund", root, {});
    run("npm --prefix customer-app run build", root, {});
  }

  if (!fs.existsSync(path.join(src, "index.html"))) {
    console.error("deploy-customer-host: customer-app build output missing index.html");
    process.exit(0);
  }

  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(dest, { recursive: true });
  fs.cpSync(src, dest, { recursive: true });

  fs.writeFileSync(
    path.join(dest, ".htaccess"),
    [
      "<IfModule mod_rewrite.c>",
      "  RewriteEngine On",
      "  RewriteBase /",
      "  RewriteCond %{REQUEST_FILENAME} -f [OR]",
      "  RewriteCond %{REQUEST_FILENAME} -d",
      "  RewriteRule ^ - [L]",
      "  RewriteRule ^ index.html [L]",
      "</IfModule>",
      "",
    ].join("\n"),
    "ascii",
  );

  for (const tab of ["home", "my-salon", "my-salons", "bookings", "search", "profile"]) {
    const tabDir = path.join(dest, "tabs", tab);
    fs.mkdirSync(tabDir, { recursive: true });
    fs.copyFileSync(path.join(dest, "index.html"), path.join(tabDir, "index.html"));
  }

  console.log("deploy-customer-host: deployed customer app to " + dest);
} catch (err) {
  console.error("deploy-customer-host: failed (" + err.message + ") — root build continues");
}
