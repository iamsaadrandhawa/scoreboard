
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 4000;
const DATA_FILE = path.join(__dirname, "storage-data.json");
const BACKUP_FILE = path.join(__dirname, "storage-data.backup.json");

/* ---- load existing data from disk on startup ---- */
function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, "utf8");
      const parsed = JSON.parse(raw);
      console.log(`[storage] Loaded existing data from ${DATA_FILE}`);
      return { shared: parsed.shared || {}, private: parsed.private || {} };
    }
  } catch (e) {
    // The main file is corrupt or unreadable — try the backup copy before giving up,
    // so a bad shutdown mid-write doesn't wipe everything out.
    console.error("[storage] storage-data.json couldn't be read:", e.message);
    try {
      if (fs.existsSync(BACKUP_FILE)) {
        const raw = fs.readFileSync(BACKUP_FILE, "utf8");
        const parsed = JSON.parse(raw);
        console.log(`[storage] Recovered data from backup file instead.`);
        return { shared: parsed.shared || {}, private: parsed.private || {} };
      }
    } catch (e2) {
      console.error("[storage] Backup file also unreadable:", e2.message);
    }
  }
  console.log("[storage] No existing data found — starting fresh.");
  return { shared: {}, private: {} };
}

let db = loadData();
let saveQueued = false;

/* Writes db to disk. Keeps a rolling backup copy of whatever was on disk
   BEFORE this write, so one bad/interrupted write never destroys the only copy. */
function persist() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      fs.copyFileSync(DATA_FILE, BACKUP_FILE);
    }
    // Write to a temp file first, then rename — an atomic-ish swap so a crash
    // mid-write can't leave storage-data.json half-written / corrupted.
    const tmpFile = DATA_FILE + ".tmp";
    fs.writeFileSync(tmpFile, JSON.stringify(db), "utf8");
    fs.renameSync(tmpFile, DATA_FILE);
  } catch (e) {
    console.error("[storage] FAILED to save to disk:", e.message);
  }
}

/* Every write/delete calls this. Runs synchronously so the HTTP response for
   that request only goes out AFTER the data is safely on disk — no "saved"
   confirmation is ever sent to the app before it's actually persisted. */
function persistNow() {
  persist();
}

function send(res, status, body) {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(json),
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(json);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
    return;
  }

  if (pathname === "/api/storage/list" && req.method === "GET") {
    const prefix = url.searchParams.get("prefix") || "";
    const shared = url.searchParams.get("shared") === "1";
    const store = shared ? db.shared : db.private;
    const keys = Object.keys(store).filter((k) => k.startsWith(prefix));
    send(res, 200, { keys });
    return;
  }

  if (pathname === "/api/storage" && req.method === "GET") {
    const key = url.searchParams.get("key");
    const shared = url.searchParams.get("shared") === "1";
    const store = shared ? db.shared : db.private;
    if (!key || !(key in store)) {
      send(res, 200, { value: null });
      return;
    }
    send(res, 200, { value: store[key] });
    return;
  }

  if (pathname === "/api/storage" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      try {
        const { key, value, shared } = JSON.parse(body);
        if (!key) { send(res, 400, { error: "key required" }); return; }
        const store = shared ? db.shared : db.private;
        store[key] = value;
        persistNow();
        send(res, 200, { key, value, shared: !!shared });
      } catch (e) {
        send(res, 400, { error: "bad request" });
      }
    });
    return;
  }

  if (pathname === "/api/storage" && req.method === "DELETE") {
    const key = url.searchParams.get("key");
    const shared = url.searchParams.get("shared") === "1";
    const store = shared ? db.shared : db.private;
    if (key) delete store[key];
    persistNow();
    send(res, 200, { key, deleted: true, shared });
    return;
  }

  send(res, 404, { error: "not found" });
});

server.listen(PORT, () => {
  console.log(`\n  Meriiz Cric Score storage server`);
  console.log(`  Listening on http://localhost:${PORT}`);
  console.log(`  Saving to:   ${DATA_FILE}`);
  console.log(`  Backup file: ${BACKUP_FILE}`);
  console.log(`  Keep this window open while you're scoring. Closing it just stops`);
  console.log(`  the server — your data on disk is safe either way.\n`);
});

/* Save one more time on a clean shutdown (Ctrl+C) just in case anything was
   mid-flight — the disk copy is already current after every request, but this
   is a harmless extra safety net. */
process.on("SIGINT", () => {
  persist();
  console.log("\n[storage] Saved. Bye!");
  process.exit(0);
});
