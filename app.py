"""
Himal Tech AI Chatbot - backend "brain" with knowledge-base retrieval (RAG).

Each question is answered from the company's own knowledge base. Instead of
sending the whole knowledge base to the model every time (slow, costly, worse
answers), a lightweight BM25 search finds only the most relevant pieces and
sends just those. Precise, fast, and free - no external vector database.

Endpoints:
  GET  /            -> health check
  GET  /widget.js   -> serves the chat widget (one source of truth for the site)
  GET  /search?q=   -> debug: shows which knowledge chunks a query retrieves
  POST /chat        -> retrieves context, asks Groq, returns the reply
  POST /lead        -> saves a captured lead to the Google Sheet

Environment variables (set in the HF Space settings):
  GROQ_API_KEY       (required)  your Groq key. NEVER hard-code it here.
  LEADS_WEBHOOK_URL  (for leads) the Google Apps Script web-app URL.
  GROQ_MODEL         (optional)  defaults to a current production model.

Files expected next to this one:
  widget.js        the chat widget
  knowledge.md     all knowledge-base documents combined, separated by
                   lines of the form:  <<<FILE: Topic Name>>>
"""

import asyncio
import math
import os
import pathlib
import re
import time

import requests
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
# llama-3.3-70b-versatile was deprecated by Groq (June 2026);
# openai/gpt-oss-120b is the current recommended production model.
GROQ_MODEL = os.environ.get("GROQ_MODEL", "openai/gpt-oss-120b")
LEADS_WEBHOOK_URL = os.environ.get("LEADS_WEBHOOK_URL", "")
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"

ALLOWED_ORIGINS = [
    "https://himaltech.co.uk",
    "https://www.himaltech.co.uk",
]

BASE_DIR = pathlib.Path(__file__).parent
WIDGET_PATH = BASE_DIR / "widget.js"
KNOWLEDGE_PATH = BASE_DIR / "knowledge.md"

# ---------------------------------------------------------------------------
# Behaviour prompt (facts come from the retrieved CONTEXT, not from here)
# ---------------------------------------------------------------------------
SYSTEM_PROMPT = """You are the AI assistant and sales consultant for Himal Tech, a London-based IT, \
web development and SEO agency in Woolwich, in business since 2001.

Answer using ONLY the CONTEXT provided below for any facts about services, prices, packages, \
locations, training or company details. The context comes from Himal Tech's own knowledge base. If \
the answer is not in the context, do not guess or invent it: say you do not have that exact detail \
and offer a free consultation or the contact details. NEVER invent or estimate a price.

STYLE:
- Answer ONLY what was asked, precisely. Usually 1 to 3 short sentences. If the CONTEXT contains \
many prices but the visitor asked about ONE service, quote only that service's price, not the whole \
list. EXCEPTION: if the visitor explicitly asks you to list services or prices, give a short \
scannable list with each item on its own line as plain text.
- British English. No emojis, no headings. You MAY wrap a service name or an offer in **double \
asterisks** to emphasise it (the chat shows these as highlighted pills). Write prices as figures \
like £295; the chat highlights every price automatically, so do not bold prices.
- Warm, professional and helpful, like a knowledgeable salesperson. Never robotic.

SELLING (light touch, never pushy):
- Lead with the precise answer first. Only when it fits naturally - the visitor shows interest, asks \
how to proceed, or the chat is wrapping up - add ONE short next step (the free consultation, the \
Request a callback button, or booking an appointment). Do NOT push booking in every message; there \
are already Book appointment and Request a callback buttons on screen.
- For services with no fixed price, NEVER apologise or say you "do not have" the price. State \
confidently that it is priced per project as a custom quote, then move to get them an exact quote \
(ask a quick question about their needs, or invite the free consultation or callback). For example: \
"Logo design is priced per project as a custom quote - tell me what you have in mind and we'll get \
you an exact price." NEVER use the phrase "quoted to the brief".
- Do not loop asking for endless details. After one or two questions on a custom job, invite them to \
leave their details for a quote.

CONTACT: phone 020 3305 8141 or +44 7540 755750; email info@himaltech.co.uk.
"""

FALLBACK_REPLY = (
    "I'm getting a lot of questions right now - please give it a few seconds and ask again. "
    "You can also reach the team directly at info@himaltech.co.uk or 020 3305 8141."
)

NO_CONTEXT_NOTE = (
    "(No specific knowledge-base match for this question. Answer only from general company facts: "
    "Himal Tech is an IT, web development and SEO agency in Woolwich, London, in business since 2001. "
    "For anything specific, offer a free consultation or the contact details. Do not invent prices.)"
)

