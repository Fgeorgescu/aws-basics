// Generates files.json used by index.html in both GitHub Pages and local dev.
// Run: node generate-manifest.js
const fs   = require("fs");
const path = require("path");

const DIR  = __dirname;
const RES  = path.join(DIR, "resources");

const ROOT_FILES = ["CLAUDE.md", "README.md"];
const files = [];

for (const f of ROOT_FILES) {
  if (fs.existsSync(path.join(DIR, f)))
    files.push({ name: f, hasFull: false, summaryPath: f });
}

for (const entry of fs.readdirSync(RES, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
  if (entry.isDirectory()) {
    const dir      = entry.name;
    const hasSumm  = fs.existsSync(path.join(RES, dir, "summary.md"));
    const hasFull  = fs.existsSync(path.join(RES, dir, "full.md"));
    if (!hasSumm && !hasFull) continue;
    files.push({
      name: dir + ".md",
      hasFull,
      summaryPath: `resources/${dir}/summary.md`,
      ...(hasFull && { fullPath: `resources/${dir}/full.md` }),
    });
  } else if (entry.name.endsWith(".md")) {
    files.push({ name: entry.name, hasFull: false, summaryPath: `resources/${entry.name}` });
  }
}

fs.writeFileSync(path.join(DIR, "files.json"), JSON.stringify(files, null, 2));
console.log(`files.json written — ${files.length} entries`);
