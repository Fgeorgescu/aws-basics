const http = require("http");
const fs   = require("fs");
const path = require("path");

const PORT = 3000;
const DIR  = __dirname;
const RES  = path.join(DIR, "resources");

// Files served directly from the project root (GitHub/tooling conventions)
const ROOT_FILES = ["CLAUDE.md", "README.md"];

function getFiles() {
  const files = [];

  for (const f of ROOT_FILES) {
    if (fs.existsSync(path.join(DIR, f)))
      files.push({ name: f, hasFull: false });
  }

  if (!fs.existsSync(RES)) return files;

  for (const entry of fs.readdirSync(RES, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      const dir      = entry.name;
      const hasFull  = fs.existsSync(path.join(RES, dir, "full.md"));
      const hasSumm  = fs.existsSync(path.join(RES, dir, "summary.md"));
      if (hasFull || hasSumm) files.push({ name: dir + ".md", hasFull });
    } else if (entry.name.endsWith(".md")) {
      files.push({ name: entry.name, hasFull: false });
    }
  }

  return files;
}

function resolvePath(mode, name) {
  const base = name.replace(/\.md$/, "");

  if (mode === "full") {
    const p = path.join(RES, base, "full.md");
    if (fs.existsSync(p)) return p;
    // fall through to summary
  }

  // summary: topic subfolder
  const subSummary = path.join(RES, base, "summary.md");
  if (fs.existsSync(subSummary)) return subSummary;

  // flat file in resources/ (e.g. videos.md)
  const flat = path.join(RES, name);
  if (fs.existsSync(flat)) return flat;

  // root file (CLAUDE.md, README.md)
  const root = path.join(DIR, name);
  if (fs.existsSync(root)) return root;

  return null;
}

http
  .createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);

    if (url.pathname === "/" || url.pathname === "/index.html") {
      return serveFile(res, path.join(DIR, "index.html"), "text/html");
    }

    if (url.pathname === "/api/files") {
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify(getFiles()));
    }

    if (url.pathname.startsWith("/file/")) {
      const parts = url.pathname.split("/").filter(Boolean); // ["file", mode, "name.md"]
      if (parts.length < 3) return send(res, 400, "Bad request");

      const mode = parts[1];
      const name = path.basename(parts[2]);

      if (!["summary", "full"].includes(mode)) return send(res, 400, "Bad request");
      if (!name.endsWith(".md"))               return send(res, 400, "Bad request");

      const filePath = resolvePath(mode, name);
      if (!filePath) return send(res, 404, "Not found");

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
