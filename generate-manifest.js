// Generates files.json used by index.html on GitHub Pages.
// Run: node generate-manifest.js
const fs   = require("fs");
const path = require("path");

const DIR  = __dirname;
const RES  = path.join(DIR, "resources");

const ROOT_FILES = ["CLAUDE.md", "README.md"];

function getCategoryFiles(catDir) {
  const catPath = path.join(RES, catDir);
  const files = [];

  for (const sub of fs.readdirSync(catPath, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (sub.isDirectory()) {
      const topicDir = sub.name;
      const hasSumm = fs.existsSync(path.join(catPath, topicDir, "summary.md"));
      const hasFull = fs.existsSync(path.join(catPath, topicDir, "full.md"));
      if (!hasSumm && !hasFull) continue;
      files.push({
        name: topicDir + ".md",
        hasFull,
        summaryPath: `resources/${catDir}/${topicDir}/summary.md`,
        ...(hasFull && { fullPath: `resources/${catDir}/${topicDir}/full.md` }),
      });
    } else if (sub.name.endsWith(".md")) {
      files.push({
        name: sub.name,
        hasFull: false,
        summaryPath: `resources/${catDir}/${sub.name}`,
      });
    }
  }

  return files;
}

const rootFiles = [];
for (const f of ROOT_FILES) {
  if (fs.existsSync(path.join(DIR, f)))
    rootFiles.push({ name: f, hasFull: false, summaryPath: f });
}

const categories = [];
for (const entry of fs.readdirSync(RES, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
  if (!entry.isDirectory()) continue;
  const catFiles = getCategoryFiles(entry.name);
  if (catFiles.length > 0)
    categories.push({ id: entry.name, files: catFiles });
}

const manifest = { rootFiles, categories };
fs.writeFileSync(path.join(DIR, "files.json"), JSON.stringify(manifest, null, 2));

const total = categories.reduce((n, c) => n + c.files.length, 0);
console.log(`files.json written — ${rootFiles.length} root files, ${categories.length} categories, ${total} topics`);
