# Himal Tech Chatbot — build & handover guide

Three pieces:
1. **backend/** — the "brain" (Python/FastAPI). Runs on your Hugging Face Space. Holds the Groq key + the company knowledge, and also serves the chat widget.
2. **wordpress-plugin/** — the connector the boss uploads. ~15 lines.
3. **google-sheet-leads.gs** — the tiny script that catches leads into a Google Sheet.

You set up parts 1–3 once. The boss only ever touches the plugin zip.

---

## Part A — Leads Google Sheet (do this first; you'll need its URL in Part B)

1. Create a new Google Sheet. In row 1 add headers: `Time | Name | Email | Need | Page`.
2. Extensions → Apps Script. Delete the sample code, paste everything from `google-sheet-leads.gs`, save.
3. Deploy → New deployment → gear icon → **Web app**.
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Deploy, authorise when prompted.
4. Copy the **Web app URL** (ends in `/exec`). Keep it for Part B.

---

## Part B — Backend brain on Hugging Face

1. Get a free Groq API key at https://console.groq.com (Create API Key).
2. On https://huggingface.co → New → **Space**. Name e.g. `himaltech-bot`.
   SDK: **Docker** (blank). Make it **Public** (needed so the website can load `/widget.js`).
3. Upload the **contents of the `backend/` folder** into the Space:
   `app.py`, `widget.js`, `requirements.txt`, `Dockerfile`, `README.md`.
4. Space → Settings → **Variables and secrets** → add:
   - Secret `GROQ_API_KEY` = your Groq key
   - Secret `LEADS_WEBHOOK_URL` = the Google web-app URL from Part A
   - (optional) Variable `GROQ_MODEL` = `openai/gpt-oss-120b`
5. The Space builds (a few minutes). When it's running, your URL looks like
   `https://YOURNAME-himaltech-bot.hf.space`.
   - Test the brain: open `https://YOURNAME-himaltech-bot.hf.space/` → should show `"status":"ok"`.
   - Test the widget loads: open `.../widget.js` → should show JavaScript.

> Note on the model: Groq deprecated `llama-3.3-70b-versatile` in June 2026.
> This uses `openai/gpt-oss-120b`. If you ever need to change it, set the
> `GROQ_MODEL` variable — no code change needed.

---

## Part C — Point the plugin at your Space, then zip it

1. Open `wordpress-plugin/himaltech-chatbot/himaltech-chatbot.php`.
2. Change the one line:
   `define('HIMALTECH_BOT_WIDGET_URL', 'https://YOURNAME-himaltech-bot.hf.space/widget.js');`
3. Zip the **`himaltech-chatbot` folder** (not its parent) so the zip contains
   `himaltech-chatbot/himaltech-chatbot.php`. That zip is what you give the boss.

---

## Part D — What the boss does (his entire job)

1. WordPress admin → Plugins → Add New → **Upload Plugin**.
2. Choose your `himaltech-chatbot.zip` → Install Now → **Activate**.
3. The chat bubble now appears on every page. Done — no settings.

**Backup if his host blocks plugin uploads:** install the free **WPCode** plugin,
then paste the line from `snippet.txt` (with your real Space URL) into the Footer box.

---

## Part E — Keep the Space awake (important for the demo)

A free HF Space sleeps after ~48h idle, so the first message can take 20–40s.
Stop that with a free pinger:

1. Go to https://cron-job.org (free), create an account.
2. New cron job → URL = `https://YOURNAME-himaltech-bot.hf.space/` → every 10 minutes.

That keeps it warm so it always answers instantly.

For a real production site, the cleaner fix is a paid always-on Space (a few $/month) —
present that to the boss as the "make it production-grade" option; it's a business cost, not yours.

---

## Before you hand it over
- Replace the prices in `backend/app.py` (SYSTEM_PROMPT) with the **official current price list** from your boss. The ones in there were read off the website and may be out of date.
- Send a quick test message through the live bubble and submit a test callback to confirm a row lands in the Google Sheet.