# ---------------------------------------------------------------------------
# Knowledge base: load, chunk, and index with BM25
# ---------------------------------------------------------------------------
STOPWORDS = set(
    "a an the of to in on for and or is are am be been being with your you our we us this that it as "
    "at by from they their them i me my do does can could would should will what which who how when "
    "where why about into over under then than there here have has had get got give please tell".split()
)

# light synonym expansion so 'cost/fee/how much' all find pricing, etc.
SYNONYMS = {
    "cost": ["price", "pricing"], "costs": ["price", "pricing"], "fee": ["price", "pricing"],
    "fees": ["price", "pricing"], "price": ["pricing"], "prices": ["pricing", "price"],
    "pricing": ["price"], "charge": ["price"], "charges": ["price"], "rate": ["price"],
    "rates": ["price"], "cheap": ["price", "affordable"], "affordable": ["price"],
    "quote": ["price", "pricing"], "package": ["packages", "pricing"],
    "seo": ["ranking", "optimisation", "optimization"], "rank": ["ranking", "seo"],
    "logo": ["graphic", "design", "branding"], "branding": ["graphic", "design"],
    "site": ["website", "web"], "web": ["website"], "website": ["web", "wordpress"],
    "ecommerce": ["ecommerce", "shop", "store", "woocommerce"], "shop": ["ecommerce", "store"],
    "store": ["ecommerce", "shop"], "learn": ["training", "course"], "train": ["training", "course"],
    "course": ["training"], "courses": ["training"], "marketing": ["digital", "ads", "ppc", "social"],
    "ads": ["ppc", "advertising", "marketing"], "writer": ["content", "writing", "copywriting"],
    "blog": ["content", "writing"], "content": ["writing", "copywriting"],
}


def tokenize(text: str):
    text = text.lower()
    raw = re.findall(r"[a-z]+|\d+", text)
    out = []
    for t in raw:
        if t in STOPWORDS or len(t) <= 1:
            continue
        out.append(t)
        # add singular form so 'flyers'->'flyer', 'prices'->'price', 'cards'->'card'
        if len(t) > 3 and t.endswith("s") and not t.endswith("ss"):
            out.append(t[:-1])
    return out


def expand(tokens):
    out = list(tokens)
    for t in tokens:
        if t in SYNONYMS:
            out.extend(SYNONYMS[t])
    return out


def load_chunks(path: pathlib.Path):
    """Split knowledge.md into per-document chunks, one per H2/H3 section,
    each tagged with a breadcrumb and boosted with the document's keywords."""
    if not path.exists():
        print("WARNING: knowledge.md not found at", path)
        return []
    raw = path.read_text(encoding="utf-8")
    parts = re.split(r"(?m)^<<<FILE:\s*(.+?)>>>\s*$", raw)
    chunks = []
    for i in range(1, len(parts), 2):
        topic = parts[i].strip()
        body = parts[i + 1]
        # collect the document's Tags / Search Keywords to boost all its chunks
        file_keywords = " ".join(
            re.findall(r"(?im)^- \*\*(?:Tags|Search Keywords):\*\*\s*(.+)$", body)
        )
        sections = re.split(r"(?m)^(#{2,3} .+)$", body)
        current_h2 = ""
        for j in range(1, len(sections), 2):
            head = sections[j].strip()
            text = sections[j + 1].strip()
            heading_text = head.lstrip("# ").strip()
            if heading_text.lower() == "metadata":
                continue
            if head.startswith("### "):
                bc = f"{topic} > {current_h2} > {heading_text}" if current_h2 else f"{topic} > {heading_text}"
            else:
                current_h2 = heading_text
                bc = f"{topic} > {heading_text}"
            if not text:
                continue
            display = f"[{bc}]\n{text}"
            index_text = f"{topic} {bc} {text} {file_keywords}"
            chunks.append({
                "topic": topic,
                "bc": bc,
                "display": display,
                "tokens": tokenize(index_text),
            })
    return chunks


class BM25:
    def __init__(self, docs_tokens, k1=1.5, b=0.75):
        self.k1, self.b = k1, b
        self.docs = docs_tokens
        self.N = len(docs_tokens)
        self.avgdl = (sum(len(d) for d in docs_tokens) / self.N) if self.N else 0.0
        self.tf = []
        df = {}
        for d in docs_tokens:
            counts = {}
            for t in d:
                counts[t] = counts.get(t, 0) + 1
            self.tf.append(counts)
            for t in counts:
                df[t] = df.get(t, 0) + 1
        self.idf = {
            t: math.log(1 + (self.N - n + 0.5) / (n + 0.5)) for t, n in df.items()
        }

    def score(self, query_tokens, i):
        counts = self.tf[i]
        dl = len(self.docs[i]) or 1
        s = 0.0
        for t in query_tokens:
            f = counts.get(t)
            if not f:
                continue
            idf = self.idf.get(t, 0.0)
            s += idf * (f * (self.k1 + 1)) / (f + self.k1 * (1 - self.b + self.b * dl / self.avgdl))
        return s


