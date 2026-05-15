const http = require("http");
const fs   = require("fs");
const path = require("path");

const PORT = 3000;
const DIR  = __dirname;
const RES  = path.join(DIR, "resources");

const ROOT_FILES = ["CLAUDE.md", "README.md"];

function getFiles() {
  const files = [];

  for (const f of ROOT_FILES) {
    if (fs.existsSync(path.join(DIR, f)))
      files.push({ name: f, hasFull: false, summaryPath: f });
  }

  if (!fs.existsSync(RES)) return files;

  for (const entry of fs.readdirSync(RES, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.isDirectory()) {
      const dir     = entry.name;
      const hasSumm = fs.existsSync(path.join(RES, dir, "summary.md"));
      const hasFull = fs.existsSync(path.join(RES, dir, "full.md"));
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

  return files;
}

http
  .createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);

    if (url.pathname === "/" || url.pathname === "/index.html") {
      return serveFile(res, path.join(DIR, "index.html"), "text/html");
    }

    // Static manifest — generate dynamically so local dev never needs a pre-built files.json
    if (url.pathname === "/files.json") {
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify(getFiles(), null, 2));
    }

    // Static files: resources/** and root markdown files
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
