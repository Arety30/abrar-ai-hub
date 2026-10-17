# Abrar AI Hub

Abrar AI Hub is a local, offline personal workspace built around small language models served by Ollama. One Python core drives three front-ends: a CustomTkinter desktop app, a terminal REPL, and a FastAPI web app that can be installed as a PWA or wrapped in an Electron shell. It bundles an autonomous tool-using agent, a team-of-agents "Crew", specialist "Connectors", study tools (grounded Q&A, quizzes, SM-2 flashcard review), a markdown notes vault with a knowledge graph, a calendar and task board, a git helper, a meeting room with offline speech, and a plugin switchboard. The problem it solves: getting the convenience of a cloud assistant (documents, spreadsheets, decks, charts, calendar, tasks, contacts, mail drafts, data analysis) without any data leaving the machine. The only network calls in normal operation go to an Ollama server on localhost.

## Where it is used

Abrar runs the Hub as his everyday assistant and study companion on a laptop with no discrete GPU, which is why the defaults are 1-2 B parameter models. The desktop app is the primary surface; the CLI is used over SSH and inside terminal multiplexers, and the web variant is served behind a reverse proxy so the same backend can be opened from a phone or a Chromebook as an installed PWA. The `workspace/` folder doubles as the agent's sandbox and the drop zone for generated PDFs, decks and sheets.

## How it works

Everything is a thin layer over `backend/app`, which is UI-agnostic. The data store is one SQLite file managed with SQLModel; settings live in a key/value table and are seeded on first run.

Agent loop (`agent/core.py`):
1. A persona (`agent/personas.py`) sets the system prompt, temperature, whether tools are allowed and whether the prompt is grounded in study material (documents + notes, capped at 6000 chars). The last 12 long-term memories are injected too.
2. The request is routed to a model role. `providers/ollama.py` first asks a tiny router model to classify the turn as CODING / REASONING / GENERAL (`smart_route`), falling back to regex heuristics if that fails. Tool turns are forced onto a model known to support Ollama function-calling (`tool_role`), because gemma/deepseek-r1/vision models cannot.
3. Up to `MAX_AGENT_STEPS` (default 12) rounds: the model is called with the JSON schemas of all enabled tools; each returned `tool_call` is looked up in the registry, gated, executed, and its result appended as a `tool` message. `<think>...</think>` spans are stripped from the final answer.
4. Gating follows the access mode stored in settings: `approval` (dangerous tools call an approver callback that pops a dialog or asks y/N), `yolo` (run everything), `sandbox` (every path is forced inside `workspace/`; see `agent/safety.py`).
5. Events (`token`, `step`, `tool_call`, `tool_result`, `denied`, `done`, `error`) are emitted to whichever UI is listening.

Higher-level modes reuse `core.run`:
- Plan mode (`agent/planner.py`): the reasoner model turns a goal into 2-6 JSON steps, each executed as its own agent turn with the previous steps as history.
- Crew (`agent/crew.py`): a manager prompt assigns 2-5 tasks to personas via constrained JSON output, agents run in sequence over a shared feed, a reviewer critiques, and a synthesis pass produces the deliverable.
- Council (`providers/ollama.deliberate`, exposed as the `council` tool): several model roles answer independently and one synthesises.

Tools are registered with a decorator in `agent/registry.py` (`name`, JSON-schema params, `danger` flag, owning `plugin` slug). Disabling a plugin in the Plugins view removes its tools from the schemas the model sees. Built-in tool families:

| File | Plugin slugs | Tools |
|---|---|---|
| `tools/sys_tools.py` | shell, files, core | `run_shell`, `read_file`, `write_file`, `list_dir`, `get_datetime`, `web_search` (returns a disabled notice when `AIHUB_OFFLINE=1`) |
| `tools/code_tools.py` | python, files, charts | `python_exec`, `edit_file` (string-replace editor), `make_chart` |
| `tools/doc_tools.py` | pdf, slides, sheets, vision | `create_pdf`, `read_pdf`, `create_slides`, `generate_presentation`, `create_spreadsheet`, `analyze_image` |
| `tools/kb_tools.py` | core, files | `remember`, `recall`, `create_note`, `read_note`, `list_notes`, `import_folder` |
| `tools/office_tools.py` | calendar, tasks, contacts, email, database, translate | events + ICS export, tasks, vCard contacts, `.eml` drafts and mailbox reading, SQLite queries, local-model translation |
| `tools/finance_tools.py` | finance, invest, business, product | compound interest, loan payment, retirement projection, ROI/CAGR, DCF, portfolio allocation, break-even, pricing margin, invoices, RICE score (pure arithmetic) |
| `tools/data_tools.py` | data | `analyze_data`, `data_aggregate`, `data_to_chart` over CSV/Excel with pandas |
| `tools/git_tools.py` | git | status, diff, log, commit, branch (backed by `gitconn.py`) |
| `tools/maps_tools.py` | maps | `map_search`, `map_near`, `map_refresh`, `geocode` |
| `tools/meta_tools.py` | council | `council` |

Other components:

| Path | Role |
|---|---|
| `config.py` | Paths, default model per role, access mode, step limit; all overridable by environment variables |
| `models.py`, `db.py` | SQLModel tables (users, sessions, conversations, memory, notes, documents, flashcards, quiz attempts, review items, meetings, transcripts, events, tasks, contacts, places, plugins, settings) and the plugin seed list |
| `agent/quiz.py` | MCQ and open-ended quiz generation from study material with tolerant JSON extraction; open answers graded by the model |
| `agent/review.py` | SM-2 spaced repetition over review cards (qualities 1/3/4/5 map to Again/Hard/Good/Easy) |
| `connectors.py` | The specialist roles (Personal Assistant, Researcher, Developer, Student, Product Builder, Business Manager, Financial Advisor, Small Business, Investor), each a persona plus the plugin slugs it relies on |
| `maps/` | Online fetchers (Google Maps Platform API, or a Playwright scraper) that upsert into a local JSON place store, exported to TSV for `geo_query.cpp`, a C++ haversine nearest/radius scanner |
| `voice/stt.py`, `voice/tts.py` | Lazy-loaded faster-whisper and pyttsx3 |
| `desktop/` | CustomTkinter shell, theme, 14 views (agent, crew, connectors, study, quiz, review, calendar, tasks, notes, graph, meeting, git, plugins, settings) and approval/recorder widgets |
| `cli.py` | Terminal REPL with the same agent, approvals via y/N prompts |
| `web/server.py`, `web/auth.py` | FastAPI app on `127.0.0.1:8100` with PBKDF2 password hashing, cookie sessions in SQLite, a JSON API for every section, a `/v1/chat/completions` compatibility shim, and a PWA front-end in `web/static/` |
| `desktop-electron/` | Electron window that spawns the web backend (PyInstaller binary in production, the venv in development) and loads it |

## Setup