CHUNKS = load_chunks(KNOWLEDGE_PATH)
BM25_INDEX = BM25([c["tokens"] for c in CHUNKS]) if CHUNKS else None
print(f"Knowledge base: loaded {len(CHUNKS)} chunks.")

# Pinned overview documents for broad questions (always complete + consistent)
PRICING_DOC = "\n\n".join(c["display"] for c in CHUNKS if c["topic"] == "Pricing")
_services = [c["display"] for c in CHUNKS
             if c["topic"] == "Company" and "core services" in c["bc"].lower()]
SERVICES_DOC = _services[0] if _services else ""


PRICE_INTENT = {"price", "pricing", "cost", "fee", "much", "cheap", "affordable",
                "rate", "charge", "quote", "package", "packages"}

# UK cities/areas — a city question strongly prefers the matching location chunk
UK_CITIES = {
    "london", "woolwich", "greenwich", "bristol", "manchester", "birmingham",
    "leeds", "sheffield", "liverpool", "nottingham", "newcastle", "glasgow",
    "edinburgh", "cardiff", "belfast", "oxford", "cambridge", "bath", "brighton",
    "reading", "southampton", "portsmouth", "leicester", "coventry", "kent",
    "croydon", "bromley", "bexley", "lewisham", "essex", "surrey", "luton",
    "watford", "slough", "dartford", "bexleyheath", "eltham", "lewisham",
    "york", "hull", "derby", "stoke", "wolverhampton", "plymouth", "norwich",
    "swansea", "aberdeen", "dundee", "milton", "keynes", "peterborough",
}

# specific service words: if one of these is in a price question, it's a targeted
# question (use search). If a price question has none, it's broad (show full list).
SERVICE_TERMS = {
    "logo", "banner", "brochure", "flyer", "card", "cards", "graphic", "design",
    "seo", "ranking", "backlink", "backlinks", "keyword", "audit", "local",
    "website", "web", "wordpress", "ecommerce", "shop", "store", "woocommerce",
    "landing", "cms", "app", "mobile", "redesign", "maintenance", "security",
    "hacked", "malware", "hosting", "domain", "ssl",
    "training", "course", "courses", "apprentice", "canva",
    "content", "writing", "copywriting", "copy", "blog", "article", "articles",
    "marketing", "ads", "ppc", "social", "email", "google", "facebook",
    "video", "videography", "photography", "printing", "consultation",
}


def query_phrases(text: str):
    """Extract 2-3 word phrases from the raw question (stopwords removed,
    order preserved) so an exact phrase like 'keyword ranking' can be matched
    verbatim against chunk content - much more specific than scoring on
    individual overlapping words, which confuses e.g. 'Keyword Research' with
    'Keyword Ranking Service'."""
    words = [w for w in re.findall(r"[a-z]+", text.lower()) if w not in STOPWORDS]
    phrases = []
    for n in (3, 2):
        for i in range(len(words) - n + 1):
            phrases.append(" ".join(words[i:i + n]))
    return phrases


def _phrase_hit(phrases, content):
    """Word-boundary phrase match - plain substring matching would let
    'keyword ranking' false-match inside 'keyword rankings' (plural),
    the same class of bug as 'small' matching inside 'all'."""
    return any(re.search(r"\b" + re.escape(p) + r"\b", content) for p in phrases)


