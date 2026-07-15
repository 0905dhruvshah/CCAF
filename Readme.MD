# CCA-F Mock Exam

A self-contained, static mock-exam site for CCA-F (Claude Certified Architect – Foundations) prep.

- 60 original scenario-based questions, domain-weighted to match the real exam
  (Agentic Architecture 27%, Claude Code 20%, Prompt Engineering 20%, Tool Design & MCP 18%, Context Management 15%)
- Full mock mode: 120-minute timer, question flagging, jump-to-question map, scaled 100–1000 score with a 720 pass line, per-domain breakdown, full answer review
- Practice mode: drill one domain at a time, untimed, with instant feedback and explanations
- Pure HTML/CSS/JS — no backend, no build step, no dependencies to install. All progress is saved in the browser's `localStorage` only; nothing is sent to any server.

This is an independent study aid, not affiliated with or endorsed by Anthropic, and not the official exam.

## Files

```
index.html      the app shell
style.css       styling
script.js       exam logic (timer, scoring, navigation, persistence)
questions.js    the 60-question bank (edit this to add/change questions)
vercel.json     static hosting config (clean URLs)
```

## Deploy to Vercel — Option A: drag-and-drop (no Git needed)

1. Go to https://vercel.com/new and log in.
2. Select "Deploy" via the drag-and-drop area (not "Import Git Repository").
3. Drag this whole folder (`mock-exam-site/`) onto the page, or zip it and upload the zip.
4. Vercel auto-detects it as a static site — no framework preset, no build command needed. Click Deploy.
5. You'll get a live URL in under a minute.

## Deploy to Vercel — Option B: GitHub

```bash
cd mock-exam-site
git init
git add .
git commit -m "CCA-F mock exam"
git branch -M main
git remote add origin <your-empty-github-repo-url>
git push -u origin main
```

Then in Vercel: **New Project → Import** your GitHub repo → Framework preset "Other" → leave build command blank → Deploy.

## Running it locally first (optional)

No install needed — just open `index.html` directly in a browser, or serve it locally:

```bash
cd mock-exam-site
python3 -m http.server 8080
# then visit http://localhost:8080
```

## Editing or adding questions

Open `questions.js`. Each entry looks like:

```js
{
  domain: "agentic",   // one of: agentic, claudecode, prompt, tools, context
  question: "...",
  options: ["...", "...", "...", "..."],  // exactly 4
  correct: 1,           // index (0-3) of the correct option
  explanation: "..."
}
```

Add as many as you like per domain — the practice mode and history panel will pick them up automatically. The full mock exam always uses the entire bank (currently 60 questions, shuffled per attempt).

## Note on scope

This build is a static front-end site by design — it's the simplest, fastest thing to host on Vercel with zero configuration, and a scored mock exam doesn't need a server or database. If you'd ever want a .NET backend (e.g., to store results across devices, add user accounts, or generate certificates), the natural next step would be a small ASP.NET Core Web API for persistence, with this front end calling it instead of `localStorage` — happy to build that layer too if you want it.
