/* Himal Tech AI Chatbot widget - flat/minimal build (v5 + call button).
   Same backend contract as before (BASE auto-detected from <script src>,
   POST /chat, POST /lead) - look: a clean, flat "docked card".

   Design language: solid violet accents on white, thin 1px borders,
   square-ish radii, no glow/blur/pulse. Quiet and professional. */
(function () {
  "use strict";

  /* ===== BRAND (unchanged) ===== */
  var V = "#8b3dff";        // primary brand violet
  var V_BRIGHT = "#a76bff"; // lighter violet (used sparingly as accent)
  var V_DEEP = "#5e1fbf";   // deep violet (used sparingly as accent)
  /* ============================= */

  var BOOK_URL = "https://himaltech.co.uk/appointment/";
  var PHONE_DISPLAY = "020 3305 8141";
  var PHONE_TEL = "+442033058141";

  var thisScript =
    document.currentScript ||
    (function () { var s = document.getElementsByTagName("script"); return s[s.length - 1]; })();
  var BASE = thisScript.src.replace(/\/widget\.js.*$/, "");

  (function () {
    var l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap";
    document.head.appendChild(l);
  })();

  // ---- icons (inline, currentColor) ------------------------------------
  var IC = {
    grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.6"/><rect x="14" y="3" width="7" height="7" rx="1.6"/><rect x="14" y="14" width="7" height="7" rx="1.6"/><rect x="3" y="14" width="7" height="7" rx="1.6"/></svg>',
    tag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.6 2.6A2 2 0 0 0 11.2 2H4a2 2 0 0 0-2 2v7.2a2 2 0 0 0 .6 1.4l8.7 8.7a2.4 2.4 0 0 0 3.4 0l6.6-6.6a2.4 2.4 0 0 0 0-3.4z"/><circle cx="7.5" cy="7.5" r="1.1" fill="currentColor" stroke="none"/></svg>',
    phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.9.7 2.8a2 2 0 0 1-.4 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.9.6 2.8.7a2 2 0 0 1 1.7 2z"/></svg>',
    cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4.5" width="18" height="17" rx="2.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/></svg>',
    send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4 20-7z"/></svg>',
    chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-8.4 8.4 8.6 8.6 0 0 1-3.5-.7L3 21l1.9-5.1a8.3 8.3 0 0 1-.8-3.6A8.4 8.4 0 0 1 12.5 3.5 8.5 8.5 0 0 1 21 11.5z"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>'
  };

  // ---- styles: flat, square-ish, low-chroma card UI ---------------------
  var css =
    "#htbot{--v:" + V + ";--vb:" + V_BRIGHT + ";--vd:" + V_DEEP + ";" +
    "--ink:#16121f;--mut:#857f96;--line:#e4e0ec;--bg:#fbfafd;" +
    "position:fixed;bottom:20px;right:20px;z-index:2147483000;" +
    "font-family:'Inter',-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif}" +
    "#htbot *{box-sizing:border-box;margin:0;padding:0;font-family:inherit}" +
    "@media (prefers-reduced-motion:reduce){#htbot *{animation:none!important;transition:none!important}}" +

    "#htbot-launch{position:relative;width:56px;height:56px;border-radius:16px;border:none;cursor:pointer;" +
    "background:var(--v);color:#fff;display:flex;align-items:center;justify-content:center;" +
    "box-shadow:0 4px 14px rgba(20,8,40,.22);transition:transform .15s ease,box-shadow .15s ease}" +
    "#htbot-launch:hover{transform:translateY(-2px);box-shadow:0 8px 20px rgba(20,8,40,.28)}" +
    "#htbot-launch:active{transform:translateY(0) scale(.96)}" +
    "#htbot-launch.hide{opacity:0;transform:scale(.7);pointer-events:none}" +
    "#htbot-launch svg{width:25px;height:25px}" +

    "#htbot-badge{position:absolute;top:-5px;right:-5px;min-width:19px;height:19px;padding:0 4px;border-radius:6px;" +
    "background:var(--ink);color:#fff;font-size:11px;font-weight:700;display:flex;" +
    "align-items:center;justify-content:center;border:2px solid #fff}" +
    "#htbot-badge.gone{display:none}" +

    "#htbot-teaser{position:absolute;bottom:68px;right:0;max-width:248px;background:var(--ink);" +
    "color:#fff;padding:13px 16px;border-radius:12px 12px 2px 12px;font-size:13.5px;line-height:1.55;cursor:pointer;" +
    "opacity:0;transform:translateY(8px);transition:opacity .2s ease,transform .2s ease;pointer-events:none}" +
    "#htbot-teaser.show{opacity:1;transform:translateY(0);pointer-events:auto}" +
    "#htbot-teaser b{color:var(--vb);font-weight:700}" +
    "#htbot-teaser .htbot-tx{position:absolute;top:-9px;right:-9px;width:22px;height:22px;border-radius:50%;" +
    "background:#fff;color:var(--ink);font-size:14px;display:flex;align-items:center;justify-content:center;" +
    "box-shadow:0 2px 6px rgba(0,0,0,.18);cursor:pointer}" +

    "#htbot-panel{position:absolute;bottom:0;right:0;width:380px;max-width:calc(100vw - 20px);" +
    "height:600px;max-height:calc(100vh - 32px);background:#fff;border-radius:16px;overflow:hidden;" +
    "display:flex;flex-direction:column;border:1px solid var(--line);" +
    "box-shadow:0 16px 40px rgba(20,8,40,.16);" +
    "opacity:0;visibility:hidden;transform:translateY(14px);" +
    "transition:opacity .22s ease,transform .22s ease,visibility .22s}" +
    "#htbot-panel.open{opacity:1;visibility:visible;transform:translateY(0)}" +

    "#htbot-head{position:relative;background:#fff;color:var(--ink);padding:16px 16px;display:flex;" +
    "align-items:center;gap:12px;flex-shrink:0;border-bottom:1px solid var(--line)}" +
    "#htbot-head::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:var(--v)}" +
    "#htbot-ava{width:34px;height:34px;border-radius:9px;background:var(--v);color:#fff;" +
    "display:flex;align-items:center;justify-content:center;font-weight:800;font-size:15px;flex-shrink:0}" +
    "#htbot-head .htbot-meta{flex:1;min-width:0}" +
    "#htbot-head h3{font-size:14.5px;font-weight:700;letter-spacing:-.2px}" +
    "#htbot-head p{margin-top:2px;font-size:11.5px;color:var(--mut);display:flex;align-items:center;gap:6px;font-weight:500}" +
    "#htbot-dot{width:7px;height:7px;border-radius:50%;background:#22c55e}" +
    "#htbot-close{background:none;border:none;color:var(--mut);width:30px;height:30px;border-radius:8px;" +
    "cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .15s,color .15s}" +
    "#htbot-close:hover{background:var(--bg);color:var(--ink)}#htbot-close svg{width:17px;height:17px}" +

    "#htbot-msgs{flex:1;overflow-y:auto;padding:18px 16px 6px;background:#fff}" +
    "#htbot-msgs::-webkit-scrollbar{width:5px}" +
    "#htbot-msgs::-webkit-scrollbar-thumb{background:var(--line);border-radius:3px}" +
    "#htbot-msgs::-webkit-scrollbar-track{background:transparent}" +

    "#htbot .htbot-row{display:flex;gap:8px;margin:16px 0 30px;align-items:flex-end}" +
    ".htbot-row.user{justify-content:flex-end}" +
    "#htbot .htbot-mini{width:24px;height:24px;border-radius:7px;background:var(--v);color:#fff;flex-shrink:0;" +
    "display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;margin-bottom:1px}" +
    ".htbot-row.user .htbot-mini{display:none}" +

    "#htbot .htbot-bub{max-width:82%;padding:16px 19px;font-size:15px;line-height:1.75;word-wrap:break-word;overflow-wrap:break-word}" +
    ".htbot-row.bot .htbot-bub{background:var(--bg);color:var(--ink);border:1px solid var(--line);" +
    "border-left:3px solid var(--v);border-radius:4px 14px 14px 14px;box-shadow:0 1px 3px rgba(20,8,40,.05)}" +
    ".htbot-row.user .htbot-bub{background:var(--v);color:#fff;border-radius:14px 4px 14px 14px;" +
    "box-shadow:0 3px 10px rgba(139,61,255,.28)}" +

    "#htbot .htbot-bub br{content:'';display:block;margin-top:5px}" +
    ".htbot-bub a{color:inherit;font-weight:600;text-decoration:underline;text-underline-offset:2px}" +
    ".htbot-bub strong{font-weight:700;color:var(--vd)}" +
    ".htbot-row.user .htbot-bub strong{color:#fff}" +
    "#htbot .htbot-bub .htbot-price{display:inline-block;background:#ecfdf5;color:#0a7d52;font-weight:700;" +
    "padding:1px 8px;border-radius:5px;font-size:12.5px;border:1px solid #b9ecd6}" +

    "#htbot .htbot-caret{display:inline-block;width:2px;height:14px;background:var(--v);margin-left:1px;" +
    "vertical-align:text-bottom;animation:htb-blink .8s steps(1) infinite}" +
    "@keyframes htb-blink{50%{opacity:0}}" +
    "#htbot .htbot-typing{display:inline-flex;gap:4px;padding:3px 2px}" +
    ".htbot-typing i{width:5px;height:5px;border-radius:50%;background:var(--mut);" +
    "animation:htb-bounce 1.1s infinite}" +
    ".htbot-typing i:nth-child(2){animation-delay:.15s}.htbot-typing i:nth-child(3){animation-delay:.3s}" +
    "@keyframes htb-bounce{0%,60%,100%{opacity:.35;transform:translateY(0)}30%{opacity:1;transform:translateY(-3px)}}" +

    /* Chips: flat 2-column grid; .wide spans both columns for the call button */
    "#htbot-chips{display:grid;grid-template-columns:1fr 1fr;gap:9px;padding:10px 16px 14px;flex-shrink:0;" +
    "border-top:1px solid var(--line)}" +
    "#htbot .htbot-chip{display:flex;align-items:center;justify-content:center;gap:5px;border-radius:10px;padding:8px 6px;" +
    "font-size:11.5px;font-weight:600;cursor:pointer;text-align:center;line-height:1.3;" +
    "border:1px solid var(--line);background:#fff;color:var(--ink);transition:border-color .15s,color .15s,background .15s}" +
    ".htbot-chip svg{width:15px;height:15px;flex-shrink:0}" +
    ".htbot-chip:hover{border-color:var(--v);color:var(--v);background:var(--bg)}" +
    ".htbot-chip.solid{background:var(--ink);color:#fff;border-color:var(--ink)}" +
    ".htbot-chip.solid:hover{background:var(--v);border-color:var(--v);color:#fff}" +
    ".htbot-chip.wide{grid-column:1 / -1}" +
    ".htbot-chip.outline-v{border-color:var(--v);color:var(--v)}" +
    ".htbot-chip.outline-v:hover{background:var(--v);color:#fff}" +

    "#htbot-foot{display:flex;align-items:center;gap:8px;border-top:1px solid var(--line);" +
    "padding:12px 14px;background:#fff;flex-shrink:0}" +
    "#htbot-input{flex:1;border:1px solid var(--line);border-radius:9px;padding:10px 12px;" +
    "font-size:13.5px;outline:none;color:var(--ink);background:var(--bg);transition:border-color .15s}" +
    "#htbot-input:focus{border-color:var(--v);background:#fff}" +
    "#htbot-input::placeholder{color:#b5aec4}" +
    "#htbot-send{background:var(--v);color:#fff;border:none;border-radius:9px;width:38px;height:38px;" +
    "cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center;transition:background .15s}" +
    "#htbot-send:hover{background:var(--vd)}#htbot-send svg{width:16px;height:16px}" +

    "#htbot-brand{text-align:center;font-size:10.5px;color:var(--mut);padding:0 0 10px;background:#fff;flex-shrink:0}" +
    "#htbot-brand b{color:var(--v);font-weight:700}" +

    "#htbot .htbot-form{width:100%;max-width:100%!important;background:var(--bg);" +
    "border:1px solid var(--line);border-radius:10px;padding:16px}" +
    "#htbot .htbot-form .ft{font-size:14px;font-weight:700;color:var(--ink);margin-bottom:3px}" +
    "#htbot .htbot-form .fs{font-size:12px;color:var(--mut);margin-bottom:12px;line-height:1.5}" +
    "#htbot .htbot-form label{display:block;font-size:11px;color:var(--mut);margin:10px 0 4px;font-weight:700;text-transform:uppercase;letter-spacing:.4px}" +
    "#htbot .htbot-form input,#htbot .htbot-form textarea{width:100%;border:1px solid var(--line);border-radius:8px;" +
    "padding:10px 11px;font-size:13px;outline:none;color:var(--ink);background:#fff;transition:border-color .15s}" +
    ".htbot-form input:focus,.htbot-form textarea:focus{border-color:var(--v)}" +
    "#htbot .htbot-form .fsub{width:100%;margin-top:14px;background:var(--v);color:#fff;" +
    "border:none;border-radius:8px;padding:11px;font-size:13.5px;font-weight:700;cursor:pointer;transition:background .15s}" +
    ".htbot-form .fsub:hover{background:var(--vd)}" +
    "#htbot .htbot-form .fcancel{width:100%;background:none;border:none;color:var(--mut);margin-top:8px;" +
    "font-size:12px;cursor:pointer;font-weight:600}" +
    ".htbot-form .fcancel:hover{color:var(--v)}";

  var style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  var root = document.createElement("div");
  root.id = "htbot";
  root.innerHTML =
    '<div id="htbot-teaser"><span class="htbot-tx">&times;</span>How can we <br> help you today?</div>' +
    '<div id="htbot-panel" role="dialog" aria-label="Himal Tech chat">' +
    '  <div id="htbot-head">' +
    '    <div id="htbot-ava">H</div>' +
    '    <div class="htbot-meta"><h3>Himal Tech</h3><p><span id="htbot-dot"></span>Online &middot; replies instantly</p></div>' +
    '    <button id="htbot-close" aria-label="Close chat">' + IC.close + '</button>' +
    "  </div>" +
    '  <div id="htbot-msgs"></div>' +
    '  <div id="htbot-chips"></div>' +
    '  <div id="htbot-foot">' +
    '    <input id="htbot-input" type="text" placeholder="Type your message..." autocomplete="off" aria-label="Message">' +
    '    <button id="htbot-send" aria-label="Send message">' + IC.send + "</button>" +
    "  </div>" +
    '  <div id="htbot-brand">Powered by <b>Himal Tech AI</b></div>' +
    "</div>" +
    '<button id="htbot-launch" aria-label="Open chat">' +
    '<span id="htbot-badge">1</span>' + IC.chat +
    "</button>";
  document.body.appendChild(root);

  var panel = root.querySelector("#htbot-panel");
  var msgs = root.querySelector("#htbot-msgs");
  var chips = root.querySelector("#htbot-chips");
  var input = root.querySelector("#htbot-input");
  var teaser = root.querySelector("#htbot-teaser");
  var launch = root.querySelector("#htbot-launch");
  var badge = root.querySelector("#htbot-badge");

  var history = [];
  var greeted = false;
  var busy = false;

  function esc(t) { return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function format(t) {
    var out = esc(t);
    out = out.replace(/(https?:\/\/[^\s<]+)/g, function (m) {
      var tr = ""; while (/[.,!?)]$/.test(m)) { tr = m.slice(-1) + tr; m = m.slice(0, -1); }
      return '<a href="' + m + '" target="_blank" rel="noopener">' + m + "</a>" + tr;
    });
    out = out.replace(/([\w.+-]+@[\w-]+\.[\w.-]+)/g, '<a href="mailto:$1">$1</a>');
    out = out.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    out = out.replace(/£\d[\d,]*(?:\.\d+)?\+?/g, '<span class="htbot-price">$&</span>');
    out = out.replace(/\n{2,}/g, "<br><br>").replace(/\n/g, "<br>");
    return out;
  }

  function addMsg(role, text) {
    var row = document.createElement("div");
    row.className = "htbot-row " + role;
    row.innerHTML = (role === "bot" ? '<div class="htbot-mini">H</div>' : "") +
      '<div class="htbot-bub">' + format(text) + "</div>";
    msgs.appendChild(row);
    msgs.scrollTop = msgs.scrollHeight;
    return row;
  }

  function typeBot(text, done) {
    var row = document.createElement("div");
    row.className = "htbot-row bot";
    var bub = document.createElement("div");
    bub.className = "htbot-bub";
    bub.innerHTML = '<span class="htbot-caret"></span>';
    row.innerHTML = '<div class="htbot-mini">H</div>';
    row.appendChild(bub);
    msgs.appendChild(row);
    msgs.scrollTop = msgs.scrollHeight;

    var tokens = text.split(/(\s+)/), i = 0, shown = "";
    (function tick() {
      if (i < tokens.length) {
        shown += tokens[i]; i++;
        bub.innerHTML = esc(shown).replace(/\n/g, "<br>") + '<span class="htbot-caret"></span>';
        msgs.scrollTop = msgs.scrollHeight;
        setTimeout(tick, 16);
      } else {
        bub.innerHTML = format(text);
        msgs.scrollTop = msgs.scrollHeight;
        if (done) done();
      }
    })();
  }

  function setChips(items) {
    chips.innerHTML = "";
    items.forEach(function (it) {
      var c = document.createElement("button");
      c.className = "htbot-chip " + (it.kind || "");
      c.innerHTML = (it.icon || "") + "<span>" + it.label + "</span>";
      c.onclick = it.action;
      chips.appendChild(c);
    });
  }
  function defaultChips() {
    setChips([
      { label: "Request a callback", icon: IC.phone, kind: "solid", action: showLeadForm },
      { label: "Our services", icon: IC.grid, action: function () { sendUser("What services do you offer?"); } },
      { label: "Pricing", icon: IC.tag, action: function () { sendUser("What are your prices?"); } },
      { label: "Book appointment", icon: IC.cal, action: function () { window.open(BOOK_URL, "_blank"); } },
    ]);
  }

  function greet() {
    if (greeted) return;
    greeted = true;
    typeBot("Welcome to Himal Tech. We build websites and grow rankings for businesses across the UK. What can I help you with today?", defaultChips);
  }

  function showTyping() {
    var row = document.createElement("div");
    row.className = "htbot-row bot";
    row.innerHTML = '<div class="htbot-mini">H</div><div class="htbot-bub"><span class="htbot-typing"><i></i><i></i><i></i></span></div>';
    msgs.appendChild(row);
    msgs.scrollTop = msgs.scrollHeight;
    return row;
  }

  function sendUser(text) {
    text = (text || "").trim();
    if (!text || busy) return;
    busy = true;
    addMsg("user", text);
    history.push({ role: "user", content: text });
    input.value = "";
    var typing = showTyping();

    fetch(BASE + "/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: history }),
    })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        typing.remove();
        var reply = (d && d.reply) || "Sorry, please try again.";
        history.push({ role: "assistant", content: reply });
        typeBot(reply, function () { busy = false; defaultChips(); });
      })
      .catch(function () {
        typing.remove(); busy = false;
        addMsg("bot", "I could not reach the server just now. Email info@himaltech.co.uk or call 020 3305 8141 and we will help straight away.");
        defaultChips();
      });
  }

  function showLeadForm() {
    var form = document.createElement("div");
    form.className = "htbot-row bot";
    form.innerHTML =
      '<div class="htbot-form">' +
      '<div class="ft">Request a callback</div>' +
      '<div class="fs">Leave your details and a specialist will be in touch shortly.</div>' +
      "<label>Name</label><input id='htbot-l-name' type='text' placeholder='Your full name'>" +
      "<label>Email</label><input id='htbot-l-email' type='email' placeholder='your@email.com'>" +
      "<label>What do you need?</label><textarea id='htbot-l-need' rows='3' placeholder='Tell us about your project...'></textarea>" +
      "<button class='fsub' id='htbot-l-submit'>Send my details</button>" +
      "<button class='fcancel' id='htbot-l-cancel'>Back to chat</button>" +
      "</div>";
    msgs.appendChild(form);
    msgs.scrollTop = msgs.scrollHeight;

    form.querySelector("#htbot-l-cancel").onclick = function () { form.remove(); defaultChips(); };
    form.querySelector("#htbot-l-submit").onclick = function () {
      var name = form.querySelector("#htbot-l-name").value.trim();
      var email = form.querySelector("#htbot-l-email").value.trim();
      var need = form.querySelector("#htbot-l-need").value.trim();
      if (!name || !email) { alert("Please add your name and email."); return; }
      var btn = form.querySelector("#htbot-l-submit");
      if (btn.disabled) return; // already submitting - ignore double-clicks/double-taps
      btn.disabled = true;
      btn.textContent = "Sending...";
      fetch(BASE + "/lead", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name, email: email, need: need, page: location.href }),
      })
        .then(function () {
          form.remove();
          typeBot("Thank you " + name + ". Your details are with our team and we will be in touch very soon. Want to lock in a time now? Book instantly at " + BOOK_URL, defaultChips);
        })
        .catch(function () {
          form.remove();
          addMsg("bot", "Could not send that just now. Please email info@himaltech.co.uk and we will sort it out.");
          defaultChips();
        });
    };
  }

  function openPanel() {
    panel.classList.add("open");
    teaser.classList.remove("show");
    launch.classList.add("hide");
    if (badge) badge.classList.add("gone");
    defaultChips();
    greet();
    setTimeout(function () { input.focus(); }, 240);
  }
  function closePanel() {
    panel.classList.remove("open");
    launch.classList.remove("hide");
  }

  launch.onclick = openPanel;
  teaser.onclick = function (e) {
    if (e.target && e.target.className === "htbot-tx") { teaser.classList.remove("show"); return; }
    openPanel();
  };
  root.querySelector("#htbot-close").onclick = closePanel;
  root.querySelector("#htbot-send").onclick = function () { sendUser(input.value); };
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter") { e.preventDefault(); sendUser(input.value); }
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && panel.classList.contains("open")) closePanel();
  });

  setTimeout(function () {
    if (!panel.classList.contains("open")) teaser.classList.add("show");
  }, 4500);
})();