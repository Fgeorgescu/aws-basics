const http = require("http");
const fs   = require("fs");
const path = require("path");

const PORT = 3000;
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

function getManifest() {
  const rootFiles = [];
  for (const f of ROOT_FILES) {
    if (fs.existsSync(path.join(DIR, f)))
      rootFiles.push({ name: f, hasFull: false, summaryPath: f });
  }

  const categories = [];
  if (!fs.existsSync(RES)) return { rootFiles, categories };

  for (const entry of fs.readdirSync(RES, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory()) continue;
    const catDir = entry.name;
    const catFiles = getCategoryFiles(catDir);
    if (catFiles.length > 0) {
      categories.push({ id: catDir, files: catFiles });
    }
  }

  return { rootFiles, categories };
}

http
  .createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);

    if (url.pathname === "/" || url.pathname === "/index.html") {
      return serveFile(res, path.join(DIR, "index.html"), "text/html");
    }

    if (url.pathname === "/files.json") {
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify(getManifest(), null, 2));
    }

    if (url.pathname.startsWith("/resources/") || url.pathname === "/CLAUDE.md" || url.pathname === "/README.md") {
      const filePath = path.join(DIR, url.pathname);
      if (!filePath.startsWith(DIR + path.sep) && filePath !== DIR) return send(res, 400, "Bad request");
      if (!fs.existsSync(filePath)) return send(res, 404, "Not found");
      return serveFile(res, filePath, "text/plain; charset=utf-8");
    }

    send(res, 404, "Not found");
  })
  .listen(PORT, () => {
    console.log(`Docs viewer → http://localhost:${PORT}`);
  });

function serveFile(res, filePath, contentType) {
  fs.readFile(filePath, (err, data) => {
    if (err) return send(res, 500, "Server error");
    res.writeHead(200, { "Content-Type": contentType });
    res.end(data);
  });
}

function send(res, status, body) {
  res.writeHead(status);
  res.end(body);
}
