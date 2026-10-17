# Packaging Abrar AI Hub as desktop apps

There are **two ways** to run the Hub as an "app" on any device. Everything stays
local/offline; the app just talks to the local Python backend + Ollama.

## 1. PWA — installs on *every* platform, no build (easiest, incl. Chromebook)

The web app is a full **Progressive Web App**. From Chrome/Edge on
ChromeOS, Windows, macOS, Linux, or Android:

1. Open the Hub (e.g. `http://HOST.duckdns.org` or `http://127.0.0.1:8100`).
2. Click the **Install** icon in the address bar (or ⋮ → *Install Abrar AI Hub*).

It gets its own window, icon, and launcher entry — a real app — with **zero packaging**.
This is the recommended path for **Chromebooks**.

## 2. Native installers via Electron (AppImage / .deb / .exe / .dmg)

`desktop-electron/` wraps the app in a native window and launches the backend for you.

**Build matrix (each OS must be built on its own machine/runner):**

| Target | Arch | Where it can be built |
|---|---|---|
| Linux **AppImage** | x64, arm64 | Linux (this machine) ✅ |
| Linux **.deb** | x64, arm64 | Linux (this machine) ✅ |
| Windows **.exe / portable** | x64, ia32 (32-bit) | Windows, or the CI below |
| macOS **.dmg** | arm64 (Apple Silicon), x64 | **A Mac is required** (Apple licensing) |

### One command (on the target OS)
```bash
cd backend && pip install -r requirements.txt pyinstaller \
  && pyinstaller --onedir --name aihub-web --add-data "app/web/static:app/web/static" -p . run_web.py
cd ../desktop-electron && npm install && npm run dist      # or dist:linux / dist:win / dist:mac
```
Installers land in `desktop-electron/dist/`.

### All platforms at once → GitHub Actions
Push a tag (or run the workflow manually) and `.github/workflows/build-desktop.yml`
builds Linux + Windows + macOS (arm64 **and** x64) on their native runners and uploads
the installers as artifacts. This is the only reliable way to get **macOS Apple-Silicon**
builds without owning a Mac.

## Honest notes on the requested targets

- **Chromebook** → use the **PWA** (option 1), or the Linux `.deb`/AppImage via Crostini.
- **Windows** → x64 + **ia32 (32-bit)** installers are configured (`nsis` supports ia32).
- **macOS Apple Silicon (arm64)** → configured, but **cannot be built on Linux** — use a Mac
  or the macOS CI runner.
- **32-bit (ia32/x32)** → supported on **Windows** only. Modern **Electron no longer ships
  32-bit Linux or macOS binaries**, so those 32-bit targets aren't producible. (32-bit is
  effectively dead on Mac/Linux; the PWA still works there.)
