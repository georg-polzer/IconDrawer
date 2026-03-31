const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const url = require("node:url");

const HOST = "127.0.0.1";
const PORT = Number(process.env.PORT || 4173);
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const ICONS_ROOT_DIR = path.join(ROOT, "node_modules", "@tabler", "icons", "icons");
const ICONS_META_PATH = path.join(ROOT, "node_modules", "@tabler", "icons", "icons.json");

const iconMetadata = JSON.parse(fs.readFileSync(ICONS_META_PATH, "utf8"));
const iconIndex = Object.values(iconMetadata)
  .filter((entry) => entry?.styles?.outline)
  .map((entry) => ({
    name: entry.name,
    category: entry.category || "",
    tags: Array.isArray(entry.tags) ? entry.tags.map(String) : [],
    styles: Object.keys(entry.styles || {}),
  }))
  .sort((left, right) => left.name.localeCompare(right.name));

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8",
};

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(payload));
}

function sendText(response, statusCode, body, contentType) {
  response.writeHead(statusCode, {
    "Content-Type": contentType,
    "Cache-Control": "no-store",
  });
  response.end(body);
}

function serveStaticFile(response, filePath) {
  fs.readFile(filePath, (error, body) => {
    if (error) {
      sendText(response, 404, "Not found", "text/plain; charset=utf-8");
      return;
    }

    const extension = path.extname(filePath);
    response.writeHead(200, {
      "Content-Type": mimeTypes[extension] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    response.end(body);
  });
}

function sanitizeIconName(value) {
  return /^[a-z0-9-]+$/.test(value) ? value : null;
}

function handleApi(response, parsedUrl) {
  if (parsedUrl.pathname === "/api/icons") {
    sendJson(response, 200, { icons: iconIndex });
    return true;
  }

  const match = parsedUrl.pathname.match(/^\/api\/icon\/(outline|filled)\/([a-z0-9-]+)$/);
  if (!match) {
    return false;
  }

  const style = match[1];
  const iconName = sanitizeIconName(match[2]);
  if (!iconName) {
    sendJson(response, 400, { error: "Invalid icon name." });
    return true;
  }

  const iconPath = path.join(ICONS_ROOT_DIR, style, `${iconName}.svg`);
  if (!iconPath.startsWith(path.join(ICONS_ROOT_DIR, style))) {
    sendJson(response, 400, { error: "Invalid icon path." });
    return true;
  }

  fs.readFile(iconPath, "utf8", (error, svg) => {
    if (error) {
      sendJson(response, 404, { error: "Icon not found." });
      return;
    }

    sendText(response, 200, svg, "image/svg+xml; charset=utf-8");
  });

  return true;
}

function createServer() {
  return http.createServer((request, response) => {
    const parsedUrl = url.parse(request.url || "/", true);

    if (parsedUrl.pathname?.startsWith("/api/")) {
      if (!handleApi(response, parsedUrl)) {
        sendJson(response, 404, { error: "Unknown API route." });
      }
      return;
    }

    const requestedPath = parsedUrl.pathname === "/" ? "/index.html" : parsedUrl.pathname || "/index.html";
    const safePath = path.normalize(requestedPath).replace(/^(\.\.[/\\])+/, "");
    const filePath = path.join(PUBLIC_DIR, safePath);

    if (!filePath.startsWith(PUBLIC_DIR)) {
      sendText(response, 403, "Forbidden", "text/plain; charset=utf-8");
      return;
    }

    serveStaticFile(response, filePath);
  });
}

if (require.main === module) {
  const server = createServer();
  server.listen(PORT, HOST, () => {
    console.log(`IconDrawer running at http://${HOST}:${PORT}`);
  });
}

module.exports = {
  createServer,
};
