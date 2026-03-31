const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const url = require("node:url");

const HOST = "127.0.0.1";
const PORT = Number(process.env.PORT || 4173);
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");

const LIBRARIES = {
  tabler: {
    label: "Tabler",
    getIcons() {
      const metaPath = path.join(ROOT, "node_modules", "@tabler", "icons", "icons.json");
      const iconMetadata = JSON.parse(fs.readFileSync(metaPath, "utf8"));

      return Object.values(iconMetadata)
        .filter((entry) => entry?.styles?.outline)
        .map((entry) => ({
          library: "tabler",
          name: entry.name,
          category: entry.category || "",
          tags: Array.isArray(entry.tags) ? entry.tags.map(String) : [],
          styles: Object.keys(entry.styles || {}),
        }));
    },
    resolveIconPath(style, name) {
      return path.join(ROOT, "node_modules", "@tabler", "icons", "icons", style, `${name}.svg`);
    },
  },
  lucide: {
    label: "Lucide",
    getIcons() {
      const metaPath = path.join(ROOT, "node_modules", "lucide-static", "icon-nodes.json");
      const iconMetadata = JSON.parse(fs.readFileSync(metaPath, "utf8"));

      return Object.keys(iconMetadata).map((name) => ({
        library: "lucide",
        name,
        category: "Lucide",
        tags: [],
        styles: ["outline"],
      }));
    },
    resolveIconPath(style, name) {
      if (style !== "outline") {
        return null;
      }

      return path.join(ROOT, "node_modules", "lucide-static", "icons", `${name}.svg`);
    },
  },
  phosphor: {
    label: "Phosphor",
    getIcons() {
      const regularDir = path.join(ROOT, "node_modules", "@phosphor-icons", "core", "assets", "regular");
      const fillDir = path.join(ROOT, "node_modules", "@phosphor-icons", "core", "assets", "fill");
      const regularNames = new Set(listSvgNames(regularDir));
      const fillNames = new Set(listSvgNames(fillDir).map((name) => name.replace(/-fill$/, "")));
      const allNames = new Set([...regularNames, ...fillNames]);

      return [...allNames]
        .sort()
        .map((name) => ({
          library: "phosphor",
          name,
          category: "Phosphor",
          tags: [],
          styles: [
            ...(regularNames.has(name) ? ["outline"] : []),
            ...(fillNames.has(name) ? ["filled"] : []),
          ],
        }));
    },
    resolveIconPath(style, name) {
      if (style === "filled") {
        return path.join(ROOT, "node_modules", "@phosphor-icons", "core", "assets", "fill", `${name}-fill.svg`);
      }

      return path.join(ROOT, "node_modules", "@phosphor-icons", "core", "assets", "regular", `${name}.svg`);
    },
  },
  iconoir: {
    label: "Iconoir",
    getIcons() {
      const regularDir = path.join(ROOT, "node_modules", "iconoir", "icons", "regular");
      const solidDir = path.join(ROOT, "node_modules", "iconoir", "icons", "solid");
      const regularNames = new Set(listSvgNames(regularDir));
      const solidNames = new Set(listSvgNames(solidDir));
      const allNames = new Set([...regularNames, ...solidNames]);

      return [...allNames]
        .sort()
        .map((name) => ({
          library: "iconoir",
          name,
          category: "Iconoir",
          tags: [],
          styles: [
            ...(regularNames.has(name) ? ["outline"] : []),
            ...(solidNames.has(name) ? ["filled"] : []),
          ],
        }));
    },
    resolveIconPath(style, name) {
      const nativeStyle = style === "filled" ? "solid" : "regular";
      return path.join(ROOT, "node_modules", "iconoir", "icons", nativeStyle, `${name}.svg`);
    },
  },
};

const librariesIndex = Object.entries(LIBRARIES).map(([key, config]) => ({
  key,
  label: config.label,
}));

const iconIndex = Object.values(LIBRARIES)
  .flatMap((library) => library.getIcons())
  .sort((left, right) => {
    const nameCompare = left.name.localeCompare(right.name);
    return nameCompare || left.library.localeCompare(right.library);
  });

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8",
};

function listSvgNames(directory) {
  return fs.readdirSync(directory)
    .filter((filename) => filename.endsWith(".svg"))
    .map((filename) => filename.slice(0, -4));
}

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
    sendJson(response, 200, {
      icons: iconIndex,
      libraries: librariesIndex,
    });
    return true;
  }

  const match = parsedUrl.pathname.match(/^\/api\/icon\/([a-z]+)\/(outline|filled)\/([a-z0-9-]+)$/);
  if (!match) {
    return false;
  }

  const libraryKey = match[1];
  const style = match[2];
  const iconName = sanitizeIconName(match[3]);
  if (!iconName) {
    sendJson(response, 400, { error: "Invalid icon name." });
    return true;
  }

  const library = LIBRARIES[libraryKey];
  if (!library) {
    sendJson(response, 404, { error: "Unknown library." });
    return true;
  }

  const iconPath = library.resolveIconPath(style, iconName);
  if (!iconPath) {
    sendJson(response, 404, { error: "Icon style not found." });
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
