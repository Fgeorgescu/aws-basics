const http = require("http");
const fs = require("fs");
const path = require("path");

const DIR = __dirname;
const PORT = 3000;

http
  .createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);

    if (url.pathname === "/" || url.pathname === "/index.html") {
      return serveFile(res, path.join(DIR, "index.html"), "text/html");
    }

    // GET /api/files → list .md files present in both summary (root) and full/
    if (url.pathname === "/api/files") {
      const summaryFiles = fs.readdirSync(DIR).filter((f) => f.endsWith(".md")).sort();
      const fullDir = path.join(DIR, "full");
      const fullFiles = fs.existsSync(fullDir)
        ? fs.readdirSync(fullDir).filter((f) => f.endsWith(".md"))
        : [];
      const fullSet = new Set(fullFiles);
      const files = summaryFiles.map((f) => ({ name: f, hasFull: fullSet.has(f) }));
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify(files));
    }

    // GET /file/summary/name.md or /file/full/name.md
    if (url.pathname.startsWith("/file/")) {
      const parts = url.pathname.split("/").filter(Boolean); // ["file", "summary"|"full", "name.md"]
      if (parts.length < 3) return send(res, 400, "Bad request");

      const mode = parts[1];
      const name = path.basename(parts[2]);

      if (!["summary", "full"].includes(mode)) return send(res, 400, "Bad request");
      if (!name.endsWith(".md")) return send(res, 400, "Bad request");

      const baseDir = mode === "full" ? path.join(DIR, "full") : DIR;
      const filePath = path.join(baseDir, name);

      if (!filePath.startsWith(baseDir)) return send(res, 400, "Bad request");
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