def retrieve(query: str, k: int = 8, max_chars: int = 10000):
    if not BM25_INDEX or not CHUNKS:
        return []
    q = expand(tokenize(query))
    if not q:
        return []
    qset = set(q)
    price_query = bool(qset & PRICE_INTENT)
    service_terms = qset & SERVICE_TERMS  # specific services named in the query
    cities = qset & UK_CITIES             # cities named in the query
    phrases = query_phrases(query)        # exact 2-3 word phrases for precise matching
    results = []
    for i in range(len(CHUNKS)):
        sc = BM25_INDEX.score(q, i)
        if sc <= 0:
            continue
        bc = CHUNKS[i]["bc"].lower()
        content = CHUNKS[i]["display"].lower()
        # strongest boost: an exact phrase from the question appears verbatim
        # in this chunk's actual content (not just its heading) - this is what
        # correctly distinguishes "Keyword Ranking Service" from "Keyword Research"
        if phrases and _phrase_hit(phrases, content):
            sc *= 4.0
        # strongly prefer the matching location chunk for a city question
        if cities and any(c in bc for c in cities):
            sc *= 3.0
        # reward sections that are actually about the named service
        if service_terms and any(t in bc for t in service_terms):
            sc *= 1.6
        # gentler boost for pricing sections on cost questions
        if price_query and "pric" in bc:
            sc *= 1.3
        # "User Intents" sections are just lists of example question phrasings
        # with no actual facts - they score artificially high on raw word
        # overlap (they're worded like real questions) but add no answer
        # content, so they shouldn't crowd out chunks that do
        if "user intents" in bc:
            sc *= 0.3
        results.append((sc, i))
    results.sort(key=lambda x: x[0], reverse=True)
    picked, total = [], 0
    for sc, i in results:
        c = CHUNKS[i]
        if picked and total + len(c["display"]) > max_chars:
            break
        picked.append((sc, c))
        total += len(c["display"])
        if len(picked) >= k:
            break
    return picked


def build_context(history):
    """Use the last two user messages as the search query. Broad questions
    ('what are your prices', 'what services do you offer') get the COMPLETE
    pinned document so the answer is always full and consistent. Specific
    questions use targeted search."""
    user_msgs = [m["content"] for m in history if m.get("role") == "user"]
    if not user_msgs:
        return NO_CONTEXT_NOTE
    last = user_msgs[-1].strip()
    # Search uses the current question. Only a very short fragment ("2 days",
    # "yes") borrows the previous message. Routing (price/services detection)
    # always uses the current question ALONE, so a previous topic can't pollute it.
    if len(user_msgs) >= 2 and len(last.split()) <= 2:
        query = user_msgs[-2] + " " + last
    else:
        query = last
    ql = last.lower()
    qt = expand(tokenize(last))
    qset = set(qt)

    price_intent = bool(qset & PRICE_INTENT)
    service_named = bool(qset & SERVICE_TERMS)
    services_overview = any(p in ql for p in (
        "what service", "which service", "services do you", "service do you",
        "what do you offer", "what do you do", "what can you do",
        "list your service", "list of service", "all your service", "everything you",
    ))

    # broad price question -> full price list (+ one extra relevant non-price chunk)
    if price_intent and not service_named:
        extra = [c["display"] for _, c in retrieve(query, k=3) if c["topic"] != "Pricing"]
        ctx = PRICING_DOC
        if extra:
            ctx += "\n\n" + extra[0]
        note = (
            "(IMPORTANT: the visitor just asked a GENERAL pricing question, not specific to "
            "whatever was discussed earlier in this conversation. Give a broad overview spanning "
            "several DIFFERENT services/categories below - do not limit the answer to only the "
            "topic from earlier messages.)\n\n"
        )
        return note + ctx

    # broad services question -> full services overview (+ a couple of search hits)
    if services_overview and not price_intent:
        extra = "\n\n".join(c["display"] for _, c in retrieve(query, k=2))
        ctx = (SERVICES_DOC + ("\n\n" + extra if extra else "")) or NO_CONTEXT_NOTE
        note = (
            "(IMPORTANT: the visitor just asked a GENERAL services question, not specific to "
            "whatever was discussed earlier. Give a broad overview spanning several categories "
            "below, not just the earlier topic.)\n\n"
        )
        return note + ctx

    # specific question -> targeted retrieval
    hits = retrieve(query)
    if not hits:
        return NO_CONTEXT_NOTE
    return "\n\n".join(c["display"] for _, c in hits)


# ---------------------------------------------------------------------------
# Output cleaning
# ---------------------------------------------------------------------------
def clean_reply(text: str) -> str:
    if not text:
        return text
    text = text.replace("\u2011", "-").replace("\u2010", "-")
    text = text.replace("\u2013", " - ").replace("\u2014", " - ")
    text = (text.replace("\u2018", "'").replace("\u2019", "'")
                .replace("\u201c", '"').replace("\u201d", '"'))
    text = text.replace("__", "")
    emoji = re.compile(
        "[\U0001F000-\U0001FAFF\U00002600-\U000027BF\U0001F1E6-\U0001F1FF\uFE0F\u200D\u2190-\u21FF]",
        flags=re.UNICODE,
    )
    text = emoji.sub("", text)
    text = re.sub(r"[ \t]{2,}", " ", text).strip()
    return text


