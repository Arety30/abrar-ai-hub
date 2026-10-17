# Framer design prompt — Abrar AI Hub

Design a modern, multi-page web app called **Abrar AI Hub** — a private, 100%
**offline, local-first AI workspace**. Every AI model runs on the user's own
machine; nothing ever leaves the device. Core promise, shown everywhere:
**"Private · offline · yours."**

## The platform's AI (what it actually does)
The app is powered by a **local autonomous AI agent** that can *take real
actions* on the user's computer — not just chat. It can run code and shell
commands, read/write/edit files, generate PDFs / slide decks / spreadsheets /
charts, analyze data and images, manage a calendar, tasks, contacts and email
drafts, tutor and quiz the user, translate, use git, and coordinate a **"Crew"**
of specialist sub-agents that split a goal into tasks and work together.

It has **11 selectable "modes" (personas)**, each a specialist the user switches
between in one click:
🤖 Assistant · 🎓 Study Partner · 💻 Coder · 💡 Brainstorm · 🗂 Personal Assistant ·
🔬 Researcher · 📦 Product Builder · 📊 Business Manager · 💰 Financial Advisor ·
🏪 Small Business · 📈 Investor.

Under the hood it exposes **50+ tools** grouped as plugins the user can toggle:
files, shell, python, pdf, slides, sheets, charts, vision, git, finance,
investing, business, data (pandas), calendar, tasks, contacts, email, database,
translate, knowledge-graph, voice.

## Backend & data each screen binds to (for realistic layouts)
The design should reflect a real REST backend. Entities: users (with admin),
conversations & messages, markdown notes with `[[wikilinks]]`, study documents,
flashcards, quiz attempts, spaced-repetition review cards, calendar events,
tasks (priority + due date), contacts, plugins (enable/disable), long-term
"memories", and live system stats. Auth is username/password (first account =
admin), with a session cookie. Chat streams the AI's reply and shows small
"tool activity" chips (e.g. `→ write_file`, `✓ done`) as the agent works.

## Screens to design
1. **Login / Sign-up** — one calm centered card on a sea-green background with a
   soft blurred bokeh + gentle wave; one primary "Sign in" button (green) plus
   small "Forgot password?" and "Create account" links. First-run shows
   "Create your admin account."
2. **Home** — a welcoming landing that makes people want to explore *everything*.
   Hero headline ("Your entire AI workspace — private, offline, and yours"),
   primary CTA, a privacy/trust badge, a row of **animated personal stat tiles**
   (Notes, Tasks, Events, Memories, Sources), and **feature cards grouped into
   Think / Learn / Organize**, each with an icon, a one-line benefit, and "Open →".
3. **Chat** — main conversation surface: a persona/mode dropdown at the top,
   message bubbles (user right / AI left), inline monospace tool-activity chips,
   a "🧭 Plan mode" toggle, a "🔊 Speak" toggle, and a clean composer.
4. **Connectors** — a gallery of 9 specialist cards (Personal Assistant,
   Researcher, Developer, Student, Product Builder, Business Manager, Financial
   Advisor, Small Business, Investor); each card shows its tools + example
   prompts and an "Open in Chat →" button.
5. **Study** — left list of sources; right panel to read, ask grounded questions,
   and generate summaries / action items.
6. **Quiz** — pick a source + count + type (multiple-choice or typed/open-ended);
   take it one question at a time with instant feedback and a final score screen.
7. **Review** — one spaced-repetition flashcard at a time: show front → reveal
   answer → rate recall with four buttons **Again / Hard / Good / Easy**.
8. **Notes** — a markdown vault: note list + a title field + a large editor +
   Save/Delete; notes link with `[[wikilinks]]`.
9. **Knowledge Graph** — an animated force-directed graph of notes & meetings
   (green = notes, blue = meetings) with connecting lines.
10. **Tasks** — a to-do board: quick-add row (title, due date, priority),
    checkable rows with priority dots, show/hide completed.
11. **Calendar** — an agenda list of events (upcoming highlighted) + quick-add +
    an "Export .ics" action.
12. **Meeting** — a webcam video stage, a live transcript panel with an AI
    participant you can talk to, and "AI minutes / save to vault / export".
13. **Settings** — dropdowns to pick the local model per role (chat, tools,
    coding, reasoning, vision) and a segmented control for agent access
    (approval / yolo / sandbox).
14. **Backend Console (admin)** — health status, live stat cards, a models
    panel, plugin toggles, and a tools table with danger badges.

## Layout
Left **sidebar** with the brand ("◆ Abrar AI") and a "LOCAL · OFFLINE" tag, nav
items **grouped** (Main / Learn / Organize / System), and a footer showing the
signed-in user, online status, a "console →" link and "log out". Main content is
a centered column (max ~1080px) with generous padding. Some screens use a
two-pane split (list + detail).

## Design system — STRICT palette
Use ONLY these colors — **no red, no yellow, no purple, no orange**:
- **Green** `#12b886` — primary actions, success, accents (hover `#0ca678`).
- **Dark blue** `#1c5fb0` — secondary accents, links, meeting nodes.
- **Sea-green / light-blue** — backgrounds (`#e6f2fb` light-blue, or a soft
  sea-green `#eaf7f2`); gradients between them are welcome.
- **White** `#ffffff` — cards and surfaces.
- **Black / near-black dark-blue** `#0b2545` — primary text.
- Muted text `#5c7fa3`; hairline borders `#cfe3f2`.

Style: **light, calm, trustworthy, modern**. Rounded cards (16–24px radius), soft
diffused shadows, lots of whitespace, a clean geometric sans (Inter / Outfit
feel). Micro-interactions: cards lift on hover, stat numbers count up, smooth
page transitions, subtle focus glows on inputs.

## Tone & psychology
Copy is **benefit-first, warm, and concise**. Reduce overwhelm by grouping
features; spark curiosity with intriguing one-liners; create ownership with the
user's own live stats; and reinforce trust with "private / offline / on your
machine" cues throughout. It should feel like a premium, focused productivity
tool — the opposite of cluttered or childish.