Requirements: Python 3.12+ with Tk, [Ollama](https://ollama.com) running locally with at least one tool-capable model pulled, and optionally Node 20 for the Electron build.

```bash
git clone <repo-url> ~/ai-hub
cd ~/ai-hub/backend
python3 -m venv venv
./venv/bin/pip install -r requirements.txt
ollama pull llama3.2:1b gemma3:1b qwen2.5-coder:1.5b deepseek-r1:1.5b granite3.2-vision:2b
```

Optional extras: `pandas`/`openpyxl` for the data tools, `opencv-python` for the meeting webcam, `playwright` plus `playwright install chromium` for the maps scraper, and `g++ -O2 -o geo_query geo_query.cpp` inside `backend/app/maps/`.

Configuration is by environment variable; every value has a local default:

| Variable | Default | Meaning |
|---|---|---|
| `OLLAMA_HOST` | `http://127.0.0.1:11434` | Ollama endpoint |
| `AIHUB_MODEL_GENERAL` / `_TOOLS` / `_CODER` / `_REASONER` / `_VISION` / `_ROUTER` | small local models | Model per role; also editable in Settings |
| `AIHUB_AGENT_ACCESS` | `approval` | `approval`, `yolo` or `sandbox` |
| `AIHUB_MAX_STEPS` | `12` | Agent loop limit |
| `AIHUB_OFFLINE` | `1` | Blocks online-only tools |
| `AIHUB_ROOT`, `AIHUB_DATA`, `AIHUB_WORKSPACE`, `AIHUB_PLUGINS`, `AIHUB_DB` | under the repo | Storage locations |
| `GOOGLE_MAPS_KEY` | unset | Only needed for the online maps fetcher; can also be stored in Settings |

## Usage

```bash
./run-desktop.sh                       # CustomTkinter app (warns if Ollama is not running)
./run-cli.sh                           # terminal REPL
cd backend && ./venv/bin/python -m app.web   # web app on http://127.0.0.1:8100
```

CLI commands: `/help`, `/mode approval|yolo|sandbox`, `/agent assistant|study_partner|coder|brainstorm`, `/agents`, `/plan <goal>`, `/crew <goal>`, `/council <question>`, `/models`, `/tools`, `/notes`, `/mem`, `/clear`, `/quit`. Anything else is sent to the agent; dangerous tools print `approve tool run_shell(...)  run it? [y/N]`.

Example interactions:

```text
you > make a 3-slide deck about photosynthesis and save it as photo.pptx
→ create_slides {"title": "Photosynthesis", ...}
✓ create_slides  Saved ~/ai-hub/workspace/photo.pptx

you > /plan set up a python project called tracker with a README and a test
Plan:
  1. Create the tracker directory ...
```

Web API examples (after registering at `/login`):

```bash
curl -b cookies.txt -X POST http://127.0.0.1:8100/api/chat \
  -H 'content-type: application/json' -d '{"message":"list my tasks","persona":"pa"}'
curl -b cookies.txt http://127.0.0.1:8100/api/review/due
```

Desktop packaging (see `PACKAGING.md`): build the backend with PyInstaller (`pyinstaller --onedir --name aihub-web ... run_web.py`), then `cd desktop-electron && npm install && npm run dist`. The GitHub Actions workflow in `.github/workflows/build-desktop.yml` builds Linux, Windows and macOS installers on native runners when a `v*` tag is pushed.

## Project structure

```
ai-hub/
  run-desktop.sh  run-cli.sh  PACKAGING.md
  backend/
    requirements.txt  run_web.py
    app/
      config.py  db.py  models.py  connectors.py  gitconn.py  cli.py
      providers/ollama.py          # model registry, router, chat/stream/tools/vision/council
      agent/
        core.py registry.py safety.py personas.py planner.py crew.py quiz.py review.py
        tools/ sys code doc kb office finance data git maps meta
      maps/  store.py google.py scraper.py geo_query.cpp
      voice/ stt.py tts.py
      desktop/ app.py theme.py views/ widgets/
      web/   server.py auth.py static/ (index, login, suite, manifest, service worker)
  desktop-electron/  main.js package.json assets/
  frontend/          # earlier React/Vite scaffold, not used by the shipped app
  workspace/         # agent sandbox + generated documents (created at runtime)
  data/              # aihub.db + maps cache (created at runtime)
  plugins/           # reserved for external plugins (empty)
```

## Limitations and notes

- Quality depends on the local models. The defaults are tiny (1-2 B) so they run on CPU; tool-calling only works with models that support Ollama function-calling, and the code quietly falls back to a plain streamed answer if a model rejects tools.
- `web_search` is a stub: offline mode returns a notice and online mode only reports the byte count fetched.
- The maps module is the one component that reaches the internet on demand (Google Maps Platform or a Playwright scraper of the Maps site, which is fragile and against that site's terms); the agent itself only reads the local cache.
- faster-whisper downloads its model on first use; warm it up once while online.
- The web app binds to localhost only; put it behind a reverse proxy for remote access. The first account registered becomes admin; further registration is closed unless the `allow_registration` setting is set to `1`.
- `frontend/` is a leftover scaffold and `plugins/` is empty; the plugin system currently toggles built-in tool groups stored in the database.
- Thread safety relies on SQLite `check_same_thread=False`; heavy concurrent use is not the target.