# ---------------------------------------------------------------------------
# Groq call with retry/backoff
# ---------------------------------------------------------------------------
def call_groq(messages, max_retries: int = 4) -> str:
    last_error = None
    for attempt in range(max_retries):
        try:
            resp = requests.post(
                GROQ_URL,
                headers={
                    "Authorization": f"Bearer {GROQ_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": GROQ_MODEL,
                    "messages": messages,
                    "temperature": 0.2,
                    "max_tokens": 1200,
                },
                timeout=45,
            )
            if resp.status_code == 429 or resp.status_code >= 500:
                retry_after = resp.headers.get("retry-after")
                try:
                    wait = float(retry_after) if retry_after else 0.0
                except ValueError:
                    wait = 0.0
                if wait <= 0:
                    wait = 1.0 + 1.5 * attempt
                wait = min(wait, 8.0)
                print(f"Groq {resp.status_code}; retry {attempt + 1}/{max_retries} in {wait:.1f}s")
                last_error = f"status {resp.status_code}"
                time.sleep(wait)
                continue
            resp.raise_for_status()
            data = resp.json()
            return (data["choices"][0]["message"]["content"] or "").strip()
        except requests.exceptions.RequestException as exc:
            last_error = str(exc)
            print(f"Groq request error (attempt {attempt + 1}/{max_retries}):", exc)
            time.sleep(1.0 + 1.0 * attempt)
    raise RuntimeError(f"Groq unavailable after {max_retries} attempts: {last_error}")


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI(title="Himal Tech Chatbot")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def health():
    return {
        "status": "ok",
        "service": "Himal Tech Chatbot",
        "model": GROQ_MODEL,
        "groq_key_set": bool(GROQ_API_KEY),
        "leads_webhook_set": bool(LEADS_WEBHOOK_URL),
        "knowledge_chunks": len(CHUNKS),
    }


@app.get("/widget.js")
def widget():
    js = WIDGET_PATH.read_text(encoding="utf-8")
    return Response(
        content=js,
        media_type="application/javascript",
        headers={"Cache-Control": "public, max-age=600"},
    )


@app.get("/search")
def search(q: str = ""):
    """Debug endpoint: see what the retriever picks for a query."""
    hits = retrieve(q)
    return {
        "query": q,
        "results": [{"score": round(sc, 3), "section": c["bc"]} for sc, c in hits],
    }


@app.post("/chat")
async def chat(request: Request):
    try:
        body = await request.json()
    except Exception:
        return JSONResponse({"reply": FALLBACK_REPLY})

    history = body.get("messages")
    if not history:
        single = (body.get("message") or "").strip()
        history = [{"role": "user", "content": single}] if single else []

    history = [
        {"role": m.get("role", "user"), "content": str(m.get("content", ""))}
        for m in history
        if m.get("content")
    ][-10:]

    if not history:
        return JSONResponse({"reply": "Hi! How can I help you with Himal Tech's services today?"})

    context = build_context(history)
    system = SYSTEM_PROMPT + "\n\n===== CONTEXT (Himal Tech knowledge base) =====\n" + context + \
        "\n===== END CONTEXT ====="
    messages = [{"role": "system", "content": system}] + history

    if not GROQ_API_KEY:
        return JSONResponse({"reply": FALLBACK_REPLY})

    try:
        raw = await asyncio.to_thread(call_groq, messages)
        reply = clean_reply(raw)
        return JSONResponse({"reply": reply or FALLBACK_REPLY})
    except Exception as exc:
        print("Groq failed:", exc)
        return JSONResponse({"reply": FALLBACK_REPLY})


@app.post("/lead")
async def lead(request: Request):
    try:
        body = await request.json()
    except Exception:
        return JSONResponse({"ok": False, "error": "bad request"}, status_code=400)

    payload = {
        "name": (body.get("name") or "").strip(),
        "email": (body.get("email") or "").strip(),
        "need": (body.get("need") or "").strip(),
        "page": (body.get("page") or "").strip(),
    }
    if not payload["name"] and not payload["email"]:
        return JSONResponse({"ok": False, "error": "name or email required"}, status_code=400)

    if not LEADS_WEBHOOK_URL:
        print("LEAD (no webhook configured):", payload)
        return JSONResponse({"ok": True})

    try:
        requests.post(LEADS_WEBHOOK_URL, json=payload, timeout=15)
        return JSONResponse({"ok": True})
    except Exception as exc:
        print("Lead webhook error:", exc, payload)
        return JSONResponse({"ok": True})