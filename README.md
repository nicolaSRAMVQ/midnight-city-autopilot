# Midnight City Agent Autopilot

Serverless automation for AI agents in [Midnight City](https://midnight.city): a Telegram
status report and a keep-alive autopilot, both running as Vercel functions,
triggered on a schedule by GitHub Actions (free — see below). No server to
maintain, and no LLM in the loop: this is plain code calling the game's
observer API directly.

Built for a 3-agent crew (a hacker, a miner and a lumberjack) but generalizes
to any number of agents — see `lib/agents.js`.

## What it does

- **`api/r2-report.js`** — sends a Telegram message with each agent's level,
  XP, hunger, inventory, nearby merchants and recent activity. Never connects
  to (or interrupts) an agent someone is actively controlling by hand.
- **`api/r2-autopilot.js`** — silent keep-alive. Per agent, once per run:
  restarts work if idle, eats (buying food first if needed) once hunger
  crosses a threshold, and sells the surplus of whatever the agent produces
  if it's overloaded and slowing down. One action per run by design — actions
  that cross districts can take longer than a single serverless invocation,
  and they keep running server-side after the function returns, so there's
  no need to wait for them.
- **`lib/mcity-maintenance.js`** — the shared connect/read/act logic both
  endpoints use.
- **`.github/workflows/cron.yml`** — fires both endpoints on a schedule,
  for free (see below).

## Why GitHub Actions instead of a paid cron service

GitHub Actions minutes are unlimited on public repositories. Our schedule
(autopilot every 10 min + 4 daily reports, ~148 runs/day) would exceed the
2,000 free minutes/month a private repo gets, so keeping this repo **public**
is what makes it free. No secrets live here — the workflow only calls two
public URLs.

## Using this for your own agent(s)

1. Deploy this repo to Vercel. Set these environment variables in the Vercel
   project (never in this repo):
   - `MCITY_OBSERVER_URL`, `MCITY_API_TOKEN` — from your Midnight City
     account (Settings → API Key).
   - `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` — from your own Telegram bot
     (via [@BotFather](https://t.me/BotFather)) and chat id.
2. Edit `lib/agents.js` with your agent id(s) and profession(s).
3. Fork this repo (keep it public) and set two repository variables
   (*Settings → Secrets and variables → Actions → Variables*):
   - `AUTOPILOT_URL` = `https://<your-deployment>.vercel.app/api/r2-autopilot`
   - `REPORT_URL` = `https://<your-deployment>.vercel.app/api/r2-report`
4. Adjust the cron times in `.github/workflows/cron.yml` to your own
   timezone (they're written in UTC).

## Known limitations

- GitHub's scheduled workflows are best-effort — expect a few minutes of
  jitter during high load, and GitHub auto-disables a schedule after 60 days
  with no commits to the repo (push anything to re-enable it).
- The profession-specific economics (what each agent sells, and where) are
  hardcoded per profession in `lib/agents.js` — only `hacker`, `miner` and
  `lumberjack` are wired up today.
