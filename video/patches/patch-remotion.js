#!/usr/bin/env node
/**
 * Patches @remotion/renderer for Android/Termux where os.cpus() returns [].
 */
const fs = require("fs");
const path = require("path");

const target = path.join(
  __dirname,
  "..",
  "node_modules",
  "@remotion",
  "renderer",
  "dist",
  "check-apple-silicon.js"
);

if (!fs.existsSync(target)) {
  console.log("Patch target not found, skipping.");
  process.exit(0);
}

let content = fs.readFileSync(target, "utf8");
const guard = "if (!cpus || cpus.length === 0) return;";

if (!content.includes(guard)) {
  content = content.replace(
    "const cpus = os.cpus();",
    `const cpus = os.cpus();\n    ${guard}`
  );
  fs.writeFileSync(target, content);
  console.log("Patched @remotion/renderer for Android compatibility.");
} else {
  console.log("Patch already applied.");
}
