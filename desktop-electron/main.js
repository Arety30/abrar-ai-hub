// Electron shell for Abrar AI Hub.
// Spawns the local Python backend (FastAPI on 127.0.0.1:8100), then loads the web UI.
// The whole thing stays local/offline — Electron is just a native window.
const { app, BrowserWindow, shell } = require("electron");
const { spawn } = require("child_process");
const http = require("http");
const path = require("path");
const fs = require("fs");

const PORT = 8100;
const URL = `http://127.0.0.1:${PORT}/`;
let backend = null;
let win = null;

function backendCommand() {
  // Production: a PyInstaller-built binary bundled in resources/backend/.
  const packaged = path.join(process.resourcesPath, "backend",
    process.platform === "win32" ? "aihub-web.exe" : "aihub-web");
  if (fs.existsSync(packaged)) return { cmd: packaged, args: [], cwd: path.dirname(packaged) };

  // Dev: use the project venv.
  const backendDir = path.join(__dirname, "..", "backend");
  const py = process.platform === "win32"
    ? path.join(backendDir, "venv", "Scripts", "python.exe")
    : path.join(backendDir, "venv", "bin", "python");
  return { cmd: py, args: ["-m", "app.web"], cwd: backendDir };
}

function ping() {
  return new Promise((res) => {
    http.get(`http://127.0.0.1:${PORT}/health`, (r) => res(r.statusCode === 200))
      .on("error", () => res(false));
  });
}

async function waitForBackend(tries = 60) {
  for (let i = 0; i < tries; i++) {
    if (await ping()) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

async function startBackend() {
  if (await ping()) return; // already running (e.g. systemd)
  const { cmd, args, cwd } = backendCommand();
  backend = spawn(cmd, args, { cwd, env: process.env });
  backend.stdout.on("data", (d) => console.log("[backend]", d.toString()));
  backend.stderr.on("data", (d) => console.log("[backend]", d.toString()));
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280, height: 860, minWidth: 960, minHeight: 640,
    backgroundColor: "#e6f2fb",
    title: "Abrar AI Hub",
    webPreferences: { contextIsolation: true },
  });
  win.loadURL(URL);
  // open external links in the real browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(URL)) { shell.openExternal(url); return { action: "deny" }; }
    return { action: "allow" };
  });
}

app.whenReady().then(async () => {
  await startBackend();
  const ok = await waitForBackend();
  createWindow();
  if (!ok) win.loadURL("data:text/html,<h2 style='font-family:sans-serif;color:%230b2545'>Starting backend… if this persists, ensure Ollama is running.</h2>");
});

app.on("window-all-closed", () => {
  if (backend) try { backend.kill(); } catch (e) {}
  if (process.platform !== "darwin") app.quit();
});
app.on("before-quit", () => { if (backend) try { backend.kill(); } catch (e) {} });
