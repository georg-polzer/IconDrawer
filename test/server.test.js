const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");

const { createServer } = require("../server");

function request(port, pathname) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: "127.0.0.1",
        port,
        path: pathname,
        method: "GET",
      },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body,
          });
        });
      },
    );

    req.on("error", reject);
    req.end();
  });
}

test("serves the app shell", async () => {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

  try {
    const address = server.address();
    const response = await request(address.port, "/");
    assert.equal(response.statusCode, 200);
    assert.match(response.headers["content-type"], /text\/html/);
    assert.match(response.body, /IconDrawer/);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test("returns the icon index and individual SVGs", async () => {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

  try {
    const address = server.address();
    const iconsResponse = await request(address.port, "/api/icons");
    assert.equal(iconsResponse.statusCode, 200);

    const payload = JSON.parse(iconsResponse.body);
    assert.ok(Array.isArray(payload.icons));
    assert.ok(payload.icons.length > 5000);
    assert.ok(payload.icons.some((icon) => icon.name === "search" && icon.styles.includes("filled")));

    const svgResponse = await request(address.port, "/api/icon/outline/arrow-left");
    assert.equal(svgResponse.statusCode, 200);
    assert.match(svgResponse.headers["content-type"], /image\/svg\+xml/);
    assert.match(svgResponse.body, /icon-tabler-arrow-left/);

    const filledSvgResponse = await request(address.port, "/api/icon/filled/search");
    assert.equal(filledSvgResponse.statusCode, 200);
    assert.match(filledSvgResponse.headers["content-type"], /image\/svg\+xml/);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});
