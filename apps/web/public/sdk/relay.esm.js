const xe = {
  "us-west": "https://us-west.api.relay.dev",
  "eu-west": "https://eu-west.api.relay.dev"
};
class ve {
  constructor(e) {
    this.sessionId = null, this.apiKey = e.apiKey, this.endpoint = e.endpoint || xe[e.regionHint || "us-west"], typeof window < "u" && window.location.hostname === "localhost" && (this.endpoint = "http://localhost:3001");
  }
  setSessionId(e) {
    this.sessionId = e;
  }
  async request(e, t = {}) {
    var c, p, y;
    const { method: r = "GET", body: a, headers: s = {}, timeout: i = 3e4 } = t, l = new AbortController(), o = setTimeout(() => l.abort(), i);
    try {
      const n = await fetch(`${this.endpoint}/trpc/${e}`, {
        method: r,
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": this.apiKey,
          ...s
        },
        body: a ? JSON.stringify(a) : void 0,
        signal: l.signal
      });
      if (clearTimeout(o), !n.ok) {
        const g = await n.json().catch(() => ({}));
        throw new Error(g.message || `API error: ${n.status}`);
      }
      const u = await n.json();
      return ((p = (c = u.result) == null ? void 0 : c.data) == null ? void 0 : p.json) ?? ((y = u.result) == null ? void 0 : y.data);
    } catch (n) {
      throw clearTimeout(o), n instanceof Error && n.name === "AbortError" ? new Error("Request timeout") : n;
    }
  }
  // tRPC-style mutation call
  async mutation(e, t) {
    const r = encodeURIComponent(JSON.stringify({ json: t }));
    return this.request(`${e}?input=${r}`, {
      method: "POST",
      body: { json: t }
    });
  }
  // tRPC-style query call
  async query(e, t) {
    const r = t ? `?input=${encodeURIComponent(JSON.stringify({ json: t }))}` : "";
    return this.request(`${e}${r}`, { method: "GET" });
  }
  // Session management
  async createSession(e) {
    return this.mutation("ingest.session", e);
  }
  async updateSession(e) {
    await this.mutation("ingest.updateSession", {
      sessionId: e,
      lastSeenAt: /* @__PURE__ */ new Date()
    });
  }
  // User identification
  async identify(e) {
    return this.mutation("ingest.identify", e);
  }
  // Create interaction
  async createInteraction(e) {
    return this.mutation("ingest.interaction", e);
  }
  // Store logs
  async storeLogs(e) {
    return this.mutation("ingest.logs", e);
  }
  // Media upload
  async initiateUpload(e) {
    return this.mutation("ingest.initiateUpload", e);
  }
  async completeUpload(e) {
    return this.mutation("ingest.completeUpload", { mediaId: e });
  }
  // Replay
  async startReplay(e, t) {
    return this.mutation("ingest.startReplay", { sessionId: e, interactionId: t });
  }
  async sendReplayChunk(e) {
    return this.mutation("ingest.replayChunk", e);
  }
  async endReplay(e, t) {
    return this.mutation("ingest.endReplay", { replayId: e, totalEventCount: t });
  }
  // Track event
  async track(e, t, r) {
    await this.mutation("ingest.track", { sessionId: e, event: t, properties: r });
  }
  // Feedback
  async getFeedbackItems(e) {
    return this.query("feedback.publicList", { sessionId: e });
  }
  async voteFeedback(e, t, r) {
    await this.mutation("feedback.vote", { feedbackItemId: e, sessionId: t, userId: r });
  }
  async unvoteFeedback(e, t) {
    await this.mutation("feedback.unvote", { feedbackItemId: e, sessionId: t });
  }
  // Surveys
  async getActiveSurveys(e) {
    return this.query("surveys.getActiveSurveys", e);
  }
  async submitSurveyResponse(e) {
    return this.mutation("surveys.respond", e);
  }
  // Chat
  async startConversation(e) {
    return this.mutation("conversations.start", e);
  }
  async sendMessage(e, t) {
    return this.mutation("conversations.sendUserMessage", {
      conversationId: e,
      body: t
    });
  }
  async getConversations(e) {
    return this.query("conversations.getUserConversations", { sessionId: e });
  }
  async getMessages(e) {
    return this.query("conversations.getMessages", { conversationId: e });
  }
  async markMessagesRead(e) {
    await this.mutation("conversations.markRead", { conversationId: e });
  }
  // Roadmap
  async getPublicRoadmap() {
    return this.query("roadmap.publicList", {});
  }
  // Help / Knowledge Base
  async getHelpCategories() {
    return this.query("knowledge.getPublicCategories", {});
  }
  async getHelpArticles(e) {
    return this.query(
      "knowledge.getPublicArticles",
      e ? { categoryId: e } : {}
    );
  }
  async searchHelpArticles(e) {
    return this.query("knowledge.sdkSearchArticles", { query: e, limit: 20 });
  }
  async getHelpArticle(e) {
    return this.query("knowledge.sdkGetArticle", { slug: e });
  }
  // Tours
  async getActiveTours(e) {
    return this.query("tours.getActiveTours", e);
  }
  async startTour(e) {
    return this.mutation("tours.startTour", e);
  }
  async updateTourProgress(e) {
    return this.mutation("tours.updateProgress", e);
  }
  // ============================================================================
  // AI BOT (Kai)
  // ============================================================================
  async getBotConfig() {
    return this.query("bot.sdkGetConfig", {});
  }
  async startBotConversation(e) {
    return this.mutation("bot.sdkStartConversation", e);
  }
  async sendBotMessage(e) {
    return this.mutation("bot.sdkChat", e);
  }
  async escalateToHuman(e) {
    return this.mutation("bot.sdkEscalateToHuman", e);
  }
  async getBotChatHistory(e, t = 50) {
    return this.query("bot.sdkGetHistory", { conversationId: e, limit: t });
  }
}
function we(h = 500) {
  const e = [], t = {
    log: console.log,
    info: console.info,
    warn: console.warn,
    error: console.error,
    debug: console.debug
  };
  let r = !1;
  function a(i) {
    var l, o;
    if (i == null || typeof i == "string" || typeof i == "number" || typeof i == "boolean")
      return i;
    try {
      if (i instanceof Error)
        return {
          name: i.name,
          message: i.message,
          stack: i.stack
        };
      if (i instanceof Event)
        return {
          type: i.type,
          target: (o = (l = i.target) == null ? void 0 : l.constructor) == null ? void 0 : o.name
        };
      const c = JSON.stringify(i, null, 0);
      return c && c.length < 5e3 ? JSON.parse(c) : "[Object too large]";
    } catch {
      return String(i);
    }
  }
  function s(i) {
    return (...l) => {
      if (t[i].apply(console, l), !r)
        return;
      const o = {
        level: i,
        message: l.map((c) => typeof c == "string" ? c : JSON.stringify(c)).join(" "),
        args: l.slice(0, 5).map(a),
        timestamp: Date.now()
      };
      for (i === "error" && l[0] instanceof Error && (o.stack = l[0].stack), e.push(o); e.length > h; )
        e.shift();
    };
  }
  return {
    start() {
      r || (r = !0, Object.keys(t).forEach((i) => {
        console[i] = s(i);
      }));
    },
    stop() {
      r && (r = !1, Object.keys(t).forEach((i) => {
        console[i] = t[i];
      }));
    },
    getEntries() {
      return [...e];
    },
    clear() {
      e.length = 0;
    }
  };
}
const _e = [/relay\.dev/i, /localhost:3001/i, /\/trpc\//i];
function W(h) {
  return !_e.some((e) => e.test(h));
}
function ke(h = 200) {
  const e = [];
  let t = !1;
  const r = window.fetch, a = XMLHttpRequest.prototype.open, s = XMLHttpRequest.prototype.send;
  function i(o) {
    if (t)
      for (e.push(o); e.length > h; )
        e.shift();
  }
  function l(o, c) {
    const p = Date.now(), y = typeof o == "string" ? o : o instanceof URL ? o.toString() : o.url, n = (c == null ? void 0 : c.method) || "GET";
    if (!W(y))
      return r.call(window, o, c);
    const u = {
      method: n.toUpperCase(),
      url: y,
      timestamp: p
    };
    if (c != null && c.body)
      try {
        u.requestSize = typeof c.body == "string" ? c.body.length : c.body instanceof Blob ? c.body.size : c.body instanceof ArrayBuffer ? c.body.byteLength : void 0;
      } catch {
      }
    return r.call(window, o, c).then(
      async (g) => {
        u.status = g.status, u.duration = Date.now() - p;
        const f = g.headers.get("content-length");
        return f && (u.responseSize = parseInt(f, 10)), i(u), g;
      },
      (g) => {
        throw u.duration = Date.now() - p, u.error = (g == null ? void 0 : g.message) || "Network error", i(u), g;
      }
    );
  }
  return {
    start() {
      t || (t = !0, window.fetch = l, XMLHttpRequest.prototype.open = function(o, c, p, y, n) {
        const u = c.toString();
        return this.__relayData = {
          method: o.toUpperCase(),
          url: u,
          startTime: 0,
          shouldCapture: W(u)
        }, a.call(
          this,
          o,
          c,
          p ?? !0,
          y,
          n
        );
      }, XMLHttpRequest.prototype.send = function(o) {
        const c = this.__relayData;
        if (c != null && c.shouldCapture) {
          if (c.startTime = Date.now(), o)
            try {
              c.requestSize = typeof o == "string" ? o.length : o instanceof Blob ? o.size : o instanceof ArrayBuffer ? o.byteLength : void 0;
            } catch {
            }
          this.addEventListener("load", () => {
            const p = {
              method: c.method,
              url: c.url,
              status: this.status,
              duration: Date.now() - c.startTime,
              requestSize: c.requestSize,
              timestamp: c.startTime
            }, y = this.getResponseHeader("content-length");
            y && (p.responseSize = parseInt(y, 10)), i(p);
          }), this.addEventListener("error", () => {
            const p = {
              method: c.method,
              url: c.url,
              duration: Date.now() - c.startTime,
              error: "Network error",
              timestamp: c.startTime
            };
            i(p);
          }), this.addEventListener("timeout", () => {
            const p = {
              method: c.method,
              url: c.url,
              duration: Date.now() - c.startTime,
              error: "Timeout",
              timestamp: c.startTime
            };
            i(p);
          });
        }
        return s.call(this, o);
      });
    },
    stop() {
      t && (t = !1, window.fetch = r, XMLHttpRequest.prototype.open = a, XMLHttpRequest.prototype.send = s);
    },
    getEntries() {
      return [...e];
    },
    clear() {
      e.length = 0;
    }
  };
}
function Ce(h = 100) {
  const e = [], t = /* @__PURE__ */ new Map();
  let r = !1;
  function a(o) {
    return `${o.message}|${o.filename || ""}|${o.lineno || 0}`;
  }
  function s(o) {
    if (!r)
      return;
    const c = a(o), p = t.get(c) || 0;
    t.set(c, p + 1);
    const y = e.findIndex(
      (n) => n.message === o.message && n.filename === o.filename && n.lineno === o.lineno
    );
    if (y >= 0)
      e[y].count = p + 1;
    else
      for (e.push({
        message: o.message,
        stack: o.stack,
        type: o.type,
        filename: o.filename,
        lineno: o.lineno,
        colno: o.colno,
        timestamp: Date.now(),
        count: 1
      }); e.length > h; ) {
        const n = e.shift();
        t.delete(a(n));
      }
  }
  function i(o) {
    var c, p;
    s({
      message: o.message || "Unknown error",
      stack: (c = o.error) == null ? void 0 : c.stack,
      type: ((p = o.error) == null ? void 0 : p.name) || "Error",
      filename: o.filename,
      lineno: o.lineno,
      colno: o.colno
    });
  }
  function l(o) {
    const c = o.reason;
    s({
      message: (c == null ? void 0 : c.message) || String(c) || "Unhandled Promise Rejection",
      stack: c == null ? void 0 : c.stack,
      type: "UnhandledRejection"
    });
  }
  return {
    start() {
      r || (r = !0, window.addEventListener("error", i), window.addEventListener("unhandledrejection", l));
    },
    stop() {
      r && (r = !1, window.removeEventListener("error", i), window.removeEventListener("unhandledrejection", l));
    },
    getEntries() {
      return [...e];
    },
    clear() {
      e.length = 0, t.clear();
    }
  };
}
const Y = 5e3, Se = 5e3;
function Te(h) {
  let e = null, t = [], r = 0, a = null, s = 0, i = !1, l = null;
  function o() {
    if (t.length === 0)
      return;
    const c = [...t];
    t = [], h && (h(c, r), r++), s = Date.now();
  }
  return {
    async start(c = {}) {
      if (i)
        return;
      l = (await import("./rrweb-B8VVt1eP.mjs")).record, i = !0, t = [], r = 0, s = Date.now(), e = l({
        emit(u) {
          t.push(u), (t.length >= Se || Date.now() - s >= Y) && o();
        },
        maskTextSelector: c.maskTextSelector || 'input[type="password"], .relay-mask',
        maskInputOptions: {
          password: !0,
          email: !!c.maskTextSelector
        },
        blockSelector: c.blockSelector || ".relay-block",
        blockClass: c.blockClass,
        maskTextClass: c.maskTextClass,
        maskTextFn: c.maskTextFn,
        sampling: c.sampling || {
          mousemove: 50,
          // Record mouse every 50ms
          mouseInteraction: !0,
          scroll: 150,
          // Record scroll every 150ms
          media: 800,
          input: "last"
        },
        slimDOMOptions: {
          script: !0,
          comment: !0,
          headFavicon: !0,
          headWhitespace: !0,
          headMetaSocial: !0,
          headMetaRobots: !0,
          headMetaHttpEquiv: !0,
          headMetaVerification: !0,
          headMetaAuthorship: !0
        },
        recordCanvas: !1,
        // Canvas recording is expensive
        recordCrossOriginIframes: !1,
        collectFonts: !0,
        inlineImages: !1,
        inlineStylesheet: !0
      }), a = setInterval(o, Y);
    },
    async stop() {
      return i ? (i = !1, a && (clearInterval(a), a = null), e && (e(), e = null), o(), t) : [];
    },
    isRecording() {
      return i;
    },
    getEvents() {
      return [...t];
    },
    clearEvents() {
      t = [];
    }
  };
}
function Me(h, e) {
  const t = [];
  return e.forEach((r) => {
    h.querySelectorAll(r).forEach((a) => {
      t.push({ el: a, original: a.innerHTML }), a.innerHTML = '<span style="background:#ccc;display:block;width:100%;height:100%"></span>';
    });
  }), () => {
    t.forEach(({ el: r, original: a }) => {
      r.innerHTML = a;
    });
  };
}
function Le(h, e) {
  const t = [];
  return e.forEach((r) => {
    h.querySelectorAll(r).forEach((a) => {
      t.push({ el: a, original: a.style.visibility }), a.style.visibility = "hidden";
    });
  }), () => {
    t.forEach(({ el: r, original: a }) => {
      r.style.visibility = a;
    });
  };
}
async function Ee(h = {}) {
  const {
    quality: e = 0.92,
    format: t = "png",
    maxWidth: r = 1920,
    maxHeight: a = 1080,
    maskSelectors: s = [],
    blockSelectors: i = []
  } = h, l = Me(document, s), o = Le(document, i);
  try {
    const c = (await import("./html2canvas.esm-CKxSAI8P.mjs")).default, p = await c(document.documentElement, {
      logging: !1,
      useCORS: !0,
      allowTaint: !0,
      scale: Math.min(window.devicePixelRatio, 2),
      width: Math.min(window.innerWidth, r),
      height: Math.min(window.innerHeight, a),
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight
    }), y = t === "png" ? "image/png" : t === "jpeg" ? "image/jpeg" : "image/webp";
    return new Promise((n, u) => {
      p.toBlob(
        (g) => {
          g ? n({
            blob: g,
            width: p.width,
            height: p.height,
            devicePixelRatio: window.devicePixelRatio
          }) : u(new Error("Failed to create screenshot blob"));
        },
        y,
        e
      );
    });
  } finally {
    l(), o();
  }
}
async function K(h = {}) {
  return Ee(h);
}
async function Ie(h, e) {
  return new Promise((t, r) => {
    const a = new Image(), s = URL.createObjectURL(h);
    a.onload = () => {
      URL.revokeObjectURL(s);
      const i = document.createElement("canvas");
      i.width = a.width, i.height = a.height;
      const l = i.getContext("2d");
      l.drawImage(a, 0, 0), e.forEach((o) => {
        switch (l.strokeStyle = o.color || "#ff0000", l.fillStyle = o.color || "#ff0000", l.lineWidth = 3, o.type) {
          case "rectangle":
            l.strokeRect(
              o.x,
              o.y,
              o.width || 100,
              o.height || 100
            );
            break;
          case "circle":
            l.beginPath(), l.arc(
              o.x + (o.width || 50) / 2,
              o.y + (o.height || 50) / 2,
              (o.width || 50) / 2,
              0,
              2 * Math.PI
            ), l.stroke();
            break;
          case "arrow":
            l.beginPath(), l.moveTo(o.x, o.y), l.lineTo(
              o.x + (o.width || 50),
              o.y + (o.height || 50)
            ), l.stroke();
            const c = Math.atan2(
              o.height || 0,
              o.width || 0
            ), p = 15;
            l.beginPath(), l.moveTo(
              o.x + (o.width || 50),
              o.y + (o.height || 50)
            ), l.lineTo(
              o.x + (o.width || 50) - p * Math.cos(c - Math.PI / 6),
              o.y + (o.height || 50) - p * Math.sin(c - Math.PI / 6)
            ), l.lineTo(
              o.x + (o.width || 50) - p * Math.cos(c + Math.PI / 6),
              o.y + (o.height || 50) - p * Math.sin(c + Math.PI / 6)
            ), l.closePath(), l.fill();
            break;
          case "highlight":
            l.fillStyle = (o.color || "#ffff00") + "40", l.fillRect(
              o.x,
              o.y,
              o.width || 100,
              o.height || 30
            );
            break;
          case "blur":
            l.fillStyle = "rgba(128, 128, 128, 0.5)", l.fillRect(
              o.x,
              o.y,
              o.width || 100,
              o.height || 100
            );
            break;
          case "text":
            l.font = "16px sans-serif", l.fillText(o.text || "", o.x, o.y);
            break;
        }
      }), i.toBlob((o) => {
        o ? t(o) : r(new Error("Failed to apply annotations"));
      }, "image/png");
    }, a.onerror = () => {
      URL.revokeObjectURL(s), r(new Error("Failed to load screenshot for annotation"));
    }, a.src = s;
  });
}
function d(h, e, t) {
  const r = document.createElement(h);
  if (e) {
    const { class: a, data: s, ...i } = e;
    if (a && (r.className = a), s)
      for (const [l, o] of Object.entries(s))
        r.dataset[l] = o;
    for (const [l, o] of Object.entries(i))
      l.startsWith("on") && typeof o == "function" ? r.addEventListener(l.slice(2).toLowerCase(), o) : o != null && (r[l] = o);
  }
  if (t)
    for (const a of t)
      typeof a == "string" ? r.appendChild(document.createTextNode(a)) : r.appendChild(a);
  return r;
}
function ne(h) {
  for (; h.firstChild; )
    h.removeChild(h.firstChild);
}
function le(h, e = 300) {
  return new Promise((t) => {
    let r = !1;
    const a = () => {
      r || (r = !0, h.removeEventListener("animationend", a), h.removeEventListener("transitionend", a), t());
    };
    h.addEventListener("animationend", a), h.addEventListener("transitionend", a), setTimeout(a, e);
  });
}
function ce(h, e) {
  for (const [t, r] of Object.entries(e))
    r !== void 0 && (h.style[t] = r);
}
function He(h, e) {
  const t = document.createElement("style");
  return t.id = e, t.textContent = h, t;
}
let Re = 0;
function A(h = "relay") {
  return `${h}-${++Re}-${Date.now().toString(36)}`;
}
function P(h) {
  const e = document.createElement("div");
  return e.textContent = h, e.innerHTML;
}
function ze(h) {
  const e = h instanceof Date ? h : new Date(h), r = Date.now() - e.getTime(), a = Math.floor(r / 1e3), s = Math.floor(a / 60), i = Math.floor(s / 60), l = Math.floor(i / 24);
  return a < 60 ? "just now" : s < 60 ? `${s}m ago` : i < 24 ? `${i}h ago` : l < 7 ? `${l}d ago` : e.toLocaleDateString();
}
const G = {
  "--relay-bg": "0 0% 100%",
  "--relay-bg-secondary": "240 5% 96%",
  "--relay-bg-tertiary": "240 5% 92%",
  "--relay-text": "240 10% 4%",
  "--relay-text-muted": "240 4% 46%",
  "--relay-text-subtle": "240 4% 65%",
  "--relay-border": "240 6% 90%",
  "--relay-border-hover": "240 5% 75%",
  "--relay-primary": "240 6% 10%",
  "--relay-primary-hover": "240 5% 20%",
  "--relay-primary-text": "0 0% 100%",
  "--relay-success": "142 71% 45%",
  "--relay-warning": "38 92% 50%",
  "--relay-error": "0 72% 51%",
  "--relay-shadow": "0 1px 2px rgba(0, 0, 0, 0.05)",
  "--relay-shadow-lg": "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)",
  "--relay-overlay": "rgba(0, 0, 0, 0.4)"
}, X = {
  "--relay-bg": "240 10% 4%",
  "--relay-bg-secondary": "240 6% 10%",
  "--relay-bg-tertiary": "240 4% 16%",
  "--relay-text": "0 0% 98%",
  "--relay-text-muted": "240 5% 65%",
  "--relay-text-subtle": "240 4% 46%",
  "--relay-border": "240 4% 16%",
  "--relay-border-hover": "240 5% 26%",
  "--relay-primary": "0 0% 98%",
  "--relay-primary-hover": "0 0% 85%",
  "--relay-primary-text": "240 10% 4%",
  "--relay-success": "142 71% 45%",
  "--relay-warning": "38 92% 50%",
  "--relay-error": "0 72% 51%",
  "--relay-shadow": "0 1px 2px rgba(0, 0, 0, 0.3)",
  "--relay-shadow-lg": "0 4px 6px -1px rgba(0, 0, 0, 0.4), 0 2px 4px -2px rgba(0, 0, 0, 0.3)",
  "--relay-overlay": "rgba(0, 0, 0, 0.6)"
};
function q() {
  if (typeof window > "u")
    return "light";
  const h = document.documentElement, e = document.body;
  if (h.classList.contains("dark") || e != null && e.classList.contains("dark") || h.classList.contains("dark-mode") || e != null && e.classList.contains("dark-mode") || h.classList.contains("theme-dark") || e != null && e.classList.contains("theme-dark"))
    return "dark";
  const t = h.getAttribute("data-theme") || h.getAttribute("data-mode"), r = (e == null ? void 0 : e.getAttribute("data-theme")) || (e == null ? void 0 : e.getAttribute("data-mode"));
  if (t === "dark" || r === "dark")
    return "dark";
  const a = getComputedStyle(h).colorScheme, s = e ? getComputedStyle(e).colorScheme : "";
  if (a === "dark" || s === "dark")
    return "dark";
  if (e) {
    const i = getComputedStyle(e).backgroundColor;
    if (i && Ae(i))
      return "dark";
  }
  return "light";
}
function Ae(h) {
  const e = h.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!e)
    return !1;
  const t = parseInt(e[1], 10), r = parseInt(e[2], 10), a = parseInt(e[3], 10);
  return (0.299 * t + 0.587 * r + 0.114 * a) / 255 < 0.5;
}
function Be(h) {
  return h === "auto" ? q() === "dark" ? X : G : h === "dark" ? X : G;
}
function Fe(h, e) {
  let t = "";
  for (const [r, a] of Object.entries(h))
    r.includes("shadow") || r.includes("overlay") ? t += `${r}: ${a};
` : t += `${r}: ${a};
`;
  if (e) {
    const r = De(e);
    if (r) {
      t += `--relay-primary: ${r};
`;
      const [a, s, i] = r.split(" ").map((c) => parseFloat(c.replace("%", ""))), l = i > 50 ? i - 10 : i + 10;
      t += `--relay-primary-hover: ${a} ${s}% ${l}%;
`;
      const o = i > 50 ? "0 0% 0%" : "0 0% 100%";
      t += `--relay-primary-text: ${o};
`;
    }
  }
  return t;
}
function De(h) {
  h = h.replace(/^#/, "");
  let e, t, r;
  if (h.length === 3)
    e = parseInt(h[0] + h[0], 16), t = parseInt(h[1] + h[1], 16), r = parseInt(h[2] + h[2], 16);
  else if (h.length === 6)
    e = parseInt(h.slice(0, 2), 16), t = parseInt(h.slice(2, 4), 16), r = parseInt(h.slice(4, 6), 16);
  else
    return null;
  e /= 255, t /= 255, r /= 255;
  const a = Math.max(e, t, r), s = Math.min(e, t, r);
  let i = 0, l = 0;
  const o = (a + s) / 2;
  if (a !== s) {
    const c = a - s;
    switch (l = o > 0.5 ? c / (2 - a - s) : c / (a + s), a) {
      case e:
        i = ((t - r) / c + (t < r ? 6 : 0)) / 6;
        break;
      case t:
        i = ((r - e) / c + 2) / 6;
        break;
      case r:
        i = ((e - t) / c + 4) / 6;
        break;
    }
  }
  return `${Math.round(i * 360)} ${Math.round(l * 100)}% ${Math.round(o * 100)}%`;
}
function $e(h) {
  if (typeof window > "u")
    return () => {
    };
  let e = q();
  const t = () => {
    const i = q();
    i !== e && (e = i, h(i));
  }, r = window.matchMedia("(prefers-color-scheme: dark)"), a = () => t();
  r.addEventListener("change", a);
  const s = new MutationObserver(t);
  return s.observe(document.documentElement, {
    attributes: !0,
    attributeFilter: ["class", "data-theme"]
  }), document.body && s.observe(document.body, {
    attributes: !0,
    attributeFilter: ["class", "data-theme"]
  }), () => {
    r.removeEventListener("change", a), s.disconnect();
  };
}
function Pe(h = "auto", e) {
  const t = Be(h);
  return `
    /* Theme Variables */
    #relay-widget,
    .relay-screenshot-editor {
      ${Fe(t, e)}
    }

    /* Reset */
    #relay-widget *,
    #relay-widget *::before,
    #relay-widget *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    #relay-widget,
    .relay-screenshot-editor {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
      font-size: 14px;
      line-height: 1.5;
      color: hsl(var(--relay-text));
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    .relay-screenshot-editor *,
    .relay-screenshot-editor *::before,
    .relay-screenshot-editor *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    /* Typography */
    #relay-widget h1,
    #relay-widget h2,
    #relay-widget h3,
    #relay-widget h4 {
      font-weight: 600;
      line-height: 1.25;
      color: hsl(var(--relay-text));
    }

    #relay-widget h1 { font-size: 24px; }
    #relay-widget h2 { font-size: 20px; }
    #relay-widget h3 { font-size: 16px; }
    #relay-widget h4 { font-size: 14px; }

    #relay-widget p {
      color: hsl(var(--relay-text-muted));
    }

    #relay-widget small {
      font-size: 12px;
      color: hsl(var(--relay-text-subtle));
    }

    /* Links */
    #relay-widget a {
      color: hsl(var(--relay-primary));
      text-decoration: none;
    }

    #relay-widget a:hover {
      text-decoration: underline;
    }

    /* Focus styles */
    #relay-widget *:focus-visible {
      outline: 2px solid hsl(var(--relay-primary));
      outline-offset: 2px;
    }

    /* Animations */
    @keyframes relay-fade-in {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes relay-slide-up {
      from {
        opacity: 0;
        transform: translateY(10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @keyframes relay-slide-down {
      from {
        opacity: 0;
        transform: translateY(-10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @keyframes relay-scale-in {
      from {
        opacity: 0;
        transform: scale(0.95);
      }
      to {
        opacity: 1;
        transform: scale(1);
      }
    }

    @keyframes relay-spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    /* Utility classes */
    #relay-widget .relay-sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }

    #relay-widget .relay-truncate {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    /* Scrollbar styling */
    #relay-widget ::-webkit-scrollbar {
      width: 6px;
      height: 6px;
    }

    #relay-widget ::-webkit-scrollbar-track {
      background: transparent;
    }

    #relay-widget ::-webkit-scrollbar-thumb {
      background: hsl(var(--relay-border));
      border-radius: 3px;
    }

    #relay-widget ::-webkit-scrollbar-thumb:hover {
      background: hsl(var(--relay-border-hover));
    }
  `;
}
function Ne() {
  return `
    /* Mobile-first responsive styles */
    @media (max-width: 480px) {
      #relay-widget .relay-modal {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        top: auto;
        width: 100%;
        max-height: 85vh;
        border-radius: 16px 16px 0 0;
        animation: relay-slide-up 0.3s ease-out;
      }

      #relay-widget .relay-modal.closing {
        animation: relay-slide-down 0.2s ease-in forwards;
      }

      #relay-widget .relay-trigger {
        bottom: 16px;
        right: 16px;
        width: 52px;
        height: 52px;
      }
    }

    /* Desktop styles */
    @media (min-width: 481px) {
      #relay-widget .relay-modal {
        width: 380px;
        max-height: 600px;
        border-radius: 16px;
        animation: relay-scale-in 0.2s ease-out;
      }

      #relay-widget .relay-modal.closing {
        animation: relay-fade-out 0.15s ease-in forwards;
      }

      @keyframes relay-fade-out {
        from { opacity: 1; transform: scale(1); }
        to { opacity: 0; transform: scale(0.95); }
      }
    }
  `;
}
const Ve = `
  #relay-widget .relay-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-family: inherit;
    font-weight: 600;
    border: none;
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.15s ease;
    white-space: nowrap;
    letter-spacing: -0.01em;
  }

  #relay-widget .relay-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  #relay-widget .relay-btn:active:not(:disabled) {
    transform: scale(0.98);
  }

  #relay-widget .relay-btn:focus-visible {
    outline: 2px solid hsl(var(--relay-primary));
    outline-offset: 2px;
  }

  /* Sizes */
  #relay-widget .relay-btn--sm {
    padding: 8px 14px;
    font-size: 13px;
    border-radius: 8px;
  }

  #relay-widget .relay-btn--md {
    padding: 10px 18px;
    font-size: 14px;
  }

  #relay-widget .relay-btn--lg {
    padding: 12px 24px;
    font-size: 15px;
    border-radius: 12px;
  }

  /* Variants */
  #relay-widget .relay-btn--primary {
    background: hsl(var(--relay-primary));
    color: hsl(var(--relay-primary-text));
    box-shadow: 0 1px 2px hsl(var(--relay-primary) / 0.2);
  }

  #relay-widget .relay-btn--primary:hover:not(:disabled) {
    background: hsl(var(--relay-primary-hover));
    box-shadow: 0 2px 4px hsl(var(--relay-primary) / 0.15);
  }

  #relay-widget .relay-btn--secondary {
    background: hsl(var(--relay-bg));
    color: hsl(var(--relay-text));
    border: 1px solid hsl(var(--relay-border));
  }

  #relay-widget .relay-btn--secondary:hover:not(:disabled) {
    background: hsl(var(--relay-bg-secondary));
    border-color: hsl(var(--relay-border-hover));
  }

  #relay-widget .relay-btn--ghost {
    background: transparent;
    color: hsl(var(--relay-text-muted));
  }

  #relay-widget .relay-btn--ghost:hover:not(:disabled) {
    background: hsl(var(--relay-bg-secondary));
    color: hsl(var(--relay-text));
  }

  #relay-widget .relay-btn--danger {
    background: hsl(var(--relay-error));
    color: white;
    box-shadow: 0 1px 2px hsl(var(--relay-error) / 0.2);
  }

  #relay-widget .relay-btn--danger:hover:not(:disabled) {
    filter: brightness(1.1);
  }

  /* Full width */
  #relay-widget .relay-btn--full {
    width: 100%;
  }

  /* Loading spinner */
  #relay-widget .relay-btn__spinner {
    width: 14px;
    height: 14px;
    border: 2px solid currentColor;
    border-top-color: transparent;
    border-radius: 50%;
    animation: relay-spin 0.6s linear infinite;
  }

  #relay-widget .relay-btn--sm .relay-btn__spinner {
    width: 12px;
    height: 12px;
  }

  #relay-widget .relay-btn--lg .relay-btn__spinner {
    width: 16px;
    height: 16px;
  }
`;
function O(h, e = {}) {
  const {
    variant: t = "primary",
    size: r = "md",
    disabled: a = !1,
    loading: s = !1,
    fullWidth: i = !1,
    type: l = "button",
    className: o = "",
    onClick: c
  } = e, p = [
    "relay-btn",
    `relay-btn--${t}`,
    `relay-btn--${r}`,
    i ? "relay-btn--full" : "",
    o
  ].filter(Boolean).join(" "), y = d("button", {
    type: l,
    class: p,
    disabled: a || s
  });
  return s && y.appendChild(d("span", { class: "relay-btn__spinner" })), typeof h == "string" ? y.appendChild(document.createTextNode(h)) : y.appendChild(h), c && y.addEventListener("click", c), y;
}
function F(h, e, t) {
  const r = h.dataset.originalText || h.textContent || "";
  e ? (h.dataset.originalText = r, h.disabled = !0, h.innerHTML = "", h.appendChild(d("span", { class: "relay-btn__spinner" })), h.appendChild(document.createTextNode(t || "Loading..."))) : (h.disabled = !1, h.innerHTML = "", h.appendChild(
    document.createTextNode(h.dataset.originalText || r)
  ), delete h.dataset.originalText);
}
const Oe = `
  #relay-widget .relay-input-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  #relay-widget .relay-input-label {
    font-size: 13px;
    font-weight: 500;
    color: hsl(var(--relay-text));
    letter-spacing: 0.01em;
  }

  #relay-widget .relay-input-label--required::after {
    content: ' *';
    color: hsl(var(--relay-error));
  }

  #relay-widget .relay-input {
    width: 100%;
    padding: 10px 14px;
    font-family: inherit;
    font-size: 14px;
    line-height: 1.5;
    color: hsl(var(--relay-text));
    background: hsl(var(--relay-bg-secondary));
    border: 1px solid hsl(var(--relay-border));
    border-radius: 10px;
    transition: border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
  }

  #relay-widget .relay-input::placeholder {
    color: hsl(var(--relay-text-subtle));
  }

  #relay-widget .relay-input:hover:not(:focus):not(:disabled) {
    border-color: hsl(var(--relay-border-hover));
    background: hsl(var(--relay-bg));
  }

  #relay-widget .relay-input:focus {
    outline: none;
    border-color: hsl(var(--relay-primary));
    box-shadow: 0 0 0 3px hsl(var(--relay-primary) / 0.08);
  }

  #relay-widget .relay-input:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    background: hsl(var(--relay-bg-secondary));
  }

  #relay-widget .relay-input--error {
    border-color: hsl(var(--relay-error));
  }

  #relay-widget .relay-input--error:focus {
    box-shadow: 0 0 0 3px hsl(var(--relay-error) / 0.1);
  }

  #relay-widget .relay-input-error {
    font-size: 12px;
    color: hsl(var(--relay-error));
  }

  #relay-widget .relay-input-hint {
    font-size: 12px;
    color: hsl(var(--relay-text-muted));
  }
`;
function de(h, e = {}) {
  const {
    type: t = "text",
    name: r,
    placeholder: a,
    value: s = "",
    required: i = !1,
    disabled: l = !1,
    maxLength: o,
    pattern: c,
    autoFocus: p = !1,
    className: y = "",
    onChange: n,
    onBlur: u
  } = e, g = A("input"), f = d("div", {
    class: `relay-input-group ${y}`.trim()
  }), x = d(
    "label",
    {
      class: `relay-input-label ${i ? "relay-input-label--required" : ""}`,
      htmlFor: g
    },
    [h]
  ), m = d("input", {
    id: g,
    type: t,
    name: r || g,
    class: "relay-input",
    placeholder: a,
    value: s,
    required: i,
    disabled: l,
    maxLength: o,
    pattern: c,
    autofocus: p
  }), v = d("span", { class: "relay-input-error" });
  return v.style.display = "none", f.appendChild(x), f.appendChild(m), f.appendChild(v), n && m.addEventListener("input", () => n(m.value)), u && m.addEventListener("blur", () => u(m.value)), {
    container: f,
    input: m,
    setError: (_) => {
      _ ? (v.textContent = _, v.style.display = "block", m.classList.add("relay-input--error")) : (v.textContent = "", v.style.display = "none", m.classList.remove("relay-input--error"));
    },
    setValue: (_) => {
      m.value = _;
    },
    getValue: () => m.value
  };
}
const je = `
  #relay-widget .relay-textarea-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  #relay-widget .relay-textarea-label {
    font-size: 13px;
    font-weight: 500;
    color: hsl(var(--relay-text));
    letter-spacing: 0.01em;
  }

  #relay-widget .relay-textarea-label--required::after {
    content: ' *';
    color: hsl(var(--relay-error));
  }

  #relay-widget .relay-textarea {
    width: 100%;
    padding: 10px 14px;
    font-family: inherit;
    font-size: 14px;
    line-height: 1.5;
    color: hsl(var(--relay-text));
    background: hsl(var(--relay-bg-secondary));
    border: 1px solid hsl(var(--relay-border));
    border-radius: 10px;
    resize: vertical;
    min-height: 100px;
    transition: border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
  }

  #relay-widget .relay-textarea::placeholder {
    color: hsl(var(--relay-text-subtle));
  }

  #relay-widget .relay-textarea:hover:not(:focus):not(:disabled) {
    border-color: hsl(var(--relay-border-hover));
    background: hsl(var(--relay-bg));
  }

  #relay-widget .relay-textarea:focus {
    outline: none;
    border-color: hsl(var(--relay-primary));
    box-shadow: 0 0 0 3px hsl(var(--relay-primary) / 0.08);
  }

  #relay-widget .relay-textarea:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    background: hsl(var(--relay-bg-secondary));
  }

  #relay-widget .relay-textarea--error {
    border-color: hsl(var(--relay-error));
  }

  #relay-widget .relay-textarea--error:focus {
    box-shadow: 0 0 0 3px hsl(var(--relay-error) / 0.1);
  }

  #relay-widget .relay-textarea--auto-resize {
    resize: none;
    overflow: hidden;
  }

  #relay-widget .relay-textarea-error {
    font-size: 12px;
    color: hsl(var(--relay-error));
  }

  #relay-widget .relay-textarea-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: -4px;
  }

  #relay-widget .relay-textarea-counter {
    font-size: 11px;
    color: hsl(var(--relay-text-subtle));
    margin-left: auto;
  }

  #relay-widget .relay-textarea-counter--warning {
    color: hsl(var(--relay-warning));
  }

  #relay-widget .relay-textarea-counter--error {
    color: hsl(var(--relay-error));
  }
`;
function he(h, e = {}) {
  const {
    name: t,
    placeholder: r,
    value: a = "",
    required: s = !1,
    disabled: i = !1,
    maxLength: l,
    rows: o = 4,
    autoResize: c = !1,
    autoFocus: p = !1,
    className: y = "",
    onChange: n,
    onBlur: u
  } = e, g = A("textarea"), f = d("div", {
    class: `relay-textarea-group ${y}`.trim()
  }), x = d(
    "label",
    {
      class: `relay-textarea-label ${s ? "relay-textarea-label--required" : ""}`,
      htmlFor: g
    },
    [h]
  ), m = d("textarea", {
    id: g,
    name: t || g,
    class: `relay-textarea ${c ? "relay-textarea--auto-resize" : ""}`,
    placeholder: r,
    required: s,
    disabled: i,
    rows: o,
    autofocus: p
  });
  m.value = a, l && (m.maxLength = l);
  const v = d("div", { class: "relay-textarea-footer" }), _ = d("span", { class: "relay-textarea-error" });
  _.style.display = "none";
  let b = null;
  l && (b = d("span", { class: "relay-textarea-counter" }), b.textContent = `${a.length}/${l}`), v.appendChild(_), b && v.appendChild(b), f.appendChild(x), f.appendChild(m), f.appendChild(v);
  const S = () => {
    c && (m.style.height = "auto", m.style.height = `${m.scrollHeight}px`);
  }, T = () => {
    if (b && l) {
      const k = l - m.value.length;
      b.textContent = `${m.value.length}/${l}`, b.classList.remove(
        "relay-textarea-counter--warning",
        "relay-textarea-counter--error"
      ), k <= 0 ? b.classList.add("relay-textarea-counter--error") : k <= l * 0.1 && b.classList.add("relay-textarea-counter--warning");
    }
  };
  return m.addEventListener("input", () => {
    S(), T(), n && n(m.value);
  }), u && m.addEventListener("blur", () => u(m.value)), S(), T(), {
    container: f,
    textarea: m,
    setError: (k) => {
      k ? (_.textContent = k, _.style.display = "block", m.classList.add("relay-textarea--error")) : (_.textContent = "", _.style.display = "none", m.classList.remove("relay-textarea--error"));
    },
    setValue: (k) => {
      m.value = k, S(), T();
    },
    getValue: () => m.value
  };
}
const qe = `
  #relay-widget .relay-select-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  #relay-widget .relay-select-label {
    font-size: 13px;
    font-weight: 500;
    color: hsl(var(--relay-text));
    letter-spacing: 0.01em;
  }

  #relay-widget .relay-select-label--required::after {
    content: ' *';
    color: hsl(var(--relay-error));
  }

  #relay-widget .relay-select-wrapper {
    position: relative;
  }

  #relay-widget .relay-select {
    width: 100%;
    padding: 10px 36px 10px 14px;
    font-family: inherit;
    font-size: 14px;
    line-height: 1.5;
    color: hsl(var(--relay-text));
    background: hsl(var(--relay-bg-secondary));
    border: 1px solid hsl(var(--relay-border));
    border-radius: 10px;
    cursor: pointer;
    appearance: none;
    transition: border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
  }

  #relay-widget .relay-select:hover:not(:focus):not(:disabled) {
    border-color: hsl(var(--relay-border-hover));
    background: hsl(var(--relay-bg));
  }

  #relay-widget .relay-select:focus {
    outline: none;
    border-color: hsl(var(--relay-primary));
    box-shadow: 0 0 0 3px hsl(var(--relay-primary) / 0.08);
  }

  #relay-widget .relay-select:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    background: hsl(var(--relay-bg-secondary));
  }

  #relay-widget .relay-select--error {
    border-color: hsl(var(--relay-error));
  }

  #relay-widget .relay-select--error:focus {
    box-shadow: 0 0 0 3px hsl(var(--relay-error) / 0.1);
  }

  #relay-widget .relay-select-icon {
    position: absolute;
    right: 14px;
    top: 50%;
    transform: translateY(-50%);
    pointer-events: none;
    color: hsl(var(--relay-text-muted));
  }

  #relay-widget .relay-select-icon svg {
    display: block;
  }

  #relay-widget .relay-select-error {
    font-size: 12px;
    color: hsl(var(--relay-error));
  }
`;
function pe(h, e) {
  const {
    name: t,
    placeholder: r,
    value: a = "",
    options: s,
    required: i = !1,
    disabled: l = !1,
    className: o = "",
    onChange: c
  } = e, p = A("select"), y = d("div", {
    class: `relay-select-group ${o}`.trim()
  }), n = d(
    "label",
    {
      class: `relay-select-label ${i ? "relay-select-label--required" : ""}`,
      htmlFor: p
    },
    [h]
  ), u = d("div", { class: "relay-select-wrapper" }), g = d("select", {
    id: p,
    name: t || p,
    class: "relay-select",
    required: i,
    disabled: l
  });
  if (r) {
    const v = d(
      "option",
      {
        value: "",
        disabled: !0,
        selected: !a
      },
      [r]
    );
    g.appendChild(v);
  }
  const f = (v) => {
    v.forEach((_) => {
      const b = d(
        "option",
        {
          value: _.value,
          disabled: _.disabled,
          selected: _.value === a
        },
        [_.label]
      );
      g.appendChild(b);
    });
  };
  f(s);
  const x = d("span", { class: "relay-select-icon" });
  x.innerHTML = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 4.5L6 7.5L9 4.5"/></svg>';
  const m = d("span", { class: "relay-select-error" });
  return m.style.display = "none", u.appendChild(g), u.appendChild(x), y.appendChild(n), y.appendChild(u), y.appendChild(m), c && g.addEventListener("change", () => c(g.value)), {
    container: y,
    select: g,
    setError: (v) => {
      v ? (m.textContent = v, m.style.display = "block", g.classList.add("relay-select--error")) : (m.textContent = "", m.style.display = "none", g.classList.remove("relay-select--error"));
    },
    setValue: (v) => {
      g.value = v;
    },
    getValue: () => g.value,
    setOptions: (v) => {
      const _ = g.value;
      if (g.innerHTML = "", r) {
        const b = d(
          "option",
          {
            value: "",
            disabled: !0
          },
          [r]
        );
        g.appendChild(b);
      }
      f(v), v.some((b) => b.value === _) && (g.value = _);
    }
  };
}
const Ue = `
  #relay-widget .relay-checkbox {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    cursor: pointer;
    user-select: none;
  }

  #relay-widget .relay-checkbox--disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  #relay-widget .relay-checkbox__input {
    position: absolute;
    opacity: 0;
    width: 0;
    height: 0;
  }

  #relay-widget .relay-checkbox__box {
    flex-shrink: 0;
    width: 18px;
    height: 18px;
    margin-top: 1px;
    border: 1.5px solid hsl(var(--relay-border-hover));
    border-radius: 5px;
    background: hsl(var(--relay-bg));
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }

  #relay-widget .relay-checkbox:hover .relay-checkbox__box {
    border-color: hsl(var(--relay-text-muted));
  }

  #relay-widget .relay-checkbox__input:focus-visible + .relay-checkbox__box {
    outline: 2px solid hsl(var(--relay-primary));
    outline-offset: 2px;
  }

  #relay-widget .relay-checkbox__input:checked + .relay-checkbox__box {
    background: hsl(var(--relay-primary));
    border-color: hsl(var(--relay-primary));
  }

  #relay-widget .relay-checkbox__icon {
    width: 12px;
    height: 12px;
    color: hsl(var(--relay-primary-text));
    opacity: 0;
    transform: scale(0.5);
    transition: all 0.15s ease;
  }

  #relay-widget .relay-checkbox__icon svg {
    width: 100%;
    height: 100%;
  }

  #relay-widget .relay-checkbox__input:checked + .relay-checkbox__box .relay-checkbox__icon {
    opacity: 1;
    transform: scale(1);
  }

  #relay-widget .relay-checkbox__content {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  #relay-widget .relay-checkbox__label {
    font-size: 13px;
    font-weight: 500;
    color: hsl(var(--relay-text));
    line-height: 1.4;
  }

  #relay-widget .relay-checkbox__description {
    font-size: 12px;
    color: hsl(var(--relay-text-muted));
    line-height: 1.4;
  }
`;
function Z(h, e = {}, t) {
  const {
    name: r,
    checked: a = !1,
    disabled: s = !1,
    className: i = "",
    onChange: l
  } = e, o = A("checkbox"), c = d("label", {
    class: `relay-checkbox ${s ? "relay-checkbox--disabled" : ""} ${i}`.trim(),
    htmlFor: o
  }), p = d("input", {
    type: "checkbox",
    id: o,
    name: r || o,
    class: "relay-checkbox__input",
    checked: a,
    disabled: s
  }), y = d("span", { class: "relay-checkbox__box" }), n = d("span", { class: "relay-checkbox__icon" });
  n.innerHTML = '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 6l3 3 5-6"/></svg>', y.appendChild(n);
  const u = d("div", {
    class: "relay-checkbox__content"
  }), g = d("span", { class: "relay-checkbox__label" }, [
    h
  ]);
  if (u.appendChild(g), t) {
    const f = d(
      "span",
      { class: "relay-checkbox__description" },
      [t]
    );
    u.appendChild(f);
  }
  return c.appendChild(p), c.appendChild(y), c.appendChild(u), l && p.addEventListener("change", () => l(p.checked)), {
    container: c,
    input: p,
    setChecked: (f) => {
      p.checked = f;
    },
    isChecked: () => p.checked
  };
}
const We = `
  .relay-file-upload {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .relay-file-upload__label {
    font-size: 14px;
    font-weight: 500;
    color: hsl(var(--relay-text));
  }

  .relay-file-upload__dropzone {
    position: relative;
    padding: 24px;
    border: 2px dashed hsl(var(--relay-border));
    border-radius: 8px;
    background: hsl(var(--relay-bg-secondary));
    text-align: center;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .relay-file-upload__dropzone:hover {
    border-color: hsl(var(--relay-border-hover));
    background: hsl(var(--relay-bg-tertiary));
  }

  .relay-file-upload__dropzone--active {
    border-color: hsl(var(--relay-primary));
    background: hsla(var(--relay-primary), 0.05);
  }

  .relay-file-upload__dropzone--disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .relay-file-upload__input {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
  }

  .relay-file-upload__input:disabled {
    cursor: not-allowed;
  }

  .relay-file-upload__icon {
    width: 32px;
    height: 32px;
    margin: 0 auto 8px;
    color: hsl(var(--relay-text-muted));
  }

  .relay-file-upload__text {
    font-size: 14px;
    color: hsl(var(--relay-text));
    margin-bottom: 4px;
  }

  .relay-file-upload__hint {
    font-size: 12px;
    color: hsl(var(--relay-text-muted));
  }

  .relay-file-upload__browse {
    color: hsl(var(--relay-primary));
    text-decoration: underline;
  }

  .relay-file-upload__files {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .relay-file-upload__file {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    background: hsl(var(--relay-bg-secondary));
    border: 1px solid hsl(var(--relay-border));
    border-radius: 6px;
  }

  .relay-file-upload__file-icon {
    width: 20px;
    height: 20px;
    color: hsl(var(--relay-text-muted));
  }

  .relay-file-upload__file-info {
    flex: 1;
    min-width: 0;
  }

  .relay-file-upload__file-name {
    font-size: 13px;
    color: hsl(var(--relay-text));
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .relay-file-upload__file-size {
    font-size: 11px;
    color: hsl(var(--relay-text-muted));
  }

  .relay-file-upload__file-remove {
    flex-shrink: 0;
    width: 24px;
    height: 24px;
    padding: 0;
    background: none;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    color: hsl(var(--relay-text-muted));
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }

  .relay-file-upload__file-remove:hover {
    background: hsl(var(--relay-bg-tertiary));
    color: hsl(var(--relay-error));
  }

  .relay-file-upload__error {
    font-size: 12px;
    color: hsl(var(--relay-error));
  }
`;
function ue(h, e = {}) {
  const {
    accept: t,
    multiple: r = !0,
    maxSize: a = 10 * 1024 * 1024,
    // 10MB default
    maxFiles: s = 5,
    disabled: i = !1,
    className: l = "",
    onFilesChange: o
  } = e, c = A("file-upload");
  let p = [];
  const y = d("div", {
    class: `relay-file-upload ${l}`.trim()
  }), n = d(
    "label",
    { class: "relay-file-upload__label" },
    [h]
  ), u = d("div", {
    class: `relay-file-upload__dropzone ${i ? "relay-file-upload__dropzone--disabled" : ""}`
  }), g = d("input", {
    type: "file",
    id: c,
    class: "relay-file-upload__input",
    accept: t,
    multiple: r,
    disabled: i
  }), f = d("div", { class: "relay-file-upload__icon" });
  f.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>';
  const x = d("div", { class: "relay-file-upload__text" }, [
    "Drop files here or "
  ]), m = d(
    "span",
    { class: "relay-file-upload__browse" },
    ["browse"]
  );
  x.appendChild(m);
  const v = d("div", { class: "relay-file-upload__hint" });
  v.textContent = `Max ${j(a)} per file${r ? `, up to ${s} files` : ""}`, u.appendChild(g), u.appendChild(f), u.appendChild(x), u.appendChild(v);
  const _ = d("div", { class: "relay-file-upload__files" }), b = d("div", { class: "relay-file-upload__error" });
  b.style.display = "none", y.appendChild(n), y.appendChild(u), y.appendChild(_), y.appendChild(b);
  const S = () => {
    _.innerHTML = "", p.forEach((k, C) => {
      const M = d("div", {
        class: "relay-file-upload__file"
      }), w = d("span", {
        class: "relay-file-upload__file-icon"
      });
      w.innerHTML = Ye(k.type);
      const L = d("div", {
        class: "relay-file-upload__file-info"
      }), H = d(
        "div",
        { class: "relay-file-upload__file-name" },
        [P(k.name)]
      ), E = d(
        "div",
        { class: "relay-file-upload__file-size" },
        [j(k.size)]
      );
      L.appendChild(H), L.appendChild(E);
      const I = d("button", {
        type: "button",
        class: "relay-file-upload__file-remove"
      });
      I.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>', I.addEventListener("click", () => {
        p = p.filter((R, z) => z !== C), S(), o == null || o(p);
      }), M.appendChild(w), M.appendChild(L), M.appendChild(I), _.appendChild(M);
    });
  }, T = (k) => {
    if (!k)
      return;
    const C = [];
    let M = null;
    Array.from(k).forEach((w) => {
      if (p.length + C.length >= s) {
        M = `Maximum ${s} files allowed`;
        return;
      }
      if (w.size > a) {
        M = `File "${w.name}" exceeds maximum size of ${j(a)}`;
        return;
      }
      C.push(w);
    }), C.length > 0 && (p = r ? [...p, ...C] : C, S(), o == null || o(p)), M ? (b.textContent = M, b.style.display = "block") : b.style.display = "none", g.value = "";
  };
  return g.addEventListener("change", () => T(g.files)), u.addEventListener("dragover", (k) => {
    k.preventDefault(), i || u.classList.add("relay-file-upload__dropzone--active");
  }), u.addEventListener("dragleave", () => {
    u.classList.remove("relay-file-upload__dropzone--active");
  }), u.addEventListener("drop", (k) => {
    var C;
    k.preventDefault(), u.classList.remove("relay-file-upload__dropzone--active"), i || T(((C = k.dataTransfer) == null ? void 0 : C.files) ?? null);
  }), {
    container: y,
    getFiles: () => [...p],
    setFiles: (k) => {
      p = k.slice(0, s), S();
    },
    clearFiles: () => {
      p = [], S(), o == null || o(p);
    },
    setError: (k) => {
      k ? (b.textContent = k, b.style.display = "block") : b.style.display = "none";
    }
  };
}
function j(h) {
  return h < 1024 ? `${h} B` : h < 1024 * 1024 ? `${(h / 1024).toFixed(1)} KB` : `${(h / (1024 * 1024)).toFixed(1)} MB`;
}
function Ye(h) {
  return h.startsWith("image/") ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>' : h.startsWith("video/") ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><path d="M7 2v20M17 2v20M2 12h20M2 7h5M2 17h5M17 17h5M17 7h5"/></svg>' : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>';
}
const Ke = `
  ${Ve}
  ${Oe}
  ${je}
  ${qe}
  ${Ue}
  ${We}
`, Ge = `
  .relay-bug-form {
    display: flex;
    flex-direction: column;
    gap: 20px;
    padding: 20px;
  }

  .relay-bug-form__row {
    display: flex;
    gap: 12px;
  }

  .relay-bug-form__row > * {
    flex: 1;
  }

  .relay-bug-form__screenshot {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .relay-bug-form__screenshot-label {
    font-size: 13px;
    font-weight: 500;
    color: hsl(var(--relay-text));
    letter-spacing: 0.01em;
  }

  .relay-bug-form__screenshot-preview {
    position: relative;
    width: 100%;
    max-height: 200px;
    background: hsl(var(--relay-bg-tertiary));
    border: 1px solid hsl(var(--relay-border));
    border-radius: 12px;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .relay-bug-form__screenshot-preview img {
    max-width: 100%;
    max-height: 200px;
    object-fit: contain;
  }

  .relay-bug-form__screenshot-actions {
    position: absolute;
    bottom: 10px;
    right: 10px;
    display: flex;
    gap: 6px;
    z-index: 1;
  }

  .relay-bug-form__screenshot-btn {
    padding: 6px 12px;
    font-family: inherit;
    font-size: 12px;
    font-weight: 500;
    background: hsl(var(--relay-bg));
    color: hsl(var(--relay-text));
    border: 1px solid hsl(var(--relay-border));
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.15s ease;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  }

  .relay-bug-form__screenshot-btn:hover {
    background: hsl(var(--relay-bg-secondary));
    border-color: hsl(var(--relay-border-hover));
  }

  .relay-bug-form__screenshot-btn:active {
    transform: scale(0.98);
  }

  .relay-bug-form__screenshot-btn--danger {
    color: hsl(var(--relay-error));
  }

  .relay-bug-form__screenshot-btn--danger:hover {
    background: hsl(var(--relay-error) / 0.08);
    border-color: hsl(var(--relay-error) / 0.3);
  }

  .relay-bug-form__options {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 14px 16px;
    background: hsl(var(--relay-bg-secondary));
    border: 1px solid hsl(var(--relay-border));
    border-radius: 12px;
  }

  .relay-bug-form__footer {
    padding-top: 4px;
  }

  .relay-bug-form__success {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 48px 24px;
    text-align: center;
  }

  .relay-bug-form__success-icon {
    width: 56px;
    height: 56px;
    margin-bottom: 16px;
    color: hsl(var(--relay-success));
    background: hsl(var(--relay-success) / 0.1);
    border-radius: 50%;
    padding: 12px;
  }

  .relay-bug-form__success-icon svg {
    width: 100%;
    height: 100%;
  }

  .relay-bug-form__success h4 {
    font-size: 18px;
    font-weight: 600;
    color: hsl(var(--relay-text));
    margin: 0 0 6px;
    letter-spacing: -0.01em;
  }

  .relay-bug-form__success p {
    font-size: 14px;
    color: hsl(var(--relay-text-muted));
    margin: 0;
  }
`, Xe = [
  { value: "low", label: "Low - Minor issue" },
  { value: "med", label: "Medium - Affects workflow" },
  { value: "high", label: "High - Major impact" },
  { value: "critical", label: "Critical - Blocking" }
];
function Ze(h) {
  const {
    showSeverity: e = !0,
    showScreenshot: t = !0,
    showLogs: r = !0,
    showAttachments: a = !0,
    defaultSeverity: s = "med",
    maxAttachments: i = 5,
    maxAttachmentSize: l = 10 * 1024 * 1024,
    onSubmit: o,
    onScreenshotEdit: c,
    onFormChange: p
  } = h;
  let y = null;
  const n = d("form", {
    class: "relay-bug-form"
  }), u = de("Title", {
    name: "title",
    placeholder: "Brief summary of the issue",
    required: !0,
    autoFocus: !0,
    onChange: p
  }), g = he("Description", {
    name: "description",
    placeholder: "Describe what happened and how to reproduce it...",
    required: !0,
    rows: 4,
    maxLength: 2e3,
    onChange: p
  });
  let f = null;
  e && (f = pe("Severity", {
    name: "severity",
    options: Xe,
    value: s
  }));
  let x = null, m = null, v = null;
  if (t) {
    x = d("div", {
      class: "relay-bug-form__screenshot"
    }), x.style.display = "none";
    const E = d(
      "span",
      { class: "relay-bug-form__screenshot-label" },
      ["Screenshot"]
    );
    m = d("div", {
      class: "relay-bug-form__screenshot-preview"
    }), v = d("img", {
      alt: "Screenshot preview"
    }), m.appendChild(v);
    const I = d("div", {
      class: "relay-bug-form__screenshot-actions"
    });
    if (c) {
      const z = d(
        "button",
        {
          type: "button",
          class: "relay-bug-form__screenshot-btn"
        },
        ["Edit"]
      );
      z.addEventListener("click", () => c()), I.appendChild(z);
    }
    const R = d(
      "button",
      {
        type: "button",
        class: "relay-bug-form__screenshot-btn relay-bug-form__screenshot-btn--danger"
      },
      ["Remove"]
    );
    R.addEventListener("click", () => {
      M(null);
    }), I.appendChild(R), m.appendChild(I), x.appendChild(E), x.appendChild(m);
  }
  const _ = d("div", {
    class: "relay-bug-form__options"
  });
  let b = null;
  t && (b = Z("Include screenshot", {
    checked: !0
  }), _.appendChild(b.container));
  let S = null;
  r && (S = Z(
    "Include console logs",
    { checked: !0 },
    "Helps us debug the issue"
  ), _.appendChild(S.container));
  let T = null;
  a && (T = ue("Attachments", {
    multiple: !0,
    maxFiles: i,
    maxSize: l,
    accept: "image/*,video/*,.pdf,.log,.txt"
  }));
  const k = O("Submit Bug Report", {
    type: "submit",
    variant: "primary",
    fullWidth: !0
  }), C = d("div", { class: "relay-bug-form__footer" });
  C.appendChild(k), n.appendChild(u.container), n.appendChild(g.container), f && n.appendChild(f.container), x && n.appendChild(x), n.appendChild(_), T && n.appendChild(T.container), n.appendChild(C), n.addEventListener("submit", async (E) => {
    if (E.preventDefault(), !u.getValue().trim()) {
      u.setError("Title is required");
      return;
    }
    if (!g.getValue().trim()) {
      g.setError("Description is required");
      return;
    }
    u.setError(null), g.setError(null);
    const I = {
      title: u.getValue().trim(),
      description: g.getValue().trim(),
      severity: (f == null ? void 0 : f.getValue()) || "med",
      includeScreenshot: (b == null ? void 0 : b.isChecked()) ?? !1,
      includeLogs: (S == null ? void 0 : S.isChecked()) ?? !1,
      attachments: (T == null ? void 0 : T.getFiles()) || []
    };
    F(k, !0, "Submitting...");
    try {
      await o(I);
    } catch (R) {
      F(k, !1), console.error("[Relay] Bug report submission failed:", R);
    }
  });
  const M = (E) => {
    if (y = E, x && v)
      if (E) {
        const I = URL.createObjectURL(E);
        v.onload = () => URL.revokeObjectURL(I), v.src = I, x.style.display = "flex";
      } else
        v.src = "", x.style.display = "none";
  };
  return {
    element: n,
    setScreenshotPreview: M,
    getScreenshotBlob: () => y,
    reset: () => {
      n.reset(), u.setValue(""), u.setError(null), g.setValue(""), g.setError(null), f && f.setValue(s), b && b.setChecked(!0), S && S.setChecked(!0), T && T.clearFiles(), M(null), F(k, !1);
    },
    showSuccess: () => {
      ne(n), n.className = "";
      const E = d("div", {
        class: "relay-bug-form__success"
      }), I = d("div", {
        class: "relay-bug-form__success-icon"
      });
      I.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>';
      const R = d("h4", {}, ["Thank you!"]), z = d("p", {}, [
        "Your bug report has been submitted."
      ]);
      E.appendChild(I), E.appendChild(R), E.appendChild(z), n.appendChild(E);
    },
    setPrefillData: (E) => {
      E.title && u.setValue(E.title), E.description && g.setValue(E.description);
    }
  };
}
const Je = `
  .relay-feedback-form {
    display: flex;
    flex-direction: column;
    gap: 20px;
    padding: 20px;
  }

  .relay-feedback-form__rating {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .relay-feedback-form__rating-label {
    font-size: 13px;
    font-weight: 500;
    color: hsl(var(--relay-text));
    letter-spacing: 0.01em;
  }

  .relay-feedback-form__rating-stars {
    display: flex;
    gap: 6px;
  }

  .relay-feedback-form__star {
    width: 36px;
    height: 36px;
    padding: 4px;
    background: none;
    border: none;
    cursor: pointer;
    color: hsl(var(--relay-border-hover));
    transition: all 0.15s ease;
    border-radius: 6px;
  }

  .relay-feedback-form__star:hover {
    transform: scale(1.1);
    background: hsl(var(--relay-bg-secondary));
  }

  .relay-feedback-form__star:active {
    transform: scale(0.95);
  }

  .relay-feedback-form__star--active {
    color: #f59e0b;
  }

  .relay-feedback-form__star svg {
    width: 100%;
    height: 100%;
  }

  .relay-feedback-form__footer {
    padding-top: 4px;
  }

  .relay-feedback-form__success {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 48px 24px;
    text-align: center;
  }

  .relay-feedback-form__success-icon {
    width: 56px;
    height: 56px;
    margin-bottom: 16px;
    color: hsl(var(--relay-success));
    background: hsl(var(--relay-success) / 0.1);
    border-radius: 50%;
    padding: 12px;
  }

  .relay-feedback-form__success-icon svg {
    width: 100%;
    height: 100%;
  }

  .relay-feedback-form__success h4 {
    font-size: 18px;
    font-weight: 600;
    color: hsl(var(--relay-text));
    margin: 0 0 6px;
    letter-spacing: -0.01em;
  }

  .relay-feedback-form__success p {
    font-size: 14px;
    color: hsl(var(--relay-text-muted));
    margin: 0;
  }
`, Qe = `
  .relay-feature-form {
    display: flex;
    flex-direction: column;
    gap: 20px;
    padding: 20px;
  }

  .relay-feature-form__footer {
    padding-top: 4px;
  }

  .relay-feature-form__success {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 48px 24px;
    text-align: center;
  }

  .relay-feature-form__success-icon {
    width: 56px;
    height: 56px;
    margin-bottom: 16px;
    color: hsl(var(--relay-success));
    background: hsl(var(--relay-success) / 0.1);
    border-radius: 50%;
    padding: 12px;
  }

  .relay-feature-form__success-icon svg {
    width: 100%;
    height: 100%;
  }

  .relay-feature-form__success h4 {
    font-size: 18px;
    font-weight: 600;
    color: hsl(var(--relay-text));
    margin: 0 0 6px;
    letter-spacing: -0.01em;
  }

  .relay-feature-form__success p {
    font-size: 14px;
    color: hsl(var(--relay-text-muted));
    margin: 0;
  }
`, et = [
  { value: "feature", label: "New Feature" },
  { value: "enhancement", label: "Enhancement" },
  { value: "integration", label: "Integration" }
];
function tt(h) {
  const {
    showAttachments: e = !0,
    maxAttachments: t = 5,
    maxAttachmentSize: r = 10 * 1024 * 1024,
    onSubmit: a,
    onFormChange: s
  } = h, i = d("form", {
    class: "relay-feature-form"
  }), l = de("Title", {
    name: "title",
    placeholder: "What feature would you like?",
    required: !0,
    autoFocus: !0,
    onChange: s
  }), o = he("Description", {
    name: "description",
    placeholder: "Describe your idea in detail. What problem does it solve?",
    required: !0,
    rows: 5,
    maxLength: 2e3,
    onChange: s
  }), c = pe("Category", {
    name: "category",
    options: et,
    value: "feature"
  });
  let p = null;
  e && (p = ue("Attachments (optional)", {
    multiple: !0,
    maxFiles: t,
    maxSize: r,
    accept: "image/*,.pdf,.doc,.docx"
  }));
  const y = O("Submit Request", {
    type: "submit",
    variant: "primary",
    fullWidth: !0
  }), n = d("div", { class: "relay-feature-form__footer" });
  return n.appendChild(y), i.appendChild(l.container), i.appendChild(o.container), i.appendChild(c.container), p && i.appendChild(p.container), i.appendChild(n), i.addEventListener("submit", async (x) => {
    if (x.preventDefault(), !l.getValue().trim()) {
      l.setError("Title is required");
      return;
    }
    if (!o.getValue().trim()) {
      o.setError("Description is required");
      return;
    }
    l.setError(null), o.setError(null);
    const m = {
      title: l.getValue().trim(),
      description: o.getValue().trim(),
      category: c.getValue() || "feature",
      attachments: (p == null ? void 0 : p.getFiles()) || []
    };
    F(y, !0, "Submitting...");
    try {
      await a(m);
    } catch (v) {
      F(y, !1), console.error("[Relay] Feature request submission failed:", v);
    }
  }), {
    element: i,
    reset: () => {
      i.reset(), l.setValue(""), l.setError(null), o.setValue(""), o.setError(null), c.setValue("feature"), p && p.clearFiles(), F(y, !1);
    },
    showSuccess: () => {
      ne(i), i.className = "";
      const x = d("div", {
        class: "relay-feature-form__success"
      }), m = d("div", {
        class: "relay-feature-form__success-icon"
      });
      m.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>';
      const v = d("h4", {}, ["Thank you!"]), _ = d("p", {}, [
        "Your feature request has been submitted."
      ]);
      x.appendChild(m), x.appendChild(v), x.appendChild(_), i.appendChild(x);
    },
    setPrefillData: (x) => {
      x.title && l.setValue(x.title), x.description && o.setValue(x.description), x.category && c.setValue(x.category);
    }
  };
}
const rt = `
  .relay-chat-form {
    display: flex;
    flex-direction: column;
    gap: 20px;
    padding: 20px;
  }

  .relay-chat-form__footer {
    padding-top: 4px;
  }

  .relay-chat-form__success {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 48px 24px;
    text-align: center;
  }

  .relay-chat-form__success-icon {
    width: 56px;
    height: 56px;
    margin-bottom: 16px;
    color: hsl(var(--relay-success));
    background: hsl(var(--relay-success) / 0.1);
    border-radius: 50%;
    padding: 12px;
  }

  .relay-chat-form__success-icon svg {
    width: 100%;
    height: 100%;
  }

  .relay-chat-form__success h4 {
    font-size: 18px;
    font-weight: 600;
    color: hsl(var(--relay-text));
    margin: 0 0 6px;
    letter-spacing: -0.01em;
  }

  .relay-chat-form__success p {
    font-size: 14px;
    color: hsl(var(--relay-text-muted));
    margin: 0;
  }
`, at = `
  ${Ge}
  ${Je}
  ${Qe}
  ${rt}
`, ot = `
  .relay-annotation-toolbar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: hsl(var(--relay-bg));
    border-bottom: 1px solid hsl(var(--relay-border));
  }

  .relay-annotation-toolbar__tools {
    display: flex;
    gap: 4px;
  }

  .relay-annotation-toolbar__tool {
    width: 36px;
    height: 36px;
    padding: 0;
    background: none;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    color: hsl(var(--relay-text-muted));
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }

  .relay-annotation-toolbar__tool:hover {
    background: hsl(var(--relay-bg-secondary));
    color: hsl(var(--relay-text));
  }

  .relay-annotation-toolbar__tool--active {
    background: hsl(var(--relay-bg-tertiary));
    color: hsl(var(--relay-primary));
  }

  .relay-annotation-toolbar__tool svg {
    width: 20px;
    height: 20px;
  }

  .relay-annotation-toolbar__divider {
    width: 1px;
    height: 24px;
    background: hsl(var(--relay-border));
    margin: 0 4px;
  }

  .relay-annotation-toolbar__colors {
    display: flex;
    gap: 4px;
  }

  .relay-annotation-toolbar__color {
    width: 24px;
    height: 24px;
    padding: 0;
    border: 2px solid transparent;
    border-radius: 50%;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .relay-annotation-toolbar__color:hover {
    transform: scale(1.1);
  }

  .relay-annotation-toolbar__color--active {
    border-color: hsl(var(--relay-text));
    box-shadow: 0 0 0 2px hsl(var(--relay-bg));
  }

  .relay-annotation-toolbar__actions {
    display: flex;
    gap: 4px;
    margin-left: auto;
  }

  .relay-annotation-toolbar__action {
    width: 32px;
    height: 32px;
    padding: 0;
    background: none;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    color: hsl(var(--relay-text-muted));
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }

  .relay-annotation-toolbar__action:hover:not(:disabled) {
    background: hsl(var(--relay-bg-secondary));
    color: hsl(var(--relay-text));
  }

  .relay-annotation-toolbar__action:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .relay-annotation-toolbar__action svg {
    width: 18px;
    height: 18px;
  }
`, J = {
  arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>',
  rectangle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>',
  circle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>',
  highlight: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>',
  blur: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 8h.01M12 8h.01M16 8h.01M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01"/></svg>',
  text: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7V4h16v3M9 20h6M12 4v16"/></svg>'
}, Q = [
  "#ef4444",
  // red
  "#f97316",
  // orange
  "#eab308",
  // yellow
  "#22c55e",
  // green
  "#3b82f6",
  // blue
  "#8b5cf6",
  // purple
  "#000000"
  // black
];
function it(h = {}) {
  const {
    activeTool: e = "arrow",
    activeColor: t = Q[0],
    onToolChange: r,
    onColorChange: a,
    onUndo: s,
    onRedo: i,
    canUndo: l = !1,
    canRedo: o = !1
  } = h;
  let c = e, p = t;
  const y = d("div", { class: "relay-annotation-toolbar" }), n = d("div", {
    class: "relay-annotation-toolbar__tools"
  }), u = /* @__PURE__ */ new Map();
  Object.keys(J).forEach((k) => {
    const C = d("button", {
      type: "button",
      class: `relay-annotation-toolbar__tool ${k === c ? "relay-annotation-toolbar__tool--active" : ""}`
    });
    C.innerHTML = J[k], C.setAttribute("aria-label", `${k} tool`), C.setAttribute("title", k.charAt(0).toUpperCase() + k.slice(1)), C.addEventListener("click", () => {
      S(k), r == null || r(k);
    }), u.set(k, C), n.appendChild(C);
  });
  const g = d("div", {
    class: "relay-annotation-toolbar__divider"
  }), f = d("div", {
    class: "relay-annotation-toolbar__colors"
  }), x = /* @__PURE__ */ new Map();
  Q.forEach((k) => {
    const C = d("button", {
      type: "button",
      class: `relay-annotation-toolbar__color ${k === p ? "relay-annotation-toolbar__color--active" : ""}`
    });
    C.style.backgroundColor = k, C.setAttribute("aria-label", `Color ${k}`), C.addEventListener("click", () => {
      T(k), a == null || a(k);
    }), x.set(k, C), f.appendChild(C);
  });
  const m = d("div", {
    class: "relay-annotation-toolbar__divider"
  }), v = d("div", {
    class: "relay-annotation-toolbar__actions"
  }), _ = d("button", {
    type: "button",
    class: "relay-annotation-toolbar__action",
    disabled: !l
  });
  _.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7v6h6M3 13l4-4c1.33-1.33 3.17-2 5-2s3.67.67 5 2c1.33 1.33 2 3.17 2 5s-.67 3.67-2 5"/></svg>', _.setAttribute("aria-label", "Undo"), _.setAttribute("title", "Undo (Ctrl+Z)"), s && _.addEventListener("click", s);
  const b = d("button", {
    type: "button",
    class: "relay-annotation-toolbar__action",
    disabled: !o
  });
  b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 7v6h-6M21 13l-4-4c-1.33-1.33-3.17-2-5-2s-3.67.67-5 2c-1.33 1.33-2 3.17-2 5s.67 3.67 2 5"/></svg>', b.setAttribute("aria-label", "Redo"), b.setAttribute("title", "Redo (Ctrl+Shift+Z)"), i && b.addEventListener("click", i), v.appendChild(_), v.appendChild(b), y.appendChild(n), y.appendChild(g), y.appendChild(f), y.appendChild(m), y.appendChild(v);
  const S = (k) => {
    var C, M;
    (C = u.get(c)) == null || C.classList.remove("relay-annotation-toolbar__tool--active"), (M = u.get(k)) == null || M.classList.add("relay-annotation-toolbar__tool--active"), c = k;
  }, T = (k) => {
    var C, M;
    (C = x.get(p)) == null || C.classList.remove("relay-annotation-toolbar__color--active"), (M = x.get(k)) == null || M.classList.add("relay-annotation-toolbar__color--active"), p = k;
  };
  return {
    element: y,
    setActiveTool: S,
    setActiveColor: T,
    setCanUndo: (k) => {
      _.disabled = !k;
    },
    setCanRedo: (k) => {
      b.disabled = !k;
    },
    getActiveTool: () => c,
    getActiveColor: () => p
  };
}
const st = `
  .relay-annotation-layer {
    position: absolute;
    inset: 0;
    cursor: crosshair;
  }

  .relay-annotation-layer--text {
    cursor: text;
  }

  .relay-annotation-layer__canvas {
    width: 100%;
    height: 100%;
  }

  .relay-annotation-layer__text-input {
    position: absolute;
    padding: 4px 8px;
    font-family: inherit;
    font-size: 16px;
    color: inherit;
    background: white;
    border: 2px solid currentColor;
    border-radius: 4px;
    outline: none;
    min-width: 100px;
  }
`;
function nt(h) {
  const {
    width: e,
    height: t,
    tool: r = "arrow",
    color: a = "#ef4444",
    onAnnotationAdd: s
  } = h;
  let i = r, l = a, o = [], c = [], p = !1, y = 0, n = 0, u = null;
  const g = d("div", {
    class: "relay-annotation-layer"
  }), f = d("canvas", {
    class: "relay-annotation-layer__canvas",
    width: e,
    height: t
  }), x = f.getContext("2d");
  g.appendChild(f);
  const m = (w) => {
    const L = f.getBoundingClientRect(), H = f.width / L.width, E = f.height / L.height;
    let I, R;
    return "touches" in w ? (I = w.touches[0].clientX, R = w.touches[0].clientY) : (I = w.clientX, R = w.clientY), {
      x: (I - L.left) * H,
      y: (R - L.top) * E
    };
  }, v = () => {
    x.clearRect(0, 0, f.width, f.height), o.forEach((w) => {
      _(x, w);
    }), u && u.type && _(x, u);
  }, _ = (w, L) => {
    w.strokeStyle = L.color || l, w.fillStyle = L.color || l, w.lineWidth = 3;
    const H = L.x || 0, E = L.y || 0, I = L.width || 0, R = L.height || 0;
    switch (L.type) {
      case "rectangle":
        w.strokeRect(H, E, I, R);
        break;
      case "circle":
        w.beginPath();
        const z = Math.abs(I) / 2, be = Math.abs(R) / 2;
        w.ellipse(
          H + I / 2,
          E + R / 2,
          z,
          be,
          0,
          0,
          2 * Math.PI
        ), w.stroke();
        break;
      case "arrow":
        w.beginPath(), w.moveTo(H, E), w.lineTo(H + I, E + R), w.stroke();
        const N = Math.atan2(R, I), V = 15;
        w.beginPath(), w.moveTo(H + I, E + R), w.lineTo(
          H + I - V * Math.cos(N - Math.PI / 6),
          E + R - V * Math.sin(N - Math.PI / 6)
        ), w.lineTo(
          H + I - V * Math.cos(N + Math.PI / 6),
          E + R - V * Math.sin(N + Math.PI / 6)
        ), w.closePath(), w.fill();
        break;
      case "highlight":
        w.fillStyle = (L.color || l) + "40", w.fillRect(H, E, I, R);
        break;
      case "blur":
        w.fillStyle = "rgba(128, 128, 128, 0.6)", w.fillRect(H, E, I, R);
        break;
      case "text":
        L.text && (w.font = "16px sans-serif", w.fillText(L.text, H, E));
        break;
    }
  };
  let b = null;
  const S = (w, L) => {
    b && b.remove(), b = d("input", {
      type: "text",
      class: "relay-annotation-layer__text-input"
    }), b.style.left = `${w / f.width * 100}%`, b.style.top = `${L / f.height * 100}%`, b.style.color = l, b.style.borderColor = l, b.addEventListener("keydown", (H) => {
      H.key === "Enter" ? T() : H.key === "Escape" && (b == null || b.remove(), b = null);
    }), b.addEventListener("blur", T), g.appendChild(b), b.focus();
  }, T = () => {
    if (!b || !b.value.trim()) {
      b == null || b.remove(), b = null;
      return;
    }
    f.getBoundingClientRect();
    const w = parseFloat(b.style.left) / 100 * f.width, L = parseFloat(b.style.top) / 100 * f.height, H = {
      id: A("annotation"),
      type: "text",
      x: w,
      y: L + 16,
      // Offset for text baseline
      color: l,
      text: b.value.trim()
    };
    o.push(H), c = [], s == null || s(H), v(), b.remove(), b = null;
  }, k = (w) => {
    if (i === "text") {
      const H = m(w);
      S(H.x, H.y);
      return;
    }
    p = !0;
    const L = m(w);
    y = L.x, n = L.y, u = {
      id: A("annotation"),
      type: i,
      x: y,
      y: n,
      width: 0,
      height: 0,
      color: l
    };
  }, C = (w) => {
    if (!p || !u)
      return;
    const L = m(w);
    u.width = L.x - y, u.height = L.y - n, v();
  }, M = () => {
    if (!p || !u)
      return;
    p = !1;
    const w = 5;
    (Math.abs(u.width || 0) > w || Math.abs(u.height || 0) > w) && (o.push(u), c = [], s == null || s(u)), u = null, v();
  };
  return f.addEventListener("mousedown", k), f.addEventListener("mousemove", C), f.addEventListener("mouseup", M), f.addEventListener("mouseleave", M), f.addEventListener("touchstart", (w) => {
    w.preventDefault(), k(w);
  }), f.addEventListener("touchmove", (w) => {
    w.preventDefault(), C(w);
  }), f.addEventListener("touchend", M), {
    element: g,
    canvas: f,
    setTool: (w) => {
      i = w, g.classList.toggle(
        "relay-annotation-layer--text",
        w === "text"
      );
    },
    setColor: (w) => {
      l = w;
    },
    getAnnotations: () => [...o],
    setAnnotations: (w) => {
      o = [...w], c = [], v();
    },
    undo: () => {
      if (o.length === 0)
        return null;
      const w = o.pop();
      return c.push(w), v(), w;
    },
    redo: () => {
      if (c.length === 0)
        return null;
      const w = c.pop();
      return o.push(w), v(), w;
    },
    canUndo: () => o.length > 0,
    canRedo: () => c.length > 0,
    clear: () => {
      o = [], c = [], v();
    },
    redraw: v
  };
}
const lt = `
  .relay-screenshot-editor {
    position: fixed;
    inset: 0;
    z-index: 1000000;
    display: flex;
    flex-direction: column;
    background: hsl(var(--relay-bg));
  }

  .relay-screenshot-editor__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background: hsl(var(--relay-bg));
    border-bottom: 1px solid hsl(var(--relay-border));
  }

  .relay-screenshot-editor__title {
    font-size: 16px;
    font-weight: 600;
    color: hsl(var(--relay-text));
    margin: 0;
  }

  .relay-screenshot-editor__actions {
    display: flex;
    gap: 8px;
  }

  .relay-screenshot-editor__canvas-container {
    flex: 1;
    position: relative;
    overflow: auto;
    display: flex;
    align-items: center;
    justify-content: center;
    background: hsl(var(--relay-bg-secondary));
    padding: 16px;
  }

  .relay-screenshot-editor__canvas-wrapper {
    position: relative;
    box-shadow: var(--relay-shadow-lg);
    background: white;
  }

  .relay-screenshot-editor__image {
    display: block;
    max-width: 100%;
    max-height: calc(100vh - 180px);
    height: auto;
  }

  /* Animation */
  .relay-screenshot-editor--enter {
    animation: relay-editor-enter 0.3s ease-out;
  }

  .relay-screenshot-editor--exit {
    animation: relay-editor-exit 0.2s ease-in forwards;
  }

  @keyframes relay-editor-enter {
    from {
      opacity: 0;
      transform: scale(0.95);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  @keyframes relay-editor-exit {
    from {
      opacity: 1;
      transform: scale(1);
    }
    to {
      opacity: 0;
      transform: scale(0.95);
    }
  }
`;
function ct(h) {
  const { screenshot: e, existingAnnotations: t = [], onSave: r, onCancel: a } = h;
  let s = null, i = null, l = 0, o = 0;
  const c = d("div", {
    class: "relay-screenshot-editor relay-screenshot-editor--enter"
  }), p = d("div", {
    class: "relay-screenshot-editor__header"
  }), y = d(
    "h3",
    { class: "relay-screenshot-editor__title" },
    ["Edit Screenshot"]
  ), n = d("div", {
    class: "relay-screenshot-editor__actions"
  }), u = O("Cancel", {
    variant: "secondary",
    size: "sm",
    onClick: () => S()
  }), g = O("Save", {
    variant: "primary",
    size: "sm",
    onClick: () => b()
  });
  n.appendChild(u), n.appendChild(g), p.appendChild(y), p.appendChild(n);
  const f = d("div", {
    class: "relay-screenshot-editor__canvas-container"
  }), x = d("div", {
    class: "relay-screenshot-editor__canvas-wrapper"
  }), m = d("img", {
    class: "relay-screenshot-editor__image"
  }), v = URL.createObjectURL(e);
  m.src = v, m.onload = () => {
    l = m.naturalWidth, o = m.naturalHeight, s = it({
      activeTool: "arrow",
      activeColor: "#ef4444",
      onToolChange: (M) => {
        i == null || i.setTool(M);
      },
      onColorChange: (M) => {
        i == null || i.setColor(M);
      },
      onUndo: () => {
        i == null || i.undo(), _();
      },
      onRedo: () => {
        i == null || i.redo(), _();
      }
    }), c.insertBefore(s.element, f), i = nt({
      width: l,
      height: o,
      tool: s.getActiveTool(),
      color: s.getActiveColor(),
      onAnnotationAdd: () => {
        _();
      }
    }), t.length > 0 && i.setAnnotations(t);
    const C = i.element;
    C.style.position = "absolute", C.style.top = "0", C.style.left = "0", C.style.width = "100%", C.style.height = "100%", x.appendChild(C), i.redraw();
  }, x.appendChild(m), f.appendChild(x), c.appendChild(p), c.appendChild(f);
  const _ = () => {
    s && i && (s.setCanUndo(i.canUndo()), s.setCanRedo(i.canRedo()));
  }, b = async () => {
    if (!i)
      return;
    const C = i.getAnnotations(), M = document.createElement("canvas");
    M.width = l, M.height = o;
    const w = M.getContext("2d");
    w.drawImage(m, 0, 0), w.drawImage(i.canvas, 0, 0), M.toBlob((L) => {
      L && r(L, C), S();
    }, "image/png");
  }, S = async () => {
    c.classList.remove("relay-screenshot-editor--enter"), c.classList.add("relay-screenshot-editor--exit"), await le(c), c.remove(), URL.revokeObjectURL(v), a();
  }, T = (C) => {
    C.key === "Escape" ? S() : C.key === "z" && (C.ctrlKey || C.metaKey) ? (C.shiftKey ? i == null || i.redo() : i == null || i.undo(), _()) : C.key === "s" && (C.ctrlKey || C.metaKey) && (C.preventDefault(), b());
  };
  document.addEventListener("keydown", T);
  const k = () => {
    document.removeEventListener("keydown", T), URL.revokeObjectURL(v);
  };
  return {
    element: c,
    open: () => {
      document.body.appendChild(c);
    },
    close: async () => {
      await S(), k();
    }
  };
}
const dt = `
  ${ot}
  ${st}
  ${lt}
`, ht = `
  .relay-conversation-list {
    display: flex;
    flex-direction: column;
    flex: 1;
    overflow-y: auto;
    padding-bottom: 8px;
  }

  .relay-conversation-list__loading {
    display: flex;
    justify-content: center;
    align-items: center;
    flex: 1;
    padding: 32px;
  }

  .relay-conversation-list__spinner {
    width: 32px;
    height: 32px;
    border: 3px solid hsl(var(--relay-border));
    border-top-color: hsl(var(--relay-primary));
    border-radius: 50%;
    animation: relay-spin 0.8s linear infinite;
  }

  .relay-conversation-list__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex: 1;
    padding: 48px 24px;
    text-align: center;
  }

  .relay-conversation-list__empty-icon {
    width: 48px;
    height: 48px;
    margin-bottom: 16px;
    color: hsl(var(--relay-text-subtle));
  }

  .relay-conversation-list__empty-icon svg {
    width: 100%;
    height: 100%;
  }

  .relay-conversation-list__empty-title {
    font-size: 17px;
    font-weight: 600;
    color: hsl(var(--relay-text));
    margin: 0 0 4px;
  }

  .relay-conversation-list__empty-text {
    font-size: 14px;
    color: hsl(var(--relay-text-muted));
    margin: 0;
  }

  .relay-conversation-item {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 14px 16px;
    background: none;
    border: none;
    border-radius: 0;
    border-bottom: 1px solid hsl(var(--relay-border));
    cursor: pointer;
    text-align: left;
    transition: all 0.15s ease;
    width: 100%;
    font-family: inherit;
  }

  .relay-conversation-item:hover {
    background: hsl(var(--relay-bg-secondary));
  }

  .relay-conversation-item:active {
    background: hsl(var(--relay-bg-tertiary));
  }

  .relay-conversation-item__avatar {
    width: 40px;
    height: 40px;
    flex-shrink: 0;
    background: hsl(var(--relay-bg-tertiary));
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: hsl(var(--relay-text-muted));
  }

  .relay-conversation-item__avatar svg {
    width: 20px;
    height: 20px;
  }

  .relay-conversation-item__content {
    flex: 1;
    min-width: 0;
  }

  .relay-conversation-item__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 4px;
  }

  .relay-conversation-item__subject {
    font-size: 14px;
    font-weight: 600;
    color: hsl(var(--relay-text));
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin: 0;
  }

  .relay-conversation-item__time {
    font-size: 12px;
    color: hsl(var(--relay-text-subtle));
    flex-shrink: 0;
  }

  .relay-conversation-item__preview {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .relay-conversation-item__message {
    font-size: 13px;
    color: hsl(var(--relay-text-muted));
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
    min-width: 0;
  }

  .relay-conversation-item--unread .relay-conversation-item__subject,
  .relay-conversation-item--unread .relay-conversation-item__message {
    font-weight: 600;
    color: hsl(var(--relay-text));
  }

  .relay-conversation-item__badge {
    flex-shrink: 0;
    min-width: 20px;
    height: 20px;
    padding: 0 6px;
    background: hsl(var(--relay-primary));
    color: hsl(var(--relay-primary-text));
    font-size: 11px;
    font-weight: 700;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
`, pt = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>', ut = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>';
function yt(h) {
  const {
    conversations: e,
    onSelect: t,
    loading: r = !1
  } = h;
  let a = [...e], s = r;
  const i = d("div", { class: "relay-conversation-list" }), l = () => {
    if (i.innerHTML = "", s) {
      const o = d("div", {
        class: "relay-conversation-list__loading"
      }), c = d("div", {
        class: "relay-conversation-list__spinner"
      });
      o.appendChild(c), i.appendChild(o);
      return;
    }
    if (a.length === 0) {
      const o = d("div", {
        class: "relay-conversation-list__empty"
      }), c = d("div", {
        class: "relay-conversation-list__empty-icon"
      });
      c.innerHTML = ut;
      const p = d(
        "h3",
        { class: "relay-conversation-list__empty-title" },
        ["No messages yet"]
      ), y = d(
        "p",
        { class: "relay-conversation-list__empty-text" },
        ["Start a conversation with us!"]
      );
      o.appendChild(c), o.appendChild(p), o.appendChild(y), i.appendChild(o);
      return;
    }
    a.forEach((o) => {
      const c = o.unreadCount > 0, p = d("button", {
        type: "button",
        class: `relay-conversation-item ${c ? "relay-conversation-item--unread" : ""}`
      }), y = d("div", {
        class: "relay-conversation-item__avatar"
      });
      y.innerHTML = pt;
      const n = d("div", {
        class: "relay-conversation-item__content"
      }), u = d("div", {
        class: "relay-conversation-item__header"
      }), g = d(
        "h4",
        { class: "relay-conversation-item__subject" },
        [P(o.subject || "New conversation")]
      ), f = d(
        "span",
        { class: "relay-conversation-item__time" },
        [ze(new Date(o.lastMessage.createdAt))]
      );
      u.appendChild(g), u.appendChild(f);
      const x = d("div", {
        class: "relay-conversation-item__preview"
      }), m = d(
        "p",
        { class: "relay-conversation-item__message" },
        [P(o.lastMessage.body)]
      );
      if (x.appendChild(m), c) {
        const v = d(
          "span",
          { class: "relay-conversation-item__badge" },
          [o.unreadCount > 99 ? "99+" : String(o.unreadCount)]
        );
        x.appendChild(v);
      }
      n.appendChild(u), n.appendChild(x), p.appendChild(y), p.appendChild(n), p.addEventListener("click", () => t(o)), i.appendChild(p);
    });
  };
  return l(), {
    element: i,
    setConversations: (o) => {
      a = [...o], l();
    },
    setLoading: (o) => {
      s = o, l();
    }
  };
}
function gt(h) {
  const e = /* @__PURE__ */ new Date();
  return h.toDateString() === e.toDateString() ? h.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : h.toLocaleDateString([], { month: "short", day: "numeric" }) + " " + h.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
const mt = `
  .relay-message-thread {
    display: flex;
    flex-direction: column;
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    gap: 0;
  }

  .relay-message-thread__load-more {
    display: flex;
    justify-content: center;
    padding: 8px;
  }

  .relay-message-thread__load-more-btn {
    padding: 6px 16px;
    font-family: inherit;
    font-size: 13px;
    font-weight: 500;
    color: hsl(var(--relay-primary));
    background: none;
    border: 1px solid hsl(var(--relay-border));
    border-radius: 16px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .relay-message-thread__load-more-btn:hover {
    background: hsl(var(--relay-bg-secondary));
    border-color: hsl(var(--relay-border-hover));
  }

  .relay-message-thread__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex: 1;
    padding: 32px;
    text-align: center;
    color: hsl(var(--relay-text-muted));
  }

  .relay-message-thread__empty-icon {
    width: 48px;
    height: 48px;
    margin-bottom: 12px;
    color: hsl(var(--relay-text-subtle));
  }

  .relay-message-thread__empty-icon svg {
    width: 100%;
    height: 100%;
  }

  .relay-message {
    display: flex;
    flex-direction: column;
    max-width: 80%;
  }

  .relay-message--inbound {
    align-self: flex-start;
  }

  .relay-message--outbound {
    align-self: flex-end;
  }

  .relay-message__bubble {
    padding: 12px 16px;
    border-radius: 20px;
    font-size: 14px;
    line-height: 1.45;
    word-wrap: break-word;
  }

  .relay-message--inbound .relay-message__bubble {
    background: hsl(var(--relay-bg-tertiary));
    color: hsl(var(--relay-text));
    border-bottom-left-radius: 6px;
  }

  .relay-message--outbound .relay-message__bubble {
    background: hsl(var(--relay-text));
    color: hsl(var(--relay-bg));
    border-bottom-right-radius: 6px;
  }

  .relay-message__time {
    font-size: 10px;
    color: hsl(var(--relay-text-subtle));
    margin-top: 6px;
    padding: 0 6px;
    display: none;
  }

  .relay-message--show-time .relay-message__time {
    display: block;
  }

  .relay-message--inbound .relay-message__time {
    text-align: left;
  }

  .relay-message--outbound .relay-message__time {
    text-align: right;
  }

  .relay-message-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .relay-message-group--inbound {
    align-items: flex-start;
  }

  .relay-message-group--outbound {
    align-items: flex-end;
  }

  .relay-message-group + .relay-message-group {
    margin-top: 12px;
  }

  .relay-message-thread__loading {
    display: flex;
    justify-content: center;
    padding: 16px;
  }

  .relay-message-thread__spinner {
    width: 24px;
    height: 24px;
    border: 2px solid hsl(var(--relay-border));
    border-top-color: hsl(var(--relay-primary));
    border-radius: 50%;
    animation: relay-spin 0.8s linear infinite;
  }
`;
function ft(h) {
  const {
    messages: e,
    onLoadMore: t,
    hasMore: r = !1,
    loading: a = !1
  } = h;
  let s = [...e], i = a;
  const l = d("div", { class: "relay-message-thread" }), o = () => {
    if (l.innerHTML = "", i && s.length === 0) {
      const n = d("div", {
        class: "relay-message-thread__loading"
      }), u = d("div", {
        class: "relay-message-thread__spinner"
      });
      n.appendChild(u), l.appendChild(n);
      return;
    }
    if (s.length === 0) {
      const n = d("div", {
        class: "relay-message-thread__empty"
      }), u = d("div", {
        class: "relay-message-thread__empty-icon"
      });
      u.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>';
      const g = d("p", {}, ["No messages yet"]);
      n.appendChild(u), n.appendChild(g), l.appendChild(n);
      return;
    }
    if (r && t) {
      const n = d("div", {
        class: "relay-message-thread__load-more"
      }), u = d(
        "button",
        {
          type: "button",
          class: "relay-message-thread__load-more-btn"
        },
        ["Load earlier messages"]
      );
      u.addEventListener("click", t), n.appendChild(u), l.appendChild(n);
    }
    let c = null, p = null, y = null;
    s.forEach((n, u) => {
      var T;
      const g = new Date(n.createdAt), f = n.direction !== p, x = u === s.length - 1 || ((T = s[u + 1]) == null ? void 0 : T.direction) !== n.direction, m = y ? (g.getTime() - y.getTime()) / 1e3 / 60 : 0, v = x || m > 5;
      f && (c = d("div", {
        class: `relay-message-group relay-message-group--${n.direction}`
      }), l.appendChild(c));
      const _ = d("div", {
        class: `relay-message relay-message--${n.direction}${v ? " relay-message--show-time" : ""}`
      }), b = d("div", { class: "relay-message__bubble" }, [
        n.body
      ]), S = d("div", { class: "relay-message__time" }, [
        gt(g)
      ]);
      _.appendChild(b), _.appendChild(S), c == null || c.appendChild(_), p = n.direction, y = g;
    });
  };
  return o(), setTimeout(() => {
    l.scrollTop = l.scrollHeight;
  }, 0), {
    element: l,
    setMessages: (c) => {
      s = [...c], o();
    },
    addMessage: (c) => {
      s.push(c), o(), setTimeout(() => {
        l.scrollTop = l.scrollHeight;
      }, 0);
    },
    scrollToBottom: () => {
      l.scrollTop = l.scrollHeight;
    },
    setLoading: (c) => {
      i = c, o();
    }
  };
}
const bt = `
  .relay-chat-input {
    display: flex;
    align-items: flex-end;
    gap: 8px;
    padding: 12px 16px;
    background: hsl(var(--relay-bg));
    border-top: 1px solid hsl(var(--relay-border));
  }

  .relay-chat-input__field {
    flex: 1;
    display: flex;
    align-items: flex-end;
    background: hsl(var(--relay-bg-secondary));
    border: 1px solid hsl(var(--relay-border));
    border-radius: 20px;
    padding: 10px 16px;
    transition: all 0.15s ease;
  }

  .relay-chat-input__field:hover {
    border-color: hsl(var(--relay-border-hover));
  }

  .relay-chat-input__field:focus-within {
    border-color: hsl(var(--relay-primary));
    background: hsl(var(--relay-bg));
    box-shadow: 0 0 0 3px hsl(var(--relay-primary) / 0.08);
  }

  .relay-chat-input__textarea {
    flex: 1;
    border: none;
    background: transparent;
    font-family: inherit;
    font-size: 14px;
    color: hsl(var(--relay-text));
    resize: none;
    outline: none;
    max-height: 100px;
    min-height: 20px;
    line-height: 1.4;
  }

  .relay-chat-input__textarea::placeholder {
    color: hsl(var(--relay-text-subtle));
  }

  .relay-chat-input__send {
    flex-shrink: 0;
    width: 36px;
    height: 36px;
    padding: 0;
    background: hsl(var(--relay-primary));
    border: none;
    border-radius: 50%;
    cursor: pointer;
    color: hsl(var(--relay-primary-text));
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
    opacity: 0.4;
  }

  .relay-chat-input__send:hover:not(:disabled) {
    background: hsl(var(--relay-primary-hover));
  }

  .relay-chat-input__send:active:not(:disabled) {
    transform: scale(0.95);
  }

  .relay-chat-input__send--active {
    opacity: 1;
  }

  .relay-chat-input__send:disabled {
    cursor: not-allowed;
    opacity: 0.3;
  }

  .relay-chat-input__send svg {
    width: 18px;
    height: 18px;
  }
`, xt = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>';
function vt(h) {
  const {
    placeholder: e = "Type a message...",
    onSend: t,
    disabled: r = !1
  } = h;
  let a = r;
  const s = d("div", { class: "relay-chat-input" }), i = d("div", {
    class: "relay-chat-input__field"
  }), l = d("textarea", {
    class: "relay-chat-input__textarea",
    placeholder: e,
    rows: 1
  }), o = d("button", {
    type: "button",
    class: "relay-chat-input__send",
    disabled: a
  });
  o.innerHTML = xt, o.setAttribute("aria-label", "Send message"), i.appendChild(l), s.appendChild(i), s.appendChild(o);
  const c = () => {
    l.style.height = "auto", l.style.height = Math.min(l.scrollHeight, 100) + "px";
  }, p = () => {
    const n = l.value.trim().length > 0;
    o.classList.toggle(
      "relay-chat-input__send--active",
      n && !a
    );
  };
  l.addEventListener("input", () => {
    c(), p();
  });
  const y = () => {
    const n = l.value.trim();
    n && !a && (t(n), l.value = "", c(), p());
  };
  return l.addEventListener("keydown", (n) => {
    n.key === "Enter" && !n.shiftKey && (n.preventDefault(), y());
  }), o.addEventListener("click", y), {
    element: s,
    focus: () => l.focus(),
    clear: () => {
      l.value = "", c(), p();
    },
    setDisabled: (n) => {
      a = n, o.disabled = n, l.disabled = n, p();
    }
  };
}
const wt = `
  ${ht}
  ${mt}
  ${bt}
`, _t = `
  .relay-roadmap-item {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 14px 16px;
    background: hsl(var(--relay-bg));
    border: 1px solid hsl(var(--relay-border));
    border-radius: 12px;
    transition: all 0.15s ease;
  }

  .relay-roadmap-item:hover {
    border-color: hsl(var(--relay-border-hover));
    box-shadow: 0 2px 4px hsl(var(--relay-shadow));
  }

  .relay-roadmap-item__vote {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  }

  .relay-roadmap-item__vote-btn {
    width: 40px;
    height: 40px;
    padding: 0;
    background: hsl(var(--relay-bg-secondary));
    border: 1px solid hsl(var(--relay-border));
    border-radius: 10px;
    cursor: pointer;
    color: hsl(var(--relay-text-muted));
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }

  .relay-roadmap-item__vote-btn:hover {
    background: hsl(var(--relay-bg-tertiary));
    border-color: hsl(var(--relay-border-hover));
    color: hsl(var(--relay-text));
  }

  .relay-roadmap-item__vote-btn:active {
    transform: scale(0.95);
  }

  .relay-roadmap-item__vote-btn--voted {
    background: hsl(var(--relay-primary) / 0.1);
    border-color: hsl(var(--relay-primary) / 0.3);
    color: hsl(var(--relay-primary));
  }

  .relay-roadmap-item__vote-btn--voted:hover {
    background: hsl(var(--relay-primary) / 0.15);
    border-color: hsl(var(--relay-primary) / 0.4);
  }

  .relay-roadmap-item__vote-btn svg {
    width: 20px;
    height: 20px;
  }

  .relay-roadmap-item__vote-count {
    font-size: 12px;
    font-weight: 600;
    color: hsl(var(--relay-text-muted));
  }

  .relay-roadmap-item__vote-btn--voted + .relay-roadmap-item__vote-count {
    color: hsl(var(--relay-primary));
  }

  .relay-roadmap-item__content {
    flex: 1;
    min-width: 0;
  }

  .relay-roadmap-item__header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
  }

  .relay-roadmap-item__title {
    font-size: 14px;
    font-weight: 600;
    color: hsl(var(--relay-text));
    margin: 0;
    flex: 1;
    min-width: 0;
  }

  .relay-roadmap-item__status {
    flex-shrink: 0;
    padding: 3px 8px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.02em;
    border-radius: 6px;
  }

  .relay-roadmap-item__status--planned {
    background: hsl(217 91% 60% / 0.1);
    color: hsl(217 91% 50%);
  }

  .relay-roadmap-item__status--in_progress {
    background: hsl(38 92% 50% / 0.1);
    color: hsl(38 92% 40%);
  }

  .relay-roadmap-item__status--shipped {
    background: hsl(142 76% 36% / 0.1);
    color: hsl(142 76% 32%);
  }

  .relay-roadmap-item__description {
    font-size: 13px;
    color: hsl(var(--relay-text-muted));
    line-height: 1.4;
    margin: 0;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
`, ee = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 19V5M5 12l7-7 7 7"/></svg>', te = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 4l-8 8h5v8h6v-8h5z"/></svg>', re = {
  planned: "Planned",
  in_progress: "In Progress",
  shipped: "Shipped"
};
function ae(h) {
  const { item: e, onVote: t } = h;
  let r = { ...e };
  const a = d("div", { class: "relay-roadmap-item" }), s = d("div", {
    class: "relay-roadmap-item__vote"
  }), i = d("button", {
    type: "button",
    class: `relay-roadmap-item__vote-btn ${r.hasVoted ? "relay-roadmap-item__vote-btn--voted" : ""}`
  });
  i.innerHTML = r.hasVoted ? te : ee, i.setAttribute("aria-label", r.hasVoted ? "Remove vote" : "Vote");
  const l = d(
    "span",
    { class: "relay-roadmap-item__vote-count" },
    [String(r.voteCount)]
  );
  s.appendChild(i), s.appendChild(l);
  const o = d("div", {
    class: "relay-roadmap-item__content"
  }), c = d("div", { class: "relay-roadmap-item__header" }), p = d("h4", { class: "relay-roadmap-item__title" }, [
    P(r.title)
  ]), y = d(
    "span",
    {
      class: `relay-roadmap-item__status relay-roadmap-item__status--${r.status}`
    },
    [re[r.status]]
  );
  c.appendChild(p), c.appendChild(y);
  const n = d(
    "p",
    { class: "relay-roadmap-item__description" },
    [P(r.description)]
  );
  return o.appendChild(c), o.appendChild(n), a.appendChild(s), a.appendChild(o), i.addEventListener("click", () => {
    t(r);
  }), {
    element: a,
    update: (g) => {
      r = { ...g }, i.classList.toggle(
        "relay-roadmap-item__vote-btn--voted",
        r.hasVoted
      ), i.innerHTML = r.hasVoted ? te : ee, i.setAttribute("aria-label", r.hasVoted ? "Remove vote" : "Vote"), l.textContent = String(r.voteCount), p.textContent = r.title, y.className = `relay-roadmap-item__status relay-roadmap-item__status--${r.status}`, y.textContent = re[r.status], n.textContent = r.description;
    }
  };
}
const kt = `
  .relay-roadmap-list {
    display: flex;
    flex-direction: column;
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    gap: 16px;
  }

  .relay-roadmap-list__loading {
    display: flex;
    justify-content: center;
    align-items: center;
    flex: 1;
    padding: 32px;
  }

  .relay-roadmap-list__spinner {
    width: 32px;
    height: 32px;
    border: 3px solid hsl(var(--relay-border));
    border-top-color: hsl(var(--relay-primary));
    border-radius: 50%;
    animation: relay-spin 0.8s linear infinite;
  }

  .relay-roadmap-list__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex: 1;
    padding: 48px 24px;
    text-align: center;
  }

  .relay-roadmap-list__empty-icon {
    width: 48px;
    height: 48px;
    margin-bottom: 16px;
    color: hsl(var(--relay-text-subtle));
  }

  .relay-roadmap-list__empty-icon svg {
    width: 100%;
    height: 100%;
  }

  .relay-roadmap-list__empty-title {
    font-size: 17px;
    font-weight: 600;
    color: hsl(var(--relay-text));
    margin: 0 0 4px;
  }

  .relay-roadmap-list__empty-text {
    font-size: 14px;
    color: hsl(var(--relay-text-muted));
    margin: 0;
  }

  .relay-roadmap-list__group {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .relay-roadmap-list__group-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 4px;
  }

  .relay-roadmap-list__group-title {
    font-size: 13px;
    font-weight: 600;
    color: hsl(var(--relay-text-muted));
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin: 0;
  }

  .relay-roadmap-list__group-count {
    font-size: 12px;
    font-weight: 500;
    color: hsl(var(--relay-text-subtle));
    background: hsl(var(--relay-bg-secondary));
    padding: 2px 8px;
    border-radius: 10px;
  }

  .relay-roadmap-list__group-items {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
`, Ct = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>', oe = ["in_progress", "planned", "shipped"], St = {
  planned: "Planned",
  in_progress: "In Progress",
  shipped: "Shipped"
};
function Tt(h) {
  const {
    items: e,
    onVote: t,
    loading: r = !1,
    groupByStatus: a = !0
  } = h;
  let s = [...e], i = r;
  const l = /* @__PURE__ */ new Map(), o = d("div", { class: "relay-roadmap-list" }), c = (y) => {
    const n = /* @__PURE__ */ new Map();
    return oe.forEach((u) => {
      n.set(u, []);
    }), y.forEach((u) => {
      const g = n.get(u.status);
      g && g.push(u);
    }), n.forEach((u) => {
      u.sort((g, f) => f.voteCount - g.voteCount);
    }), n;
  }, p = () => {
    if (o.innerHTML = "", l.clear(), i) {
      const y = d("div", {
        class: "relay-roadmap-list__loading"
      }), n = d("div", {
        class: "relay-roadmap-list__spinner"
      });
      y.appendChild(n), o.appendChild(y);
      return;
    }
    if (s.length === 0) {
      const y = d("div", {
        class: "relay-roadmap-list__empty"
      }), n = d("div", {
        class: "relay-roadmap-list__empty-icon"
      });
      n.innerHTML = Ct;
      const u = d(
        "h3",
        { class: "relay-roadmap-list__empty-title" },
        ["No roadmap items"]
      ), g = d(
        "p",
        { class: "relay-roadmap-list__empty-text" },
        ["Check back later for updates!"]
      );
      y.appendChild(n), y.appendChild(u), y.appendChild(g), o.appendChild(y);
      return;
    }
    if (a) {
      const y = c(s);
      oe.forEach((n) => {
        const u = y.get(n);
        if (!u || u.length === 0)
          return;
        const g = d("div", {
          class: "relay-roadmap-list__group"
        }), f = d("div", {
          class: "relay-roadmap-list__group-header"
        }), x = d(
          "h3",
          { class: "relay-roadmap-list__group-title" },
          [St[n]]
        ), m = d(
          "span",
          { class: "relay-roadmap-list__group-count" },
          [String(u.length)]
        );
        f.appendChild(x), f.appendChild(m);
        const v = d("div", {
          class: "relay-roadmap-list__group-items"
        });
        u.forEach((_) => {
          const b = ae({
            item: _,
            onVote: t
          });
          l.set(_.id, b), v.appendChild(b.element);
        }), g.appendChild(f), g.appendChild(v), o.appendChild(g);
      });
    } else
      [...s].sort((n, u) => u.voteCount - n.voteCount).forEach((n) => {
        const u = ae({
          item: n,
          onVote: t
        });
        l.set(n.id, u), o.appendChild(u.element);
      });
  };
  return p(), {
    element: o,
    setItems: (y) => {
      s = [...y], p();
    },
    updateItem: (y) => {
      const n = s.findIndex((g) => g.id === y.id);
      n !== -1 && (s[n] = y);
      const u = l.get(y.id);
      u && u.update(y);
    },
    setLoading: (y) => {
      i = y, p();
    }
  };
}
const Mt = `
  ${_t}
  ${kt}
`, Lt = `
  #relay-widget .relay-home {
    display: flex;
    flex-direction: column;
    padding: 32px 24px 24px;
    flex: 1;
  }

  #relay-widget .relay-home__greeting {
    margin-bottom: 24px;
  }

  #relay-widget .relay-home__greeting h2 {
    font-size: 24px;
    font-weight: 700;
    color: hsl(var(--relay-text));
    margin: 0 0 4px;
    letter-spacing: -0.02em;
  }

  #relay-widget .relay-home__greeting p {
    font-size: 15px;
    color: hsl(var(--relay-text-muted));
    margin: 0;
  }

  #relay-widget .relay-home__chat-input {
    position: relative;
    margin-bottom: 16px;
  }

  #relay-widget .relay-home__chat-input input {
    width: 100%;
    padding: 14px 52px 14px 16px;
    font-family: inherit;
    font-size: 15px;
    color: hsl(var(--relay-text));
    background: hsl(var(--relay-bg-secondary));
    border: 1px solid hsl(var(--relay-border));
    border-radius: 24px;
    transition: all 0.15s ease;
  }

  #relay-widget .relay-home__chat-input input::placeholder {
    color: hsl(var(--relay-text-subtle));
  }

  #relay-widget .relay-home__chat-input input:hover {
    border-color: hsl(var(--relay-border-hover));
  }

  #relay-widget .relay-home__chat-input input:focus {
    outline: none;
    border-color: hsl(var(--relay-primary));
    background: hsl(var(--relay-bg));
    box-shadow: 0 0 0 3px hsl(var(--relay-primary) / 0.08);
  }

  #relay-widget .relay-home__chat-submit {
    position: absolute;
    right: 6px;
    top: 50%;
    transform: translateY(-50%);
    width: 36px;
    height: 36px;
    padding: 0;
    background: hsl(var(--relay-primary));
    border: none;
    border-radius: 50%;
    cursor: pointer;
    color: hsl(var(--relay-primary-text));
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
    opacity: 0.4;
  }

  #relay-widget .relay-home__chat-submit:hover:not(:disabled) {
    background: hsl(var(--relay-primary-hover));
  }

  #relay-widget .relay-home__chat-submit:active:not(:disabled) {
    transform: translateY(-50%) scale(0.95);
  }

  #relay-widget .relay-home__chat-submit--active {
    opacity: 1;
  }

  #relay-widget .relay-home__chat-submit svg {
    width: 18px;
    height: 18px;
  }

  #relay-widget .relay-home__actions {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }

  #relay-widget .relay-home__action-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    font-family: inherit;
    font-size: 14px;
    font-weight: 500;
    color: hsl(var(--relay-text));
    background: hsl(var(--relay-bg));
    border: 1px solid hsl(var(--relay-border));
    border-radius: 20px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  #relay-widget .relay-home__action-btn:hover {
    background: hsl(var(--relay-bg-secondary));
    border-color: hsl(var(--relay-border-hover));
  }

  #relay-widget .relay-home__action-btn:active {
    transform: scale(0.98);
  }

  #relay-widget .relay-home__action-btn span {
    font-size: 16px;
  }
`, Et = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>';
function ie(h) {
  const {
    greeting: e = "Hi there!",
    subtitle: t = "How can we help you today?",
    onChatSubmit: r,
    onReportBug: a,
    onRequestFeature: s
  } = h, i = d("div", { class: "relay-home" }), l = d("div", {
    class: "relay-home__greeting"
  }), o = d("h2", {}, [e]), c = d("p", {}, [t]);
  l.appendChild(o), l.appendChild(c);
  const p = d("div", {
    class: "relay-home__chat-input"
  }), y = d("input", {
    type: "text",
    placeholder: "Ask us anything..."
  }), n = d("button", {
    type: "button",
    class: "relay-home__chat-submit"
  });
  n.innerHTML = Et, n.setAttribute("aria-label", "Send message"), p.appendChild(y), p.appendChild(n), y.addEventListener("input", () => {
    const m = y.value.trim().length > 0;
    n.classList.toggle("relay-home__chat-submit--active", m);
  });
  const u = () => {
    const m = y.value.trim();
    m && (r(m), y.value = "", n.classList.remove("relay-home__chat-submit--active"));
  };
  y.addEventListener("keydown", (m) => {
    m.key === "Enter" && !m.shiftKey && (m.preventDefault(), u());
  }), n.addEventListener("click", u);
  const g = d("div", { class: "relay-home__actions" }), f = d("button", {
    type: "button",
    class: "relay-home__action-btn"
  });
  f.innerHTML = "<span>🐛</span> Report a bug", f.addEventListener("click", a);
  const x = d("button", {
    type: "button",
    class: "relay-home__action-btn"
  });
  return x.innerHTML = "<span>💡</span> Request a feature", x.addEventListener("click", s), g.appendChild(f), g.appendChild(x), i.appendChild(l), i.appendChild(p), i.appendChild(g), {
    element: i,
    focus: () => y.focus()
  };
}
const It = `
  ${Lt}
`, Ht = {
  mobile: 480
};
function D() {
  return typeof window > "u" ? "desktop" : window.innerWidth <= Ht.mobile ? "mobile" : "desktop";
}
function ye(h) {
  if (typeof window > "u")
    return () => {
    };
  let e = D();
  const t = () => {
    const r = D();
    r !== e && (e = r, h(r));
  };
  return window.addEventListener("resize", t), () => window.removeEventListener("resize", t);
}
function ge(h, e = D()) {
  if (e === "mobile")
    return {
      trigger: {
        position: "fixed",
        bottom: "16px",
        right: h.includes("right") ? "16px" : "auto",
        left: h.includes("left") ? "16px" : "auto"
      },
      modal: {
        position: "fixed",
        bottom: "0",
        left: "0",
        right: "0",
        top: "auto"
      }
    };
  const t = h.includes("bottom"), r = h.includes("right"), a = "20px", s = "90px";
  return {
    trigger: {
      position: "fixed",
      [t ? "bottom" : "top"]: a,
      [r ? "right" : "left"]: a
    },
    modal: {
      position: "fixed",
      [t ? "bottom" : "top"]: s,
      [r ? "right" : "left"]: a
    }
  };
}
const Rt = `
  #relay-widget .relay-trigger {
    position: fixed;
    z-index: 999998;
    width: 60px;
    height: 60px;
    border-radius: 50%;
    background: hsl(var(--relay-primary));
    border: none;
    cursor: pointer;
    box-shadow:
      0 2px 8px hsl(var(--relay-primary) / 0.25),
      0 4px 16px rgba(0, 0, 0, 0.1);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    font-family: inherit;
  }

  #relay-widget .relay-trigger:hover {
    transform: scale(1.05);
    background: hsl(var(--relay-primary-hover));
    box-shadow:
      0 4px 12px hsl(var(--relay-primary) / 0.3),
      0 8px 24px rgba(0, 0, 0, 0.15);
  }

  #relay-widget .relay-trigger:active {
    transform: scale(0.95);
  }

  #relay-widget .relay-trigger:focus-visible {
    outline: 2px solid hsl(var(--relay-primary));
    outline-offset: 4px;
  }

  #relay-widget .relay-trigger__icon {
    width: 26px;
    height: 26px;
    color: hsl(var(--relay-primary-text));
    transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  }

  #relay-widget .relay-trigger__icon svg {
    width: 100%;
    height: 100%;
  }

  #relay-widget .relay-trigger--open .relay-trigger__icon {
    transform: rotate(45deg);
  }

  #relay-widget .relay-trigger__badge {
    position: absolute;
    top: -2px;
    right: -2px;
    min-width: 20px;
    height: 20px;
    padding: 0 6px;
    background: hsl(var(--relay-error));
    color: white;
    font-size: 11px;
    font-weight: 700;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px solid hsl(var(--relay-bg));
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  @media (max-width: 480px) {
    #relay-widget .relay-trigger {
      width: 56px;
      height: 56px;
    }

    #relay-widget .relay-trigger__icon {
      width: 24px;
      height: 24px;
    }
  }
`, zt = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/></svg>', At = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>';
function Bt(h) {
  const {
    position: e,
    icon: t = zt,
    ariaLabel: r = "Open feedback widget",
    onClick: a
  } = h, s = d("button", {
    type: "button",
    class: "relay-trigger"
  });
  s.setAttribute("aria-label", r);
  const i = d("span", { class: "relay-trigger__icon" });
  i.innerHTML = t, s.appendChild(i);
  const l = d("span", { class: "relay-trigger__badge" });
  l.style.display = "none", s.appendChild(l);
  const o = (p, y) => {
    const n = ge(p, y);
    s.style.top = "", s.style.right = "", s.style.bottom = "", s.style.left = "", ce(s, n.trigger);
  };
  o(e);
  const c = ye((p) => {
    o(e, p);
  });
  return a && s.addEventListener("click", a), {
    element: s,
    setOpen: (p) => {
      s.classList.toggle("relay-trigger--open", p), i.innerHTML = p ? At : t, s.setAttribute(
        "aria-label",
        p ? "Close feedback widget" : r
      );
    },
    setBadge: (p) => {
      p && p > 0 ? (l.textContent = p > 99 ? "99+" : String(p), l.style.display = "flex") : l.style.display = "none";
    },
    updatePosition: (p) => {
      o(p);
    },
    destroy: () => {
      c(), s.remove();
    }
  };
}
const Ft = `
  #relay-widget .relay-modal {
    position: fixed;
    z-index: 999999;
    width: 400px;
    max-width: 400px;
    height: 700px;
    max-height: min(700px, calc(100vh - 120px));
    background: hsl(var(--relay-bg));
    border: 1px solid hsl(var(--relay-border));
    border-radius: 16px;
    box-shadow:
      0 0 0 1px hsl(var(--relay-border) / 0.1),
      0 4px 6px -1px rgba(0, 0, 0, 0.08),
      0 10px 15px -3px rgba(0, 0, 0, 0.1),
      0 20px 25px -5px rgba(0, 0, 0, 0.1);
    display: none;
    flex-direction: column;
    overflow: hidden;
    right: 24px;
    bottom: 96px;
  }

  #relay-widget .relay-modal--open {
    display: flex;
    animation: relay-modal-enter 0.2s ease-out forwards;
  }

  #relay-widget .relay-modal--closing {
    animation: relay-modal-exit 0.15s ease-in forwards;
  }

  @keyframes relay-modal-enter {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes relay-modal-exit {
    from {
      opacity: 1;
      transform: translateY(0);
    }
    to {
      opacity: 0;
      transform: translateY(8px);
    }
  }

  #relay-widget .relay-modal__content {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  /* Mobile styles */
  @media (max-width: 480px) {
    #relay-widget .relay-modal {
      width: 100%;
      max-width: 100%;
      max-height: 90vh;
      max-height: 90dvh;
      bottom: 0 !important;
      left: 0 !important;
      right: 0 !important;
      top: auto !important;
      border-radius: 20px 20px 0 0;
      border-bottom: none;
    }

    #relay-widget .relay-modal--open {
      animation: relay-slide-up 0.35s cubic-bezier(0.16, 1, 0.3, 1);
    }

    #relay-widget .relay-modal--closing {
      animation: relay-modal-slide-down 0.25s cubic-bezier(0.4, 0, 1, 1) forwards;
    }

    @keyframes relay-modal-slide-down {
      from {
        transform: translateY(0);
      }
      to {
        transform: translateY(100%);
      }
    }

    /* Drag handle for mobile */
    #relay-widget .relay-modal::before {
      content: '';
      display: block;
      width: 36px;
      height: 5px;
      background: hsl(var(--relay-border));
      border-radius: 3px;
      margin: 10px auto 6px;
      flex-shrink: 0;
    }
  }

  /* Overlay for mobile */
  #relay-widget .relay-modal-overlay {
    position: fixed;
    inset: 0;
    z-index: 999998;
    background: var(--relay-overlay);
    opacity: 0;
    transition: opacity 0.25s ease;
    display: none;
    backdrop-filter: blur(2px);
    -webkit-backdrop-filter: blur(2px);
  }

  #relay-widget .relay-modal-overlay--visible {
    display: block;
    opacity: 1;
  }

  #relay-widget .relay-modal-overlay--hiding {
    opacity: 0;
  }
`;
function Dt(h) {
  const { position: e, onClose: t } = h;
  let r = !1, a = !1;
  const s = d("div", { class: "relay-modal-overlay" }), i = d("div", {
    class: "relay-modal"
  }), l = d("div", {
    class: "relay-modal__content"
  });
  i.appendChild(l);
  const o = (u, g) => {
    const f = g || D(), x = ge(u, f);
    i.style.top = "", i.style.right = "", i.style.bottom = "", i.style.left = "", f === "desktop" && ce(i, x.modal);
  };
  o(e);
  const c = ye((u) => {
    o(e, u);
  });
  s.addEventListener("click", () => {
    r && !a && n();
  });
  const p = (u) => {
    u.key === "Escape" && r && !a && n();
  };
  document.addEventListener("keydown", p);
  const y = () => {
    if (r)
      return;
    r = !0, i.classList.add("relay-modal--open"), i.classList.remove("relay-modal--closing"), D() === "mobile" && (s.classList.add("relay-modal-overlay--visible"), s.classList.remove("relay-modal-overlay--hiding"));
    const u = i.querySelector(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    u == null || u.focus();
  }, n = async () => {
    !r || a || (a = !0, i.classList.add("relay-modal--closing"), D() === "mobile" && s.classList.add("relay-modal-overlay--hiding"), await le(i), i.classList.remove("relay-modal--open", "relay-modal--closing"), s.classList.remove(
      "relay-modal-overlay--visible",
      "relay-modal-overlay--hiding"
    ), r = !1, a = !1, t == null || t());
  };
  return {
    element: i,
    overlay: s,
    contentEl: l,
    open: y,
    close: n,
    isOpen: () => r,
    setContent: (u) => {
      l.innerHTML = "", Array.isArray(u) ? u.forEach((g) => l.appendChild(g)) : l.appendChild(u);
    },
    updatePosition: (u) => {
      o(u);
    },
    destroy: () => {
      c(), document.removeEventListener("keydown", p), i.remove(), s.remove();
    }
  };
}
const $t = `
  #relay-widget .relay-bottom-nav {
    display: flex;
    align-items: center;
    justify-content: space-around;
    padding: 8px 16px 12px;
    background: hsl(var(--relay-bg));
    border-top: 1px solid hsl(var(--relay-border));
    flex-shrink: 0;
  }

  #relay-widget .relay-bottom-nav__item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 8px 16px;
    background: none;
    border: none;
    border-radius: 12px;
    cursor: pointer;
    color: hsl(var(--relay-text-muted));
    transition: all 0.15s ease;
    position: relative;
    font-family: inherit;
  }

  #relay-widget .relay-bottom-nav__item:hover {
    color: hsl(var(--relay-text));
    background: hsl(var(--relay-bg-secondary));
  }

  #relay-widget .relay-bottom-nav__item--active {
    color: hsl(var(--relay-text));
  }

  #relay-widget .relay-bottom-nav__item--active .relay-bottom-nav__icon {
    background: hsl(var(--relay-text));
    color: hsl(var(--relay-bg));
  }

  #relay-widget .relay-bottom-nav__icon {
    width: 28px;
    height: 28px;
    padding: 4px;
    border-radius: 8px;
    transition: all 0.15s ease;
  }

  #relay-widget .relay-bottom-nav__icon svg {
    width: 100%;
    height: 100%;
  }

  #relay-widget .relay-bottom-nav__label {
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.01em;
  }

  #relay-widget .relay-bottom-nav__badge {
    position: absolute;
    top: 4px;
    right: 8px;
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    background: hsl(var(--relay-error));
    color: white;
    font-size: 10px;
    font-weight: 700;
    border-radius: 9px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
`, B = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><path d="M9 22V12h6v10"/></svg>',
  homeActive: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>',
  messages: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>',
  messagesActive: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>',
  help: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>',
  helpActive: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="17" r="1" fill="white"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" stroke="white" stroke-width="2" fill="none"/></svg>',
  roadmap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.5 10c-.83 0-1.5-.67-1.5-1.5v-5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5z"/><path d="M20.5 10H19V8.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/><path d="M9.5 14c.83 0 1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5S8 21.33 8 20.5v-5c0-.83.67-1.5 1.5-1.5z"/><path d="M3.5 14H5v1.5c0 .83-.67 1.5-1.5 1.5S2 16.33 2 15.5 2.67 14 3.5 14z"/><path d="M14 14.5c0-.83.67-1.5 1.5-1.5h5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-5c-.83 0-1.5-.67-1.5-1.5z"/><path d="M15.5 19H14v1.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5-.67-1.5-1.5-1.5z"/><path d="M10 9.5c0 .83-.67 1.5-1.5 1.5h-5C2.67 11 2 10.33 2 9.5S2.67 8 3.5 8h5c.83 0 1.5.67 1.5 1.5z"/><path d="M8.5 5H10V3.5c0-.83-.67-1.5-1.5-1.5S7 2.67 7 3.5 7.67 5 8.5 5z"/></svg>',
  roadmapActive: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M14.5 10c-.83 0-1.5-.67-1.5-1.5v-5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5z"/><path d="M20.5 10H19V8.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/><path d="M9.5 14c.83 0 1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5S8 21.33 8 20.5v-5c0-.83.67-1.5 1.5-1.5z"/><path d="M3.5 14H5v1.5c0 .83-.67 1.5-1.5 1.5S2 16.33 2 15.5 2.67 14 3.5 14z"/><path d="M14 14.5c0-.83.67-1.5 1.5-1.5h5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-5c-.83 0-1.5-.67-1.5-1.5z"/><path d="M15.5 19H14v1.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5-.67-1.5-1.5-1.5z"/><path d="M10 9.5c0 .83-.67 1.5-1.5 1.5h-5C2.67 11 2 10.33 2 9.5S2.67 8 3.5 8h5c.83 0 1.5.67 1.5 1.5z"/><path d="M8.5 5H10V3.5c0-.83-.67-1.5-1.5-1.5S7 2.67 7 3.5 7.67 5 8.5 5z"/></svg>'
};
function Pt(h) {
  const {
    activeTab: e,
    onTabChange: t,
    showMessages: r = !0,
    showHelp: a = !1,
    // Knowledge Base cut from MVP
    showRoadmap: s = !0,
    unreadCount: i = 0
  } = h;
  let l = e, o = i;
  const c = d("nav", { class: "relay-bottom-nav" }), p = [
    { id: "home", label: "Home", show: !0 },
    { id: "messages", label: "Messages", show: r },
    { id: "help", label: "Help", show: a },
    { id: "roadmap", label: "Roadmap", show: s }
  ], y = /* @__PURE__ */ new Map(), n = /* @__PURE__ */ new Map();
  p.forEach(({ id: g, label: f, show: x }) => {
    if (!x)
      return;
    const m = d("button", {
      type: "button",
      class: `relay-bottom-nav__item ${g === l ? "relay-bottom-nav__item--active" : ""}`
    }), v = d("span", { class: "relay-bottom-nav__icon" });
    v.innerHTML = g === l && B[`${g}Active`] || B[g];
    const _ = d(
      "span",
      { class: "relay-bottom-nav__label" },
      [f]
    );
    if (g === "messages") {
      const b = d("span", { class: "relay-bottom-nav__badge" });
      b.style.display = o > 0 ? "flex" : "none", b.textContent = o > 99 ? "99+" : String(o), m.appendChild(b), n.set(g, b);
    }
    m.appendChild(v), m.appendChild(_), m.addEventListener("click", () => {
      g !== l && (u(g), t(g));
    }), y.set(g, m), c.appendChild(m);
  });
  const u = (g) => {
    const f = y.get(l), x = y.get(g);
    if (f) {
      f.classList.remove("relay-bottom-nav__item--active");
      const m = f.querySelector(".relay-bottom-nav__icon");
      m && (m.innerHTML = B[l]);
    }
    if (x) {
      x.classList.add("relay-bottom-nav__item--active");
      const m = x.querySelector(".relay-bottom-nav__icon");
      m && (m.innerHTML = B[`${g}Active`] || B[g]);
    }
    l = g;
  };
  return {
    element: c,
    setActiveTab: u,
    setUnreadCount: (g) => {
      o = g;
      const f = n.get("messages");
      f && (f.style.display = g > 0 ? "flex" : "none", f.textContent = g > 99 ? "99+" : String(g));
    }
  };
}
const U = [
  {
    id: "conv-1",
    subject: "Login issue",
    lastMessage: {
      body: "Thanks for reaching out! We're looking into this.",
      direction: "outbound",
      createdAt: "2024-01-15T10:30:00Z"
    },
    unreadCount: 0,
    createdAt: "2024-01-15T10:00:00Z"
  },
  {
    id: "conv-2",
    subject: "How do I export data?",
    lastMessage: {
      body: "How do I export my data to CSV?",
      direction: "inbound",
      createdAt: "2024-01-14T15:20:00Z"
    },
    unreadCount: 1,
    createdAt: "2024-01-14T15:00:00Z"
  },
  {
    id: "conv-3",
    subject: "Feature suggestion",
    lastMessage: {
      body: "That's a great idea! We'll add it to our roadmap.",
      direction: "outbound",
      createdAt: "2024-01-10T09:00:00Z"
    },
    unreadCount: 0,
    createdAt: "2024-01-10T08:30:00Z"
  }
], $ = {
  "conv-1": [
    {
      id: "msg-1",
      conversationId: "conv-1",
      body: "Hi, I'm having trouble logging in. It keeps saying my password is incorrect.",
      direction: "inbound",
      createdAt: "2024-01-15T10:00:00Z"
    },
    {
      id: "msg-2",
      conversationId: "conv-1",
      body: `Hi! Sorry to hear you're having trouble. Can you try resetting your password using the "Forgot Password" link?`,
      direction: "outbound",
      createdAt: "2024-01-15T10:05:00Z"
    },
    {
      id: "msg-3",
      conversationId: "conv-1",
      body: "I tried that but I'm not receiving the reset email.",
      direction: "inbound",
      createdAt: "2024-01-15T10:15:00Z"
    },
    {
      id: "msg-4",
      conversationId: "conv-1",
      body: "Thanks for reaching out! We're looking into this.",
      direction: "outbound",
      createdAt: "2024-01-15T10:30:00Z"
    }
  ],
  "conv-2": [
    {
      id: "msg-5",
      conversationId: "conv-2",
      body: "How do I export my data to CSV?",
      direction: "inbound",
      createdAt: "2024-01-14T15:00:00Z"
    }
  ],
  "conv-3": [
    {
      id: "msg-6",
      conversationId: "conv-3",
      body: "It would be great if you could add dark mode to the dashboard.",
      direction: "inbound",
      createdAt: "2024-01-10T08:30:00Z"
    },
    {
      id: "msg-7",
      conversationId: "conv-3",
      body: "That's a great idea! We'll add it to our roadmap.",
      direction: "outbound",
      createdAt: "2024-01-10T09:00:00Z"
    }
  ]
}, me = [
  {
    id: "rm-1",
    title: "Mobile SDK",
    description: "Native iOS and Android SDK support for mobile applications",
    status: "in_progress",
    voteCount: 23,
    hasVoted: !1
  },
  {
    id: "rm-2",
    title: "GitHub Integration",
    description: "Automatically create GitHub issues from bug reports",
    status: "planned",
    voteCount: 45,
    hasVoted: !0
  },
  {
    id: "rm-3",
    title: "Session Replay",
    description: "Watch user sessions to understand context behind issues",
    status: "shipped",
    voteCount: 67,
    hasVoted: !1
  },
  {
    id: "rm-4",
    title: "Slack Integration",
    description: "Get notified about new feedback directly in Slack",
    status: "shipped",
    voteCount: 34,
    hasVoted: !0
  },
  {
    id: "rm-5",
    title: "Custom Fields",
    description: "Add custom fields to bug reports and feedback forms",
    status: "planned",
    voteCount: 28,
    hasVoted: !1
  },
  {
    id: "rm-6",
    title: "AI-Powered Triage",
    description: "Automatically categorize and prioritize incoming feedback",
    status: "in_progress",
    voteCount: 52,
    hasVoted: !1
  },
  {
    id: "rm-7",
    title: "Dark Mode",
    description: "Support for dark mode in the widget and dashboard",
    status: "shipped",
    voteCount: 89,
    hasVoted: !0
  },
  {
    id: "rm-8",
    title: "API Webhooks",
    description: "Trigger webhooks when feedback is submitted",
    status: "planned",
    voteCount: 19,
    hasVoted: !1
  }
];
function Nt() {
  return [...U];
}
function Vt(h) {
  return $[h] || [];
}
function Ot() {
  return [...me];
}
function jt(h) {
  const e = me.find((t) => t.id === h);
  return e ? (e.hasVoted = !e.hasVoted, e.voteCount += e.hasVoted ? 1 : -1, { ...e }) : null;
}
let fe = 100;
function qt(h, e) {
  const t = {
    id: `msg-${++fe}`,
    conversationId: h,
    body: e,
    direction: "inbound",
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  $[h] || ($[h] = []), $[h].push(t);
  const r = U.find((a) => a.id === h);
  return r && (r.lastMessage = {
    body: e,
    direction: "inbound",
    createdAt: t.createdAt
  }), t;
}
let Ut = 10;
function Wt(h, e) {
  const t = (/* @__PURE__ */ new Date()).toISOString(), r = `conv-${++Ut}`, a = {
    id: r,
    subject: h,
    lastMessage: {
      body: e,
      direction: "inbound",
      createdAt: t
    },
    unreadCount: 0,
    createdAt: t
  };
  return U.unshift(a), $[r] = [
    {
      id: `msg-${++fe}`,
      conversationId: r,
      body: e,
      direction: "inbound",
      createdAt: t
    }
  ], a;
}
const Yt = `
  #relay-widget .relay-page-header {
    display: flex;
    align-items: center;
    padding: 16px 20px;
    border-bottom: 1px solid hsl(var(--relay-border));
    background: hsl(var(--relay-bg));
    flex-shrink: 0;
  }

  #relay-widget .relay-page-header__back {
    width: 32px;
    height: 32px;
    padding: 0;
    margin-right: 8px;
    background: none;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    color: hsl(var(--relay-text-muted));
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
    font-family: inherit;
  }

  #relay-widget .relay-page-header__back:hover {
    background: hsl(var(--relay-bg-secondary));
    color: hsl(var(--relay-text));
  }

  #relay-widget .relay-page-header__back svg {
    width: 20px;
    height: 20px;
  }

  #relay-widget .relay-page-header__title {
    flex: 1;
    font-size: 17px;
    font-weight: 600;
    color: hsl(var(--relay-text));
    margin: 0;
    letter-spacing: -0.01em;
  }

  #relay-widget .relay-page-header__close {
    width: 32px;
    height: 32px;
    padding: 0;
    margin-left: 8px;
    background: none;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    color: hsl(var(--relay-text-muted));
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
    font-family: inherit;
  }

  #relay-widget .relay-page-header__close:hover {
    background: hsl(var(--relay-bg-secondary));
    color: hsl(var(--relay-text));
  }

  #relay-widget .relay-page-header__close svg {
    width: 18px;
    height: 18px;
  }

  #relay-widget .relay-page-content {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
  }

  #relay-widget .relay-empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 48px 24px;
    text-align: center;
    flex: 1;
    min-height: 300px;
  }

  #relay-widget .relay-empty-state__icon {
    width: 48px;
    height: 48px;
    margin-bottom: 16px;
    color: hsl(var(--relay-text-subtle));
  }

  #relay-widget .relay-empty-state__icon svg {
    width: 100%;
    height: 100%;
  }

  #relay-widget .relay-empty-state__title {
    font-size: 17px;
    font-weight: 600;
    color: hsl(var(--relay-text));
    margin: 0 0 4px;
  }

  #relay-widget .relay-empty-state__text {
    font-size: 14px;
    color: hsl(var(--relay-text-muted));
    margin: 0 0 20px;
  }

  #relay-widget .relay-toast {
    position: absolute;
    bottom: 70px;
    left: 16px;
    right: 16px;
    padding: 12px 16px;
    background: hsl(var(--relay-error));
    color: white;
    font-size: 14px;
    font-weight: 500;
    border-radius: 10px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 100;
    animation: relay-slide-up 0.2s ease-out;
  }

  #relay-widget .relay-toast--success {
    background: hsl(var(--relay-success));
  }

  #relay-widget .relay-toast--exit {
    animation: relay-slide-down 0.15s ease-in forwards;
  }

  /* Help styles */
  #relay-widget .relay-help-search {
    padding: 12px 16px;
    border-bottom: 1px solid hsl(var(--relay-border));
  }

  #relay-widget .relay-help-search__input {
    width: 100%;
    padding: 10px 12px 10px 36px;
    border: 1px solid hsl(var(--relay-border));
    border-radius: 8px;
    background: hsl(var(--relay-bg-secondary));
    color: hsl(var(--relay-text));
    font-size: 14px;
    outline: none;
    transition: border-color 0.15s ease;
  }

  #relay-widget .relay-help-search__input:focus {
    border-color: hsl(var(--relay-primary));
  }

  #relay-widget .relay-help-search__input::placeholder {
    color: hsl(var(--relay-text-muted));
  }

  #relay-widget .relay-help-search__wrapper {
    position: relative;
  }

  #relay-widget .relay-help-search__icon {
    position: absolute;
    left: 12px;
    top: 50%;
    transform: translateY(-50%);
    width: 16px;
    height: 16px;
    color: hsl(var(--relay-text-muted));
  }

  #relay-widget .relay-help-categories {
    padding: 12px 16px;
  }

  #relay-widget .relay-help-category {
    padding: 12px;
    margin-bottom: 8px;
    border: 1px solid hsl(var(--relay-border));
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  #relay-widget .relay-help-category:hover {
    border-color: hsl(var(--relay-primary));
    background: hsl(var(--relay-bg-secondary));
  }

  #relay-widget .relay-help-category__name {
    font-size: 14px;
    font-weight: 600;
    color: hsl(var(--relay-text));
    margin: 0 0 4px;
  }

  #relay-widget .relay-help-category__count {
    font-size: 12px;
    color: hsl(var(--relay-text-muted));
  }

  #relay-widget .relay-help-articles {
    padding: 0 16px 16px;
  }

  #relay-widget .relay-help-article-item {
    display: block;
    width: 100%;
    padding: 12px;
    margin-bottom: 8px;
    border: 1px solid hsl(var(--relay-border));
    border-radius: 8px;
    background: none;
    cursor: pointer;
    text-align: left;
    transition: all 0.15s ease;
    font-family: inherit;
  }

  #relay-widget .relay-help-article-item:hover {
    border-color: hsl(var(--relay-primary));
    background: hsl(var(--relay-bg-secondary));
  }

  #relay-widget .relay-help-article-item__title {
    font-size: 14px;
    font-weight: 500;
    color: hsl(var(--relay-text));
    margin: 0 0 4px;
  }

  #relay-widget .relay-help-article-item__excerpt {
    font-size: 13px;
    color: hsl(var(--relay-text-muted));
    margin: 0;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  #relay-widget .relay-help-article-content {
    padding: 16px;
  }

  #relay-widget .relay-help-article-content h1 {
    font-size: 20px;
    font-weight: 600;
    color: hsl(var(--relay-text));
    margin: 0 0 16px;
  }

  #relay-widget .relay-help-article-content .relay-article-body {
    font-size: 14px;
    line-height: 1.6;
    color: hsl(var(--relay-text));
  }

  #relay-widget .relay-help-article-content .relay-article-body p {
    margin: 0 0 12px;
  }

  #relay-widget .relay-help-article-content .relay-article-body a {
    color: hsl(var(--relay-primary));
  }

  #relay-widget .relay-help-section-title {
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: hsl(var(--relay-text-muted));
    margin: 0 0 8px;
    padding: 0 16px;
  }

  #relay-widget .relay-help-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 32px;
    color: hsl(var(--relay-text-muted));
  }
`, Kt = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>', se = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>';
class Gt {
  constructor(e) {
    this.container = null, this.trigger = null, this.modal = null, this.bottomNav = null, this.homePage = null, this.bugReportForm = null, this.feedbackForm = null, this.featureRequestForm = null, this.screenshotEditor = null, this.conversationList = null, this.messageThread = null, this.chatInput = null, this.currentConversation = null, this.messagePollingInterval = null, this.roadmapList = null, this.roadmapItems = [], this.helpCategories = [], this.helpArticles = [], this.currentHelpArticle = null, this.helpSearchQuery = "", this.currentView = "home", this.isOpen = !1, this.screenshotBlob = null, this.annotations = [], this.formDirty = !1, this.lastError = null, this.prefillData = {}, this.removeThemeListener = null, this.config = e.config, this.callbacks = e.callbacks, this.themeMode = e.themeMode || "auto", this.useMockData = e.useMockData ?? !1;
  }
  /**
   * Mounts the widget to the DOM
   */
  mount() {
    if (this.container)
      return;
    this.container = d("div", {
      id: "relay-widget"
    });
    const e = this.generateStyles(), t = He(e, "relay-widget-styles");
    this.container.appendChild(t), this.trigger = Bt({
      position: this.config.position || "bottom-right",
      onClick: () => this.toggle()
    }), this.container.appendChild(this.trigger.element), this.modal = Dt({
      position: this.config.position || "bottom-right",
      onClose: () => this.handleClose()
    }), this.container.appendChild(this.modal.overlay), this.container.appendChild(this.modal.element), this.bottomNav = Pt({
      activeTab: "home",
      showMessages: this.config.showChat !== !1,
      showHelp: !1,
      // Knowledge Base cut from MVP
      showRoadmap: this.config.showRoadmap !== !1,
      onTabChange: (r) => this.handleNavChange(r)
    }), this.homePage = ie({
      greeting: "Hi there!",
      subtitle: "How can we help you today?",
      onChatSubmit: (r) => this.handleChatSubmit(r),
      onReportBug: () => this.navigateTo("bug-report"),
      onRequestFeature: () => this.navigateTo("feature-request")
    }), this.renderCurrentView(), this.themeMode === "auto" && (this.removeThemeListener = $e(() => {
      this.updateTheme();
    })), document.body.appendChild(this.container);
  }
  /**
   * Unmounts the widget from the DOM
   */
  unmount() {
    var e, t;
    this.stopMessagePolling(), this.removeThemeListener && (this.removeThemeListener(), this.removeThemeListener = null), (e = this.trigger) == null || e.destroy(), (t = this.modal) == null || t.destroy(), this.container && (this.container.remove(), this.container = null), this.trigger = null, this.modal = null, this.bottomNav = null, this.homePage = null, this.bugReportForm = null, this.feedbackForm = null, this.featureRequestForm = null, this.conversationList = null, this.messageThread = null, this.chatInput = null, this.currentConversation = null, this.roadmapList = null;
  }
  /**
   * Opens the widget
   */
  open(e) {
    var t, r, a;
    if (this.isOpen) {
      e && e !== this.currentView && this.navigateTo(e);
      return;
    }
    this.isOpen = !0, (t = this.trigger) == null || t.setOpen(!0), (r = this.modal) == null || r.open(), e ? this.navigateTo(e) : (a = this.homePage) == null || a.focus();
  }
  /**
   * Closes the widget
   */
  close() {
    var e, t;
    this.isOpen && this.confirmDiscard() && (this.stopMessagePolling(), this.isOpen = !1, this.formDirty = !1, (e = this.trigger) == null || e.setOpen(!1), (t = this.modal) == null || t.close(), setTimeout(() => {
      this.isOpen || this.navigateTo("home");
    }, 200));
  }
  /**
   * Toggles the widget open/closed state
   */
  toggle() {
    this.isOpen ? this.close() : this.open();
  }
  /**
   * Returns whether the widget is currently open
   */
  isWidgetOpen() {
    return this.isOpen;
  }
  /**
   * Sets the notification badge count
   */
  setBadge(e) {
    var t, r;
    (t = this.trigger) == null || t.setBadge(e), (r = this.bottomNav) == null || r.setUnreadCount(e || 0);
  }
  /**
   * Updates widget configuration
   */
  updateConfig(e) {
    var t, r;
    this.config = { ...this.config, ...e }, e.position && ((t = this.trigger) == null || t.updatePosition(e.position), (r = this.modal) == null || r.updatePosition(e.position)), e.primaryColor && this.updateTheme();
  }
  /**
   * Set prefill data for forms
   */
  setPrefillData(e) {
    this.prefillData = e, this.bugReportForm && this.bugReportForm.setPrefillData({
      title: e.title,
      description: e.description
    }), this.featureRequestForm && this.featureRequestForm.setPrefillData({
      title: e.title,
      description: e.description,
      category: e.category
    });
  }
  /**
   * Show a specific survey by ID
   */
  showSurvey(e) {
    console.log("[Relay Widget] Survey requested:", e);
  }
  // ============================================================================
  // Private methods
  // ============================================================================
  generateStyles() {
    const e = (t) => {
      let r = t.replace(/\.relay-/g, "#relay-widget .relay-");
      return r = r.replace(
        /#relay-widget\s+#relay-widget/g,
        "#relay-widget"
      ), r;
    };
    return `
      ${Pe(this.themeMode, this.config.primaryColor)}
      ${Ne()}
      ${Rt}
      ${Ft}
      ${$t}
      ${Yt}
      ${It}
      ${Ke}
      ${e(at)}
      ${e(dt)}
      ${e(wt)}
      ${e(Mt)}
    `;
  }
  updateTheme() {
    var t;
    const e = (t = this.container) == null ? void 0 : t.querySelector("#relay-widget-styles");
    e && (e.textContent = this.generateStyles());
  }
  handleClose() {
    var e;
    this.isOpen = !1, (e = this.trigger) == null || e.setOpen(!1);
  }
  handleNavChange(e) {
    switch (e) {
      case "home":
        this.navigateTo("home");
        break;
      case "messages":
        this.navigateTo("messages");
        break;
      case "help":
        this.navigateTo("help");
        break;
      case "roadmap":
        this.navigateTo("roadmap");
        break;
    }
  }
  navigateTo(e) {
    var t;
    this.currentView = e, this.renderCurrentView(), (e === "home" || e === "messages" || e === "help" || e === "roadmap") && ((t = this.bottomNav) == null || t.setActiveTab(e)), e === "bug-report" && !this.screenshotBlob && this.captureScreenshot();
  }
  renderCurrentView() {
    if (!this.modal)
      return;
    const e = this.modal.contentEl;
    switch (e.innerHTML = "", this.currentView) {
      case "home":
        this.renderHomeView(e);
        break;
      case "messages":
        this.renderMessagesView(e);
        break;
      case "messages-thread":
        this.renderMessageThreadView(e);
        break;
      case "roadmap":
        this.renderRoadmapView(e);
        break;
      case "help":
        this.renderHelpView(e);
        break;
      case "help-article":
        this.renderHelpArticleView(e);
        break;
      case "bug-report":
        this.renderBugReportView(e);
        break;
      case "feature-request":
        this.renderFeatureRequestView(e);
        break;
      default:
        this.renderHomeView(e);
    }
  }
  renderHomeView(e) {
    const t = d("div", {
      class: "relay-view-wrapper"
    });
    t.style.cssText = "display: flex; flex-direction: column; height: 100%;";
    const r = d("div", { class: "relay-page-header" });
    r.style.borderBottom = "none", r.style.justifyContent = "flex-end";
    const a = d("button", {
      type: "button",
      class: "relay-page-header__close"
    });
    a.innerHTML = se, a.setAttribute("aria-label", "Close"), a.addEventListener("click", () => this.close()), r.appendChild(a), this.homePage || (this.homePage = ie({
      greeting: "Hi there!",
      subtitle: "How can we help you today?",
      onChatSubmit: (s) => this.handleChatSubmit(s),
      onReportBug: () => this.navigateTo("bug-report"),
      onRequestFeature: () => this.navigateTo("feature-request")
    })), t.appendChild(r), t.appendChild(this.homePage.element), this.bottomNav && t.appendChild(this.bottomNav.element), e.appendChild(t);
  }
  renderMessagesView(e) {
    const t = d("div");
    t.style.cssText = "display: flex; flex-direction: column; height: 100%;";
    const r = this.createPageHeader("Messages", !1), a = d("div", { class: "relay-page-content" });
    this.conversationList = yt({
      conversations: [],
      onSelect: (s) => {
        this.currentConversation = s, this.navigateTo("messages-thread");
      },
      loading: !0
    }), a.appendChild(this.conversationList.element), t.appendChild(r), t.appendChild(a), this.bottomNav && t.appendChild(this.bottomNav.element), e.appendChild(t), this.fetchConversations();
  }
  async fetchConversations() {
    var e, t, r, a, s, i, l;
    try {
      if (this.useMockData) {
        const o = Nt();
        (e = this.conversationList) == null || e.setConversations(o), (t = this.conversationList) == null || t.setLoading(!1);
        const c = o.reduce(
          (p, y) => p + y.unreadCount,
          0
        );
        (r = this.bottomNav) == null || r.setUnreadCount(c);
      } else {
        const o = await this.callbacks.onFetchConversations();
        (a = this.conversationList) == null || a.setConversations(
          o.map((p) => ({
            id: p.id,
            subject: p.subject || "New conversation",
            lastMessage: p.lastMessage || {
              body: "",
              direction: "inbound",
              createdAt: p.createdAt
            },
            unreadCount: p.unreadCount,
            createdAt: p.createdAt
          }))
        ), (s = this.conversationList) == null || s.setLoading(!1);
        const c = o.reduce(
          (p, y) => p + y.unreadCount,
          0
        );
        (i = this.bottomNav) == null || i.setUnreadCount(c);
      }
    } catch (o) {
      console.error("[Relay] Failed to fetch conversations:", o), (l = this.conversationList) == null || l.setLoading(!1), this.showError("Failed to load messages");
    }
  }
  renderMessageThreadView(e) {
    if (!this.currentConversation) {
      this.navigateTo("messages");
      return;
    }
    const t = d("div");
    t.style.cssText = "display: flex; flex-direction: column; height: 100%;";
    const r = this.createPageHeader(
      this.currentConversation.subject || "Conversation",
      !0,
      () => {
        this.stopMessagePolling(), this.currentConversation = null, this.navigateTo("messages");
      }
    );
    this.messageThread = ft({
      messages: [],
      hasMore: !1,
      loading: !0
    }), this.chatInput = vt({
      placeholder: "Type a message...",
      onSend: (a) => this.handleMessageSend(a)
    }), t.appendChild(r), t.appendChild(this.messageThread.element), t.appendChild(this.chatInput.element), e.appendChild(t), this.fetchMessages(), this.startMessagePolling();
  }
  async fetchMessages() {
    var e, t, r, a, s;
    if (this.currentConversation)
      try {
        if (this.useMockData) {
          const i = Vt(this.currentConversation.id);
          (e = this.messageThread) == null || e.setMessages(
            i.map((l) => ({
              id: l.id,
              body: l.body,
              direction: l.direction,
              createdAt: l.createdAt
            }))
          ), (t = this.messageThread) == null || t.setLoading(!1), setTimeout(() => {
            var l;
            return (l = this.messageThread) == null ? void 0 : l.scrollToBottom();
          }, 0);
        } else {
          const { messages: i, hasMore: l } = await this.callbacks.onFetchMessages(
            this.currentConversation.id
          );
          (r = this.messageThread) == null || r.setMessages(
            i.map((o) => ({
              id: o.id,
              body: o.body,
              direction: o.direction,
              createdAt: o.createdAt
            }))
          ), (a = this.messageThread) == null || a.setLoading(!1), setTimeout(() => {
            var o;
            return (o = this.messageThread) == null ? void 0 : o.scrollToBottom();
          }, 0), await this.callbacks.onMarkMessagesRead(this.currentConversation.id);
        }
      } catch (i) {
        console.error("[Relay] Failed to fetch messages:", i), (s = this.messageThread) == null || s.setLoading(!1), this.showError("Failed to load messages");
      }
  }
  startMessagePolling() {
    this.messagePollingInterval = setInterval(() => {
      this.currentConversation && this.currentView === "messages-thread" && this.pollForNewMessages();
    }, 5e3);
  }
  stopMessagePolling() {
    this.messagePollingInterval && (clearInterval(this.messagePollingInterval), this.messagePollingInterval = null);
  }
  async pollForNewMessages() {
    var e;
    if (!(!this.currentConversation || this.useMockData))
      try {
        const { messages: t } = await this.callbacks.onFetchMessages(
          this.currentConversation.id
        );
        (e = this.messageThread) == null || e.setMessages(
          t.map((r) => ({
            id: r.id,
            body: r.body,
            direction: r.direction,
            createdAt: r.createdAt
          }))
        );
      } catch (t) {
        console.warn("[Relay] Message polling failed:", t);
      }
  }
  renderBugReportView(e) {
    const t = d("div");
    t.style.cssText = "display: flex; flex-direction: column; height: 100%;";
    const r = this.createPageHeader("Report a Bug", !0), a = d("div", { class: "relay-page-content" });
    this.bugReportForm || (this.bugReportForm = Ze({
      showSeverity: !0,
      showScreenshot: !0,
      showLogs: !0,
      showAttachments: !0,
      onSubmit: (s) => this.handleBugSubmit(s),
      onScreenshotEdit: () => this.openScreenshotEditor(),
      onFormChange: () => this.setFormDirty(!0)
    })), this.screenshotBlob && this.bugReportForm.setScreenshotPreview(this.screenshotBlob), a.appendChild(this.bugReportForm.element), t.appendChild(r), t.appendChild(a), e.appendChild(t);
  }
  renderFeatureRequestView(e) {
    const t = d("div");
    t.style.cssText = "display: flex; flex-direction: column; height: 100%;";
    const r = this.createPageHeader("Request a Feature", !0), a = d("div", { class: "relay-page-content" });
    this.featureRequestForm || (this.featureRequestForm = tt({
      showAttachments: !0,
      onSubmit: (s) => this.handleFeatureRequestSubmit(s),
      onFormChange: () => this.setFormDirty(!0)
    })), a.appendChild(this.featureRequestForm.element), t.appendChild(r), t.appendChild(a), e.appendChild(t);
  }
  renderRoadmapView(e) {
    const t = d("div");
    t.style.cssText = "display: flex; flex-direction: column; height: 100%;";
    const r = this.createPageHeader("Roadmap", !1), a = d("div", { class: "relay-page-content" });
    this.roadmapList = Tt({
      items: [],
      onVote: (s) => this.handleRoadmapVote(s),
      loading: !0,
      groupByStatus: !0
    }), a.appendChild(this.roadmapList.element), t.appendChild(r), t.appendChild(a), this.bottomNav && t.appendChild(this.bottomNav.element), e.appendChild(t), this.fetchRoadmap();
  }
  async fetchRoadmap() {
    var e, t, r, a, s;
    try {
      if (this.useMockData) {
        const i = Ot();
        this.roadmapItems = i, (e = this.roadmapList) == null || e.setItems(i), (t = this.roadmapList) == null || t.setLoading(!1);
      } else {
        const i = await this.callbacks.onFetchRoadmap();
        this.roadmapItems = i.map((l) => ({
          id: l.id,
          title: l.title,
          description: l.description || "",
          status: l.status,
          voteCount: l.voteCount,
          hasVoted: l.hasVoted
        })), (r = this.roadmapList) == null || r.setItems(this.roadmapItems), (a = this.roadmapList) == null || a.setLoading(!1);
      }
    } catch (i) {
      console.error("[Relay] Failed to fetch roadmap:", i), (s = this.roadmapList) == null || s.setLoading(!1), this.showError("Failed to load roadmap");
    }
  }
  // ============================================================================
  // Help View
  // ============================================================================
  renderHelpView(e) {
    const t = d("div");
    t.style.cssText = "display: flex; flex-direction: column; height: 100%;";
    const r = this.createPageHeader("Help Center", !1), a = d("div", { class: "relay-help-search" }), s = d("div", {
      class: "relay-help-search__wrapper"
    }), i = d("span", {
      class: "relay-help-search__icon"
    });
    i.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>';
    const l = d("input", {
      type: "text",
      class: "relay-help-search__input",
      placeholder: "Search articles..."
    });
    l.value = this.helpSearchQuery;
    let o;
    l.addEventListener("input", (y) => {
      const n = y.target.value;
      this.helpSearchQuery = n, clearTimeout(o), o = setTimeout(() => {
        this.searchHelpArticles(n);
      }, 300);
    }), s.appendChild(i), s.appendChild(l), a.appendChild(s);
    const c = d("div", { class: "relay-page-content" }), p = d("div", { class: "relay-help-loading" }, [
      "Loading..."
    ]);
    c.appendChild(p), t.appendChild(r), t.appendChild(a), t.appendChild(c), this.bottomNav && t.appendChild(this.bottomNav.element), e.appendChild(t), this.fetchHelpData(c);
  }
  async fetchHelpData(e) {
    try {
      if (this.useMockData)
        this.helpCategories = [
          { id: "1", name: "Getting Started", articleCount: 3 },
          { id: "2", name: "Account & Billing", articleCount: 5 },
          { id: "3", name: "Troubleshooting", articleCount: 4 }
        ], this.helpArticles = [
          {
            id: "1",
            slug: "quick-start",
            title: "Quick Start Guide",
            excerpt: "Get up and running in minutes"
          },
          {
            id: "2",
            slug: "installation",
            title: "Installation",
            excerpt: "How to install the SDK"
          },
          {
            id: "3",
            slug: "configuration",
            title: "Configuration Options",
            excerpt: "Customize your setup"
          }
        ];
      else {
        const [t, r] = await Promise.all([
          this.callbacks.onFetchHelpCategories(),
          this.callbacks.onFetchHelpArticles()
        ]);
        this.helpCategories = t, this.helpArticles = r;
      }
      this.renderHelpContent(e);
    } catch (t) {
      console.error("[Relay] Failed to fetch help data:", t), e.innerHTML = "";
      const r = d("div", { class: "relay-empty-state" });
      r.innerHTML = `
        <div class="relay-empty-state__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg></div>
        <h3 class="relay-empty-state__title">Unable to load help</h3>
        <p class="relay-empty-state__text">Please try again later</p>
      `, e.appendChild(r);
    }
  }
  renderHelpContent(e) {
    if (e.innerHTML = "", this.helpSearchQuery) {
      const t = d("div", {
        class: "relay-help-articles"
      }), r = d("h3", { class: "relay-help-section-title" }, [
        "Search Results"
      ]);
      if (e.appendChild(r), this.helpArticles.length === 0) {
        const a = d("div", { class: "relay-empty-state" });
        a.innerHTML = `
          <div class="relay-empty-state__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg></div>
          <h3 class="relay-empty-state__title">No results found</h3>
          <p class="relay-empty-state__text">Try a different search term</p>
        `, t.appendChild(a);
      } else
        this.helpArticles.forEach((a) => {
          const s = this.createArticleItem(a);
          t.appendChild(s);
        });
      e.appendChild(t);
      return;
    }
    if (this.helpCategories.length > 0) {
      const t = d("div", {
        class: "relay-help-categories"
      }), r = d("h3", { class: "relay-help-section-title" }, [
        "Categories"
      ]);
      e.appendChild(r), this.helpCategories.forEach((a) => {
        const s = d("div", { class: "relay-help-category" });
        s.innerHTML = `
          <h4 class="relay-help-category__name">${this.escapeHtml(a.name)}</h4>
          <span class="relay-help-category__count">${a.articleCount} articles</span>
        `, s.addEventListener("click", () => {
          this.filterArticlesByCategory(a.id, e);
        }), t.appendChild(s);
      }), e.appendChild(t);
    }
    if (this.helpArticles.length > 0) {
      const t = d("div", {
        class: "relay-help-articles"
      }), r = d("h3", { class: "relay-help-section-title" }, [
        "Popular Articles"
      ]);
      e.appendChild(r), this.helpArticles.slice(0, 5).forEach((a) => {
        const s = this.createArticleItem(a);
        t.appendChild(s);
      }), e.appendChild(t);
    }
    if (this.helpCategories.length === 0 && this.helpArticles.length === 0) {
      const t = d("div", { class: "relay-empty-state" });
      t.innerHTML = `
        <div class="relay-empty-state__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg></div>
        <h3 class="relay-empty-state__title">No help articles yet</h3>
        <p class="relay-empty-state__text">Check back soon</p>
      `, e.appendChild(t);
    }
  }
  createArticleItem(e) {
    const t = d("button", {
      type: "button",
      class: "relay-help-article-item"
    });
    return t.innerHTML = `
      <h4 class="relay-help-article-item__title">${this.escapeHtml(e.title)}</h4>
      ${e.excerpt ? `<p class="relay-help-article-item__excerpt">${this.escapeHtml(e.excerpt)}</p>` : ""}
    `, t.addEventListener("click", () => {
      this.openHelpArticle(e.slug);
    }), t;
  }
  async searchHelpArticles(e) {
    var t, r;
    if (!e.trim()) {
      const a = (t = this.modal) == null ? void 0 : t.contentEl.querySelector(
        ".relay-page-content"
      );
      a && await this.fetchHelpData(a);
      return;
    }
    try {
      this.useMockData ? this.helpArticles = [
        {
          id: "1",
          slug: "quick-start",
          title: "Quick Start Guide",
          excerpt: "Get up and running in minutes"
        }
      ].filter((s) => s.title.toLowerCase().includes(e.toLowerCase())) : this.helpArticles = await this.callbacks.onSearchHelpArticles(e);
      const a = (r = this.modal) == null ? void 0 : r.contentEl.querySelector(
        ".relay-page-content"
      );
      a && this.renderHelpContent(a);
    } catch (a) {
      console.error("[Relay] Help search failed:", a);
    }
  }
  async filterArticlesByCategory(e, t) {
    try {
      this.useMockData || (this.helpArticles = await this.callbacks.onFetchHelpArticles(e)), this.renderHelpContent(t);
    } catch (r) {
      console.error("[Relay] Failed to filter articles:", r);
    }
  }
  async openHelpArticle(e) {
    try {
      if (this.useMockData)
        this.currentHelpArticle = {
          id: "1",
          slug: e,
          title: "Sample Article",
          content: `This is a sample help article content.

It can have multiple paragraphs.`
        };
      else {
        const t = await this.callbacks.onFetchHelpArticle(e);
        if (!t) {
          this.showError("Article not found");
          return;
        }
        this.currentHelpArticle = t;
      }
      this.navigateTo("help-article");
    } catch (t) {
      console.error("[Relay] Failed to load article:", t), this.showError("Failed to load article");
    }
  }
  renderHelpArticleView(e) {
    if (!this.currentHelpArticle) {
      this.navigateTo("help");
      return;
    }
    const t = d("div");
    t.style.cssText = "display: flex; flex-direction: column; height: 100%;";
    const r = this.createPageHeader("Help", !0, () => {
      this.currentHelpArticle = null, this.navigateTo("help");
    }), a = d("div", { class: "relay-page-content" }), s = d("div", {
      class: "relay-help-article-content"
    }), i = d("h1", {}, [this.currentHelpArticle.title]);
    s.appendChild(i);
    const l = d("div", { class: "relay-article-body" });
    this.currentHelpArticle.contentHtml ? l.innerHTML = this.currentHelpArticle.contentHtml : this.currentHelpArticle.content && (l.innerHTML = this.currentHelpArticle.content.split(`

`).map((o) => `<p>${this.escapeHtml(o).replace(/\n/g, "<br>")}</p>`).join("")), s.appendChild(l), a.appendChild(s), t.appendChild(r), t.appendChild(a), e.appendChild(t);
  }
  escapeHtml(e) {
    const t = document.createElement("div");
    return t.textContent = e, t.innerHTML;
  }
  createPageHeader(e, t, r) {
    const a = d("div", { class: "relay-page-header" });
    if (t) {
      const l = d("button", {
        type: "button",
        class: "relay-page-header__back"
      });
      l.innerHTML = Kt, l.setAttribute("aria-label", "Go back"), l.addEventListener("click", () => {
        this.confirmDiscard() && (this.formDirty = !1, r ? r() : this.navigateTo("home"));
      }), a.appendChild(l);
    }
    const s = d("h2", { class: "relay-page-header__title" }, [
      e
    ]);
    a.appendChild(s);
    const i = d("button", {
      type: "button",
      class: "relay-page-header__close"
    });
    return i.innerHTML = se, i.setAttribute("aria-label", "Close"), i.addEventListener("click", () => this.close()), a.appendChild(i), a;
  }
  async captureScreenshot() {
    var e;
    try {
      this.container && (this.container.style.visibility = "hidden"), await new Promise((r) => setTimeout(r, 50));
      const t = await this.callbacks.onScreenshotCapture();
      this.container && (this.container.style.visibility = "visible"), t && (this.screenshotBlob = t, (e = this.bugReportForm) == null || e.setScreenshotPreview(t));
    } catch (t) {
      console.warn("[Relay] Screenshot capture failed:", t), this.container && (this.container.style.visibility = "visible");
    }
  }
  openScreenshotEditor() {
    this.screenshotBlob && (this.screenshotEditor = ct({
      screenshot: this.screenshotBlob,
      existingAnnotations: this.annotations,
      onSave: (e, t) => {
        var r;
        this.screenshotBlob = e, this.annotations = t, (r = this.bugReportForm) == null || r.setScreenshotPreview(e);
      },
      onCancel: () => {
        this.screenshotEditor = null;
      }
    }), this.screenshotEditor.open());
  }
  async handleChatSubmit(e) {
    try {
      if (this.useMockData) {
        const t = Wt(
          e.substring(0, 50) + (e.length > 50 ? "..." : ""),
          e
        );
        this.currentConversation = {
          id: t.id,
          subject: t.subject,
          lastMessage: t.lastMessage,
          unreadCount: t.unreadCount,
          createdAt: t.createdAt
        }, this.navigateTo("messages-thread");
      } else {
        const t = await this.callbacks.onStartConversation(e);
        this.currentConversation = {
          id: t.conversationId,
          subject: e.substring(0, 50) + (e.length > 50 ? "..." : ""),
          lastMessage: {
            body: e,
            direction: "inbound",
            createdAt: (/* @__PURE__ */ new Date()).toISOString()
          },
          unreadCount: 0,
          createdAt: (/* @__PURE__ */ new Date()).toISOString()
        }, this.navigateTo("messages-thread");
      }
    } catch (t) {
      console.error("[Relay] Chat message failed:", t), this.showError("Failed to start conversation");
    }
  }
  async handleBugSubmit(e) {
    var t;
    try {
      await this.callbacks.onBugSubmit({
        ...e,
        screenshotBlob: e.includeScreenshot && this.screenshotBlob || void 0,
        annotations: this.annotations
      }), this.formDirty = !1, (t = this.bugReportForm) == null || t.showSuccess(), setTimeout(() => {
        var r;
        (r = this.bugReportForm) == null || r.reset(), this.screenshotBlob = null, this.annotations = [], this.navigateTo("home");
      }, 2e3);
    } catch (r) {
      console.error("[Relay] Bug report submission failed:", r), this.showError("Failed to submit bug report. Please try again.");
    }
  }
  async handleFeedbackSubmit(e) {
    var t;
    try {
      await this.callbacks.onFeedbackSubmit(e), this.formDirty = !1, (t = this.feedbackForm) == null || t.showSuccess(), setTimeout(() => {
        var r;
        (r = this.feedbackForm) == null || r.reset(), this.navigateTo("home");
      }, 2e3);
    } catch (r) {
      console.error("[Relay] Feedback submission failed:", r), this.showError("Failed to submit feedback. Please try again.");
    }
  }
  async handleFeatureRequestSubmit(e) {
    var t;
    try {
      await this.callbacks.onFeatureRequestSubmit(e), this.formDirty = !1, (t = this.featureRequestForm) == null || t.showSuccess(), setTimeout(() => {
        var r;
        (r = this.featureRequestForm) == null || r.reset(), this.navigateTo("home");
      }, 2e3);
    } catch (r) {
      console.error("[Relay] Feature request submission failed:", r), this.showError("Failed to submit feature request. Please try again.");
    }
  }
  async handleMessageSend(e) {
    var a, s;
    if (!this.currentConversation)
      return;
    const r = {
      id: `temp-${Date.now()}`,
      body: e,
      direction: "inbound",
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    (a = this.messageThread) == null || a.addMessage(r), (s = this.chatInput) == null || s.clear();
    try {
      this.useMockData ? qt(this.currentConversation.id, e) : await this.callbacks.onSendMessage(
        this.currentConversation.id,
        e
      );
    } catch (i) {
      console.error("[Relay] Message send failed:", i), this.showError("Failed to send message");
    }
  }
  async handleRoadmapVote(e) {
    var a, s;
    const t = {
      ...e,
      hasVoted: !e.hasVoted,
      voteCount: e.voteCount + (e.hasVoted ? -1 : 1)
    };
    (a = this.roadmapList) == null || a.updateItem(t);
    const r = this.roadmapItems.findIndex((i) => i.id === e.id);
    r !== -1 && (this.roadmapItems[r] = t);
    try {
      this.useMockData ? jt(e.id) : e.hasVoted ? await this.callbacks.onUnvote(e.id) : await this.callbacks.onVote(e.id);
    } catch (i) {
      console.error("[Relay] Vote failed:", i), (s = this.roadmapList) == null || s.updateItem(e), r !== -1 && (this.roadmapItems[r] = e), this.showError("Failed to update vote");
    }
  }
  // ============================================================================
  // Error handling
  // ============================================================================
  showError(e) {
    this.lastError = e, console.error("[Relay]", e), this.showToast(e, "error");
  }
  showToast(e, t = "error") {
    if (!this.modal)
      return;
    const r = this.modal.contentEl.querySelector(".relay-toast");
    r && r.remove();
    const a = d(
      "div",
      {
        class: `relay-toast ${t === "success" ? "relay-toast--success" : ""}`
      },
      [e]
    );
    this.modal.contentEl.appendChild(a), setTimeout(() => {
      a.classList.add("relay-toast--exit"), setTimeout(() => a.remove(), 150);
    }, 3e3);
  }
  // ============================================================================
  // Form dirty state and discard confirmation
  // ============================================================================
  setFormDirty(e) {
    this.formDirty = e;
  }
  confirmDiscard() {
    return this.formDirty ? window.confirm(
      "You have unsaved changes. Are you sure you want to leave?"
    ) : !0;
  }
}
const Xt = `
  .relay-tour-overlay {
    position: fixed;
    inset: 0;
    z-index: 999998;
    pointer-events: none;
  }

  .relay-tour-spotlight {
    position: fixed;
    z-index: 999997;
    box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.5);
    border-radius: 4px;
    transition: all 0.3s ease;
    pointer-events: none;
  }

  .relay-tour-tooltip {
    position: fixed;
    z-index: 999999;
    width: 320px;
    background: white;
    border-radius: 12px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    animation: relay-tour-fade-in 0.2s ease;
    pointer-events: auto;
  }

  .relay-tour-tooltip--dark {
    background: #1a1a1a;
    color: white;
  }

  @keyframes relay-tour-fade-in {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .relay-tour-tooltip__arrow {
    position: absolute;
    width: 12px;
    height: 12px;
    background: white;
    transform: rotate(45deg);
  }

  .relay-tour-tooltip--dark .relay-tour-tooltip__arrow {
    background: #1a1a1a;
  }

  .relay-tour-tooltip__arrow--top {
    bottom: -6px;
    left: 50%;
    margin-left: -6px;
  }

  .relay-tour-tooltip__arrow--bottom {
    top: -6px;
    left: 50%;
    margin-left: -6px;
  }

  .relay-tour-tooltip__arrow--left {
    right: -6px;
    top: 50%;
    margin-top: -6px;
  }

  .relay-tour-tooltip__arrow--right {
    left: -6px;
    top: 50%;
    margin-top: -6px;
  }

  .relay-tour-tooltip__content {
    padding: 16px;
  }

  .relay-tour-tooltip__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 8px;
  }

  .relay-tour-tooltip__title {
    font-size: 15px;
    font-weight: 600;
    color: #111827;
    margin: 0;
  }

  .relay-tour-tooltip--dark .relay-tour-tooltip__title {
    color: white;
  }

  .relay-tour-tooltip__close {
    width: 24px;
    height: 24px;
    padding: 0;
    background: none;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    color: #9ca3af;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .relay-tour-tooltip__close:hover {
    background: rgba(0, 0, 0, 0.05);
    color: #6b7280;
  }

  .relay-tour-tooltip--dark .relay-tour-tooltip__close:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #9ca3af;
  }

  .relay-tour-tooltip__body {
    font-size: 14px;
    line-height: 1.5;
    color: #4b5563;
  }

  .relay-tour-tooltip--dark .relay-tour-tooltip__body {
    color: #9ca3af;
  }

  .relay-tour-tooltip__media {
    margin: 12px 0;
    border-radius: 8px;
    overflow: hidden;
  }

  .relay-tour-tooltip__media img,
  .relay-tour-tooltip__media video {
    width: 100%;
    display: block;
  }

  .relay-tour-tooltip__footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-top: 1px solid #f3f4f6;
    gap: 8px;
  }

  .relay-tour-tooltip--dark .relay-tour-tooltip__footer {
    border-top-color: #333;
  }

  .relay-tour-tooltip__progress {
    font-size: 12px;
    color: #9ca3af;
  }

  .relay-tour-tooltip__buttons {
    display: flex;
    gap: 8px;
  }

  .relay-tour-btn {
    padding: 8px 14px;
    font-family: inherit;
    font-size: 13px;
    font-weight: 500;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .relay-tour-btn--primary {
    background: #3b82f6;
    border: none;
    color: white;
  }

  .relay-tour-btn--primary:hover {
    background: #2563eb;
  }

  .relay-tour-btn--secondary {
    background: #f3f4f6;
    border: none;
    color: #374151;
  }

  .relay-tour-tooltip--dark .relay-tour-btn--secondary {
    background: #333;
    color: #d1d5db;
  }

  .relay-tour-btn--secondary:hover {
    background: #e5e7eb;
  }

  .relay-tour-tooltip--dark .relay-tour-btn--secondary:hover {
    background: #444;
  }

  .relay-tour-modal {
    position: fixed;
    inset: 0;
    z-index: 999999;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.5);
    animation: relay-tour-fade-in 0.2s ease;
  }

  .relay-tour-modal__content {
    width: 100%;
    max-width: 480px;
    max-height: 90vh;
    background: white;
    border-radius: 16px;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
    overflow: hidden;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  .relay-tour-beacon {
    position: fixed;
    z-index: 999999;
    width: 24px;
    height: 24px;
    cursor: pointer;
  }

  .relay-tour-beacon__dot {
    position: absolute;
    inset: 0;
    background: #3b82f6;
    border-radius: 50%;
    animation: relay-tour-beacon-pulse 2s ease infinite;
  }

  @keyframes relay-tour-beacon-pulse {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.5); opacity: 0.5; }
  }

  .relay-tour-beacon__ring {
    position: absolute;
    inset: -8px;
    border: 2px solid #3b82f6;
    border-radius: 50%;
    opacity: 0.5;
    animation: relay-tour-beacon-ring 2s ease infinite;
  }

  @keyframes relay-tour-beacon-ring {
    0%, 100% { transform: scale(1); opacity: 0.5; }
    50% { transform: scale(1.3); opacity: 0; }
  }
`;
class Zt {
  constructor(e) {
    this.currentTour = null, this.currentStepIndex = 0, this.container = null, this.styleElement = null, this.advanceListener = null, this.advanceListenerTarget = null, this.advanceListenerType = null, this.callbacks = e;
  }
  injectStyles() {
    this.styleElement || (this.styleElement = document.createElement("style"), this.styleElement.textContent = Xt, document.head.appendChild(this.styleElement));
  }
  async startTour(e) {
    this.injectStyles(), this.currentTour = e, this.currentStepIndex = e.currentStep || 0, await this.callbacks.onStart(e.id), this.renderStep();
  }
  renderStep() {
    if (!this.currentTour)
      return;
    this.cleanup();
    const e = this.currentTour.steps[this.currentStepIndex];
    if (!e) {
      this.completeTour();
      return;
    }
    switch (this.container = document.createElement("div"), this.container.className = "relay-tour-container", document.body.appendChild(this.container), e.type) {
      case "tooltip":
      case "highlight":
        this.renderTooltip(e);
        break;
      case "modal":
        this.renderModal(e);
        break;
      case "beacon":
        this.renderBeacon(e);
        break;
    }
    e.advanceOn && e.advanceSelector && this.setupAdvanceListener(e);
  }
  renderTooltip(e) {
    var y;
    if (!this.container)
      return;
    let t = null;
    if (e.target) {
      const n = document.querySelector(e.target);
      if (n && (t = n.getBoundingClientRect(), e.type === "highlight")) {
        const u = document.createElement("div");
        u.className = "relay-tour-spotlight", u.style.cssText = `
            left: ${t.left - 4}px;
            top: ${t.top - 4}px;
            width: ${t.width + 8}px;
            height: ${t.height + 8}px;
          `, this.container.appendChild(u);
      }
    }
    const r = document.createElement("div");
    r.className = "relay-tour-tooltip";
    const a = this.calculatePosition(t, e.position);
    if (r.style.cssText = `
      left: ${a.left}px;
      top: ${a.top}px;
    `, t) {
      const n = document.createElement("div");
      n.className = `relay-tour-tooltip__arrow relay-tour-tooltip__arrow--${a.arrowPosition}`, r.appendChild(n);
    }
    const s = document.createElement("div");
    s.className = "relay-tour-tooltip__content";
    const i = document.createElement("div");
    if (i.className = "relay-tour-tooltip__header", e.title) {
      const n = document.createElement("h4");
      n.className = "relay-tour-tooltip__title", n.textContent = e.title, i.appendChild(n);
    }
    if ((y = this.currentTour) != null && y.dismissible) {
      const n = document.createElement("button");
      n.className = "relay-tour-tooltip__close", n.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>', n.onclick = () => this.dismissTour(), i.appendChild(n);
    }
    s.appendChild(i);
    const l = document.createElement("div");
    if (l.className = "relay-tour-tooltip__body", l.textContent = e.content, s.appendChild(l), e.image || e.video) {
      const n = document.createElement("div");
      if (n.className = "relay-tour-tooltip__media", e.video) {
        const u = document.createElement("video");
        u.src = e.video, u.controls = !0, u.autoplay = !0, u.muted = !0, n.appendChild(u);
      } else if (e.image) {
        const u = document.createElement("img");
        u.src = e.image, u.alt = e.title || "", n.appendChild(u);
      }
      s.appendChild(n);
    }
    r.appendChild(s);
    const o = document.createElement("div");
    o.className = "relay-tour-tooltip__footer";
    const c = document.createElement("span");
    c.className = "relay-tour-tooltip__progress", c.textContent = `${this.currentStepIndex + 1} of ${this.currentTour.steps.length}`, o.appendChild(c);
    const p = document.createElement("div");
    if (p.className = "relay-tour-tooltip__buttons", e.secondaryButton) {
      const n = document.createElement("button");
      n.className = "relay-tour-btn relay-tour-btn--secondary", n.textContent = e.secondaryButton.label, n.onclick = () => this.handleSecondaryAction(e.secondaryButton.action), p.appendChild(n);
    } else if (this.currentStepIndex > 0) {
      const n = document.createElement("button");
      n.className = "relay-tour-btn relay-tour-btn--secondary", n.textContent = "Back", n.onclick = () => this.previousStep(), p.appendChild(n);
    }
    if (e.primaryButton) {
      const n = document.createElement("button");
      n.className = "relay-tour-btn relay-tour-btn--primary", n.textContent = e.primaryButton.label, n.onclick = () => this.handlePrimaryAction(e.primaryButton), p.appendChild(n);
    } else {
      const n = document.createElement("button");
      n.className = "relay-tour-btn relay-tour-btn--primary", n.textContent = this.currentStepIndex === this.currentTour.steps.length - 1 ? "Done" : "Next", n.onclick = () => this.nextStep(), p.appendChild(n);
    }
    o.appendChild(p), r.appendChild(o), this.container.appendChild(r);
  }
  renderModal(e) {
    var p, y;
    if (!this.container)
      return;
    const t = document.createElement("div");
    t.className = "relay-tour-modal";
    const r = document.createElement("div");
    r.className = "relay-tour-modal__content";
    const a = document.createElement("div");
    a.className = "relay-tour-tooltip__content";
    const s = document.createElement("div");
    if (s.className = "relay-tour-tooltip__header", e.title) {
      const n = document.createElement("h4");
      n.className = "relay-tour-tooltip__title", n.textContent = e.title, s.appendChild(n);
    }
    if ((p = this.currentTour) != null && p.dismissible) {
      const n = document.createElement("button");
      n.className = "relay-tour-tooltip__close", n.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>', n.onclick = () => this.dismissTour(), s.appendChild(n);
    }
    a.appendChild(s);
    const i = document.createElement("div");
    if (i.className = "relay-tour-tooltip__body", i.textContent = e.content, a.appendChild(i), e.image || e.video) {
      const n = document.createElement("div");
      if (n.className = "relay-tour-tooltip__media", e.video) {
        const u = document.createElement("video");
        u.src = e.video, u.controls = !0, u.autoplay = !0, u.muted = !0, n.appendChild(u);
      } else if (e.image) {
        const u = document.createElement("img");
        u.src = e.image, u.alt = e.title || "", n.appendChild(u);
      }
      a.appendChild(n);
    }
    r.appendChild(a);
    const l = document.createElement("div");
    l.className = "relay-tour-tooltip__footer";
    const o = document.createElement("span");
    o.className = "relay-tour-tooltip__progress", o.textContent = `${this.currentStepIndex + 1} of ${this.currentTour.steps.length}`, l.appendChild(o);
    const c = document.createElement("div");
    if (c.className = "relay-tour-tooltip__buttons", e.secondaryButton) {
      const n = document.createElement("button");
      n.className = "relay-tour-btn relay-tour-btn--secondary", n.textContent = e.secondaryButton.label, n.onclick = () => this.handleSecondaryAction(e.secondaryButton.action), c.appendChild(n);
    } else if (this.currentStepIndex > 0) {
      const n = document.createElement("button");
      n.className = "relay-tour-btn relay-tour-btn--secondary", n.textContent = "Back", n.onclick = () => this.previousStep(), c.appendChild(n);
    }
    if (e.primaryButton) {
      const n = document.createElement("button");
      n.className = "relay-tour-btn relay-tour-btn--primary", n.textContent = e.primaryButton.label, n.onclick = () => this.handlePrimaryAction(e.primaryButton), c.appendChild(n);
    } else {
      const n = document.createElement("button");
      n.className = "relay-tour-btn relay-tour-btn--primary", n.textContent = this.currentStepIndex === this.currentTour.steps.length - 1 ? "Done" : "Next", n.onclick = () => this.nextStep(), c.appendChild(n);
    }
    l.appendChild(c), r.appendChild(l), t.appendChild(r), (y = this.currentTour) != null && y.dismissible && (t.onclick = (n) => {
      n.target === t && this.dismissTour();
    }), this.container.appendChild(t);
  }
  renderBeacon(e) {
    if (!this.container || !e.target)
      return;
    const t = document.querySelector(e.target);
    if (!t)
      return;
    const r = t.getBoundingClientRect(), a = document.createElement("div");
    a.className = "relay-tour-beacon", a.style.cssText = `
      left: ${r.right + 8}px;
      top: ${r.top + r.height / 2 - 12}px;
    `;
    const s = document.createElement("div");
    s.className = "relay-tour-beacon__dot", a.appendChild(s);
    const i = document.createElement("div");
    i.className = "relay-tour-beacon__ring", a.appendChild(i), a.onclick = () => {
      const l = { ...e, type: "tooltip" };
      this.cleanup(), this.container = document.createElement("div"), this.container.className = "relay-tour-container", document.body.appendChild(this.container), this.renderTooltip(l);
    }, this.container.appendChild(a);
  }
  calculatePosition(e, t) {
    if (!e)
      return {
        left: (window.innerWidth - 320) / 2,
        top: (window.innerHeight - 200) / 2,
        arrowPosition: "bottom"
      };
    const i = {
      top: {
        left: e.left + e.width / 2 - 320 / 2,
        top: e.top - 200 - 12,
        arrowPosition: "top"
      },
      bottom: {
        left: e.left + e.width / 2 - 320 / 2,
        top: e.bottom + 12,
        arrowPosition: "bottom"
      },
      left: {
        left: e.left - 320 - 12,
        top: e.top + e.height / 2 - 200 / 2,
        arrowPosition: "left"
      },
      right: {
        left: e.right + 12,
        top: e.top + e.height / 2 - 200 / 2,
        arrowPosition: "right"
      }
    };
    if (t && t !== "auto") {
      const o = i[t];
      if (o)
        return o.left = Math.max(12, Math.min(o.left, window.innerWidth - 320 - 12)), o.top = Math.max(12, Math.min(o.top, window.innerHeight - 200 - 12)), o;
    }
    for (const o of ["bottom", "top", "right", "left"]) {
      const c = i[o];
      if (c.left >= 12 && c.left + 320 <= window.innerWidth - 12 && c.top >= 12 && c.top + 200 <= window.innerHeight - 12)
        return c;
    }
    const l = i.bottom;
    return l.left = Math.max(12, Math.min(l.left, window.innerWidth - 320 - 12)), l.top = Math.max(12, Math.min(l.top, window.innerHeight - 200 - 12)), l;
  }
  setupAdvanceListener(e) {
    if (!e.advanceSelector)
      return;
    const t = document.querySelector(e.advanceSelector);
    if (!t)
      return;
    const r = () => {
      this.nextStep();
    };
    e.advanceOn === "click" ? (t.addEventListener("click", r), this.advanceListener = r, this.advanceListenerTarget = t, this.advanceListenerType = "click") : e.advanceOn === "input" && (t.addEventListener("input", r), this.advanceListener = r, this.advanceListenerTarget = t, this.advanceListenerType = "input");
  }
  handlePrimaryAction(e) {
    if (e)
      switch (e.action) {
        case "next":
          this.nextStep();
          break;
        case "complete":
          this.completeTour();
          break;
        case "url":
          e.url && window.open(e.url, "_blank"), this.nextStep();
          break;
      }
  }
  handleSecondaryAction(e) {
    switch (e) {
      case "skip":
        this.nextStep();
        break;
      case "back":
        this.previousStep();
        break;
      case "dismiss":
        this.dismissTour();
        break;
    }
  }
  async nextStep() {
    this.currentTour && (this.currentStepIndex++, this.currentStepIndex >= this.currentTour.steps.length ? this.completeTour() : (await this.callbacks.onProgress(this.currentTour.id, this.currentStepIndex), this.renderStep()));
  }
  async previousStep() {
    !this.currentTour || this.currentStepIndex <= 0 || (this.currentStepIndex--, await this.callbacks.onProgress(this.currentTour.id, this.currentStepIndex), this.renderStep());
  }
  async completeTour() {
    this.currentTour && (await this.callbacks.onComplete(this.currentTour.id), this.cleanup(), this.currentTour = null, this.currentStepIndex = 0);
  }
  async dismissTour() {
    this.currentTour && (await this.callbacks.onDismiss(this.currentTour.id), this.cleanup(), this.currentTour = null, this.currentStepIndex = 0);
  }
  cleanup() {
    this.container && (this.container.remove(), this.container = null), this.advanceListener && this.advanceListenerTarget && this.advanceListenerType && this.advanceListenerTarget.removeEventListener(
      this.advanceListenerType,
      this.advanceListener
    ), this.advanceListener = null, this.advanceListenerTarget = null, this.advanceListenerType = null;
  }
  destroy() {
    this.cleanup(), this.styleElement && (this.styleElement.remove(), this.styleElement = null);
  }
}
class Jt {
  constructor() {
    this.config = null, this.api = null, this.sessionId = null, this.userId = null, this.initialized = !1, this.consoleCapture = we(), this.networkCapture = ke(), this.errorCapture = Ce(), this.replayCapture = null, this.replayId = null, this.eventHandlers = /* @__PURE__ */ new Map(), this.heartbeatInterval = null, this.widgetOpen = !1, this.widgetContainer = null, this.widget = null, this.prefillData = {}, this.customData = {}, this.tourRenderer = null, this.activeTours = [];
  }
  async init(e) {
    var s, i, l;
    if (this.initialized) {
      console.warn("[Relay] Already initialized");
      return;
    }
    this.config = e, ((s = e.widget) == null ? void 0 : s.autoShow) !== !1 && this.createWidget();
    const t = e.capture || {
      console: !0,
      network: !0,
      dom: !0
    };
    t.console && this.consoleCapture.start(), t.network && this.networkCapture.start(), t.dom && this.errorCapture.start(), this.api = new ve({
      apiKey: e.apiKey,
      endpoint: e.endpoint,
      regionHint: e.regionHint
    });
    const r = this.getDeviceInfo(), a = await this.api.createSession({
      id: (i = e.session) == null ? void 0 : i.id,
      userId: (l = e.user) == null ? void 0 : l.id,
      device: r,
      appVersion: e.appVersion,
      environment: e.environment || "production",
      userAgent: navigator.userAgent
    });
    this.sessionId = a.sessionId, this.api.setSessionId(this.sessionId), e.user && await this.identify(e.user), this.heartbeatInterval = setInterval(() => {
      var o;
      (o = this.api) == null || o.updateSession(this.sessionId);
    }, 6e4), this.initialized = !0, this.emit("ready"), this.initTourRenderer(), setTimeout(() => {
      this.checkForTours();
    }, 1e3), e.debug && console.log("[Relay] Initialized", { sessionId: this.sessionId });
  }
  initTourRenderer() {
    this.tourRenderer = new Zt({
      onStart: async (e) => {
        this.api && this.sessionId && await this.api.startTour({
          tourId: e,
          sessionId: this.sessionId,
          userId: this.userId || void 0
        });
      },
      onProgress: async (e, t) => {
        this.api && this.sessionId && await this.api.updateTourProgress({
          tourId: e,
          sessionId: this.sessionId,
          currentStep: t
        });
      },
      onComplete: async (e) => {
        this.api && this.sessionId && await this.api.updateTourProgress({
          tourId: e,
          sessionId: this.sessionId,
          completed: !0
        }), this.emit("tour:completed", { tourId: e });
      },
      onDismiss: async (e) => {
        this.api && this.sessionId && await this.api.updateTourProgress({
          tourId: e,
          sessionId: this.sessionId,
          dismissed: !0
        }), this.emit("tour:dismissed", { tourId: e });
      }
    });
  }
  async identify(e) {
    if (!this.api || !this.sessionId)
      throw new Error("Relay not initialized");
    const t = await this.api.identify({
      sessionId: this.sessionId,
      userId: e.id,
      email: e.email,
      name: e.name,
      traits: e.traits
    });
    this.userId = t.userId;
  }
  setSessionAttributes(e) {
    var t;
    this.config && (this.config.session = {
      ...this.config.session,
      attributes: { ...(t = this.config.session) == null ? void 0 : t.attributes, ...e }
    });
  }
  open(e) {
    let t;
    e === "bug" ? t = "bug-report" : e === "feedback" ? t = "feature-request" : e === "chat" || e === "help" ? t = "messages" : t = e, this.openWidget(t), this.emit("open");
  }
  close() {
    this.closeWidget(), this.emit("close");
  }
  /**
   * Toggle the widget open/closed state
   */
  toggle() {
    this.widgetOpen ? this.close() : this.open();
  }
  /**
   * Check if the widget is currently open
   */
  isOpen() {
    return this.widgetOpen;
  }
  /**
   * Prefill form data for the next submission
   * Data is cleared after a successful submission
   */
  prefill(e) {
    this.prefillData = { ...this.prefillData, ...e }, this.widget && this.widget.setPrefillData(this.prefillData);
  }
  /**
   * Clear prefill data
   */
  clearPrefill() {
    this.prefillData = {}, this.widget && this.widget.setPrefillData({});
  }
  /**
   * Set custom data that will be attached to all interactions
   */
  setCustomData(e, t) {
    this.customData[e] = t;
  }
  /**
   * Get all custom data
   */
  getCustomData() {
    return { ...this.customData };
  }
  /**
   * Clear a specific custom data key
   */
  clearCustomData(e) {
    delete this.customData[e];
  }
  /**
   * Clear all custom data
   */
  clearAllCustomData() {
    this.customData = {};
  }
  /**
   * Show a specific survey by ID
   */
  async showSurvey(e) {
    if (!(!this.api || !this.sessionId))
      try {
        const r = (await this.api.getActiveSurveys({
          sessionId: this.sessionId,
          userId: this.userId || void 0,
          url: window.location.href
        })).find((a) => a.id === e);
        r && this.renderSurvey(r);
      } catch (t) {
        console.error("[Relay] Failed to show survey:", t);
      }
  }
  /**
   * Check and show eligible surveys (called after page load or events)
   */
  async checkForSurveys(e) {
    if (!(!this.api || !this.sessionId))
      try {
        const t = await this.api.getActiveSurveys({
          sessionId: this.sessionId,
          userId: this.userId || void 0,
          url: window.location.href,
          traits: this.customData
        });
        if (t.length > 0) {
          const r = this.getShownSurveys(), a = t.find((s) => {
            const i = s.targeting;
            return !(i != null && i.showOnce && r.includes(s.id));
          });
          if (a) {
            const s = a.targeting, i = ((s == null ? void 0 : s.showAfterSeconds) || 0) * 1e3;
            setTimeout(() => {
              this.renderSurvey(a);
            }, i);
          }
        }
      } catch (t) {
        console.warn("[Relay] Failed to check for surveys:", t);
      }
  }
  getShownSurveys() {
    try {
      const e = localStorage.getItem("relay_shown_surveys");
      return e ? JSON.parse(e) : [];
    } catch {
      return [];
    }
  }
  markSurveyShown(e) {
    try {
      const t = this.getShownSurveys();
      t.includes(e) || (t.push(e), localStorage.setItem("relay_shown_surveys", JSON.stringify(t)));
    } catch {
    }
  }
  /**
   * Check and show eligible tours (called after page load)
   */
  async checkForTours() {
    if (!(!this.api || !this.sessionId || !this.tourRenderer))
      try {
        const e = await this.api.getActiveTours({
          sessionId: this.sessionId,
          url: window.location.href,
          userTraits: this.customData
        });
        this.activeTours = e, e.length > 0 && (this.tourRenderer.startTour(e[0]), this.emit("tour:started", { tourId: e[0].id }));
      } catch (e) {
        console.warn("[Relay] Failed to check for tours:", e);
      }
  }
  /**
   * Start a specific tour by ID
   */
  async startTour(e) {
    if (!(!this.api || !this.sessionId || !this.tourRenderer))
      try {
        let t = this.activeTours.find((r) => r.id === e);
        t || (t = (await this.api.getActiveTours({
          sessionId: this.sessionId,
          url: window.location.href
        })).find((a) => a.id === e)), t && (this.tourRenderer.startTour(t), this.emit("tour:started", { tourId: e }));
      } catch (t) {
        console.error("[Relay] Failed to start tour:", t);
      }
  }
  renderSurvey(e) {
    this.markSurveyShown(e.id);
    const t = document.createElement("div");
    t.id = "relay-survey-overlay", t.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
      z-index: 999999;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    const r = document.createElement("div");
    r.style.cssText = `
      width: 100%;
      max-width: 480px;
      max-height: 90vh;
      background: white;
      border-radius: 16px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
    const a = e.definition;
    let s = 0;
    const i = {}, l = () => {
      r.innerHTML = "";
      const o = document.createElement("div");
      o.style.cssText = `
        padding: 20px 24px;
        border-bottom: 1px solid #e5e7eb;
        position: relative;
      `;
      const c = document.createElement("button");
      c.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>', c.style.cssText = `
        position: absolute;
        top: 16px;
        right: 16px;
        width: 32px;
        height: 32px;
        padding: 0;
        background: none;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        color: #6b7280;
        display: flex;
        align-items: center;
        justify-content: center;
      `, c.onclick = () => t.remove();
      const p = document.createElement("h2");
      p.textContent = a.title, p.style.cssText = `
        font-size: 18px;
        font-weight: 600;
        color: #111827;
        margin: 0 0 4px;
        padding-right: 32px;
      `, o.appendChild(c), o.appendChild(p), r.appendChild(o);
      const y = document.createElement("div");
      y.style.cssText = "padding: 24px;";
      const n = a.questions[s];
      if (n) {
        const x = document.createElement("p");
        if (x.textContent = n.text, x.style.cssText = `
          font-size: 15px;
          font-weight: 500;
          color: #111827;
          margin: 0 0 16px;
        `, y.appendChild(x), n.type === "nps") {
          const m = document.createElement("div");
          m.style.cssText = "display: flex; gap: 4px;";
          for (let S = 0; S <= 10; S++) {
            const T = document.createElement("button");
            T.textContent = String(S), T.style.cssText = `
              flex: 1;
              padding: 12px 0;
              background: ${i[n.id] === S ? "#3b82f6" : "#f3f4f6"};
              border: 1px solid ${i[n.id] === S ? "#3b82f6" : "#e5e7eb"};
              border-radius: 8px;
              font-family: inherit;
              font-size: 14px;
              font-weight: 500;
              color: ${i[n.id] === S ? "white" : "#111827"};
              cursor: pointer;
            `, T.onclick = () => {
              i[n.id] = S, l();
            }, m.appendChild(T);
          }
          y.appendChild(m);
          const v = document.createElement("div");
          v.style.cssText = "display: flex; justify-content: space-between; margin-top: 8px;";
          const _ = document.createElement("span");
          _.textContent = n.minLabel || "Not likely", _.style.cssText = "font-size: 12px; color: #6b7280;";
          const b = document.createElement("span");
          b.textContent = n.maxLabel || "Very likely", b.style.cssText = "font-size: 12px; color: #6b7280;", v.appendChild(_), v.appendChild(b), y.appendChild(v);
        } else if (n.type === "text") {
          const m = document.createElement("textarea");
          m.placeholder = n.placeholder || "Your answer...", m.value = i[n.id] || "", m.style.cssText = `
            width: 100%;
            padding: 12px 14px;
            background: #f9fafb;
            border: 1px solid #e5e7eb;
            border-radius: 10px;
            font-family: inherit;
            font-size: 14px;
            color: #111827;
            resize: vertical;
            min-height: 100px;
            box-sizing: border-box;
          `, m.oninput = () => {
            i[n.id] = m.value;
          }, y.appendChild(m);
        } else if (n.type === "rating") {
          const m = document.createElement("div");
          m.style.cssText = "display: flex; gap: 8px;";
          const v = n.max || 5;
          for (let _ = 1; _ <= v; _++) {
            const b = document.createElement("button");
            b.innerHTML = `<svg width="32" height="32" viewBox="0 0 24 24" fill="${_ <= (i[n.id] || 0) ? "#f59e0b" : "#e5e7eb"}"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`, b.style.cssText = `
              padding: 8px;
              background: none;
              border: none;
              cursor: pointer;
            `, b.onclick = () => {
              i[n.id] = _, l();
            }, m.appendChild(b);
          }
          y.appendChild(m);
        } else if (n.type === "single_choice" || n.type === "multi_choice") {
          const m = document.createElement("div");
          m.style.cssText = "display: flex; flex-direction: column; gap: 8px;", (n.options || []).forEach((v) => {
            const _ = n.type === "multi_choice", b = _ ? (i[n.id] || []).includes(v) : i[n.id] === v, S = document.createElement("div");
            S.style.cssText = `
              display: flex;
              align-items: center;
              gap: 12px;
              padding: 12px 14px;
              background: ${b ? "rgba(59, 130, 246, 0.05)" : "#f9fafb"};
              border: 1px solid ${b ? "#3b82f6" : "#e5e7eb"};
              border-radius: 10px;
              cursor: pointer;
            `;
            const T = document.createElement("div");
            T.style.cssText = `
              width: 18px;
              height: 18px;
              border: 2px solid ${b ? "#3b82f6" : "#e5e7eb"};
              border-radius: ${_ ? "4px" : "50%"};
              background: ${b ? "#3b82f6" : "transparent"};
              display: flex;
              align-items: center;
              justify-content: center;
              color: white;
              font-size: 12px;
            `, b && (T.textContent = _ ? "✓" : "");
            const k = document.createElement("span");
            k.textContent = v, k.style.cssText = "font-size: 14px; color: #111827;", S.appendChild(T), S.appendChild(k), S.onclick = () => {
              if (_) {
                const C = (i[n.id] || []).slice(), M = C.indexOf(v);
                M >= 0 ? C.splice(M, 1) : C.push(v), i[n.id] = C;
              } else
                i[n.id] = v;
              l();
            }, m.appendChild(S);
          }), y.appendChild(m);
        }
      }
      r.appendChild(y);
      const u = document.createElement("div");
      if (u.style.cssText = "padding: 16px 24px 24px; display: flex; gap: 12px;", s > 0) {
        const x = document.createElement("button");
        x.textContent = "Back", x.style.cssText = `
          flex: 1;
          padding: 12px 20px;
          background: #f3f4f6;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          font-family: inherit;
          font-size: 14px;
          font-weight: 500;
          color: #111827;
          cursor: pointer;
        `, x.onclick = () => {
          s--, l();
        }, u.appendChild(x);
      }
      const g = s === a.questions.length - 1, f = document.createElement("button");
      f.textContent = g ? "Submit" : "Next", f.style.cssText = `
        flex: 1;
        padding: 12px 20px;
        background: #3b82f6;
        border: none;
        border-radius: 10px;
        font-family: inherit;
        font-size: 14px;
        font-weight: 500;
        color: white;
        cursor: pointer;
      `, f.onclick = async () => {
        var x;
        if (g) {
          f.disabled = !0, f.textContent = "Submitting...";
          try {
            await ((x = this.api) == null ? void 0 : x.submitSurveyResponse({
              surveyId: e.id,
              sessionId: this.sessionId,
              responses: i
            })), r.innerHTML = `
              <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 48px 24px; text-align: center;">
                <div style="width: 56px; height: 56px; margin-bottom: 16px; color: #10b981; background: rgba(16, 185, 129, 0.1); border-radius: 50%; padding: 12px;">
                  <svg viewBox="0 0 24 24" fill="currentColor" style="width: 100%; height: 100%;"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                </div>
                <h4 style="font-size: 18px; font-weight: 600; color: #111827; margin: 0 0 6px;">Thank you!</h4>
                <p style="font-size: 14px; color: #6b7280; margin: 0;">${a.thankYouMessage || "Your feedback has been submitted."}</p>
              </div>
            `, setTimeout(() => t.remove(), 2e3);
          } catch (m) {
            f.disabled = !1, f.textContent = "Submit", console.error("[Relay] Survey submission failed:", m);
          }
        } else
          s++, l();
      }, u.appendChild(f), r.appendChild(u);
    };
    l(), t.appendChild(r), document.body.appendChild(t), t.onclick = (o) => {
      o.target === t && t.remove();
    };
  }
  /**
   * Get the current session ID
   */
  getSessionId() {
    return this.sessionId;
  }
  /**
   * Get the current user ID
   */
  getUserId() {
    return this.userId;
  }
  /**
   * Check if the SDK is initialized
   */
  isInitialized() {
    return this.initialized;
  }
  async captureBug(e) {
    var s, i, l, o;
    if (!this.api || !this.sessionId)
      throw new Error("Relay not initialized");
    const t = this.getTechnicalContext();
    let r;
    if (e.includeScreenshot !== !1)
      try {
        r = (await K({
          maskSelectors: (i = (s = this.config) == null ? void 0 : s.privacy) == null ? void 0 : i.maskSelectors,
          blockSelectors: (o = (l = this.config) == null ? void 0 : l.privacy) == null ? void 0 : o.blockSelectors
        })).blob;
      } catch (c) {
        console.warn("[Relay] Screenshot capture failed:", c);
      }
    const { interactionId: a } = await this.api.createInteraction({
      type: "bug",
      source: "sdk",
      sessionId: this.sessionId,
      userId: this.userId || void 0,
      contentText: e.description,
      content: {
        title: e.title,
        description: e.description,
        tags: e.tags
      },
      severity: e.severity,
      tags: e.tags,
      technicalContext: t
    });
    if (e.includeLogs !== !1) {
      const c = this.consoleCapture.getEntries(), p = this.networkCapture.getEntries(), y = this.errorCapture.getEntries();
      (c.length > 0 || p.length > 0 || y.length > 0) && await this.api.storeLogs({
        interactionId: a,
        console: c,
        network: p,
        errors: y
      });
    }
    if (r && await this.uploadMedia(a, "screenshot", r), e.attachments)
      for (const c of e.attachments)
        await this.uploadMedia(a, "attachment", c);
    return this.emit("bug:submitted", { interactionId: a }), a;
  }
  async captureFeedback(e) {
    if (!this.api || !this.sessionId)
      throw new Error("Relay not initialized");
    const t = this.getTechnicalContext(), { interactionId: r } = await this.api.createInteraction({
      type: "feedback",
      source: "sdk",
      sessionId: this.sessionId,
      userId: this.userId || void 0,
      contentText: e.text,
      content: {
        category: e.category,
        rating: e.rating,
        tags: e.tags
      },
      tags: e.tags,
      technicalContext: t
    });
    return this.emit("feedback:submitted", { interactionId: r }), r;
  }
  startRecording() {
    var e;
    if (!this.api || !this.sessionId)
      throw new Error("Relay not initialized");
    if ((e = this.replayCapture) != null && e.isRecording()) {
      console.warn("[Relay] Already recording");
      return;
    }
    this.replayCapture = Te(async (t, r) => {
      var a, s;
      if (!(!this.replayId || !this.api))
        try {
          const { uploadUrl: i } = await this.api.sendReplayChunk({
            replayId: this.replayId,
            chunkIndex: r,
            events: t,
            startTime: ((a = t[0]) == null ? void 0 : a.timestamp) || Date.now(),
            endTime: ((s = t[t.length - 1]) == null ? void 0 : s.timestamp) || Date.now()
          });
          await fetch(i, {
            method: "PUT",
            body: JSON.stringify(t),
            headers: { "Content-Type": "application/json" }
          });
        } catch (i) {
          console.error("[Relay] Failed to upload replay chunk:", i);
        }
    }), this.api.startReplay(this.sessionId).then(({ replayId: t }) => {
      var r, a, s, i, l, o, c;
      this.replayId = t, (c = this.replayCapture) == null || c.start({
        maskTextSelector: (s = (a = (r = this.config) == null ? void 0 : r.privacy) == null ? void 0 : a.maskSelectors) == null ? void 0 : s.join(", "),
        blockSelector: (o = (l = (i = this.config) == null ? void 0 : i.privacy) == null ? void 0 : l.blockSelectors) == null ? void 0 : o.join(", ")
      }), this.emit("replay:started", { replayId: t });
    });
  }
  async stopRecording() {
    var t;
    if (!((t = this.replayCapture) != null && t.isRecording()) || !this.replayId || !this.api)
      return;
    const e = await this.replayCapture.stop();
    await this.api.endReplay(this.replayId, e.length), this.emit("replay:stopped", { replayId: this.replayId }), this.replayId = null;
  }
  setPrivacy(e) {
    this.config && (this.config.privacy = { ...this.config.privacy, ...e });
  }
  track(e, t) {
    if (!this.api || !this.sessionId) {
      console.warn("[Relay] Not initialized, cannot track event");
      return;
    }
    this.api.track(this.sessionId, e, t);
  }
  on(e, t) {
    this.eventHandlers.has(e) || this.eventHandlers.set(e, /* @__PURE__ */ new Set()), this.eventHandlers.get(e).add(t);
  }
  off(e, t) {
    var r;
    (r = this.eventHandlers.get(e)) == null || r.delete(t);
  }
  destroy() {
    var e;
    this.consoleCapture.stop(), this.networkCapture.stop(), this.errorCapture.stop(), (e = this.replayCapture) == null || e.stop(), this.heartbeatInterval && clearInterval(this.heartbeatInterval), this.widget && (this.widget.unmount(), this.widget = null), this.widgetContainer && (this.widgetContainer.remove(), this.widgetContainer = null), this.tourRenderer && (this.tourRenderer.destroy(), this.tourRenderer = null), this.initialized = !1;
  }
  // ============================================================================
  // Private methods
  // ============================================================================
  emit(e, t) {
    var r;
    (r = this.eventHandlers.get(e)) == null || r.forEach((a) => {
      try {
        a(t);
      } catch (s) {
        console.error("[Relay] Event handler error:", s);
      }
    });
  }
  getTechnicalContext() {
    const e = navigator;
    return {
      url: window.location.href,
      referrer: document.referrer,
      userAgent: navigator.userAgent,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      },
      devicePixelRatio: window.devicePixelRatio,
      memory: performance.memory ? {
        usedJSHeapSize: performance.memory.usedJSHeapSize,
        totalJSHeapSize: performance.memory.totalJSHeapSize
      } : void 0,
      connection: e.connection ? {
        effectiveType: e.connection.effectiveType,
        downlink: e.connection.downlink,
        rtt: e.connection.rtt
      } : void 0,
      timestamp: Date.now(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      locale: navigator.language
    };
  }
  getDeviceInfo() {
    const e = navigator.userAgent;
    return {
      type: /mobile/i.test(e) ? "mobile" : /tablet/i.test(e) ? "tablet" : "desktop",
      os: this.detectOS(e),
      browser: this.detectBrowser(e),
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      devicePixelRatio: window.devicePixelRatio,
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    };
  }
  detectOS(e) {
    return /windows/i.test(e) ? "Windows" : /macintosh|mac os x/i.test(e) ? "macOS" : /linux/i.test(e) ? "Linux" : /android/i.test(e) ? "Android" : /iphone|ipad|ipod/i.test(e) ? "iOS" : "Unknown";
  }
  detectBrowser(e) {
    return /chrome/i.test(e) && !/edge/i.test(e) ? "Chrome" : /firefox/i.test(e) ? "Firefox" : /safari/i.test(e) && !/chrome/i.test(e) ? "Safari" : /edge/i.test(e) ? "Edge" : "Unknown";
  }
  async uploadMedia(e, t, r) {
    if (!this.api)
      return;
    const a = r.type || "application/octet-stream", s = r instanceof File ? r.name : void 0, { mediaId: i, uploadUrl: l } = await this.api.initiateUpload({
      interactionId: e,
      kind: t,
      contentType: a,
      sizeBytes: r.size,
      filename: s
    });
    await fetch(l, {
      method: "PUT",
      body: r,
      headers: { "Content-Type": a }
    }), await this.api.completeUpload(i);
  }
  // ============================================================================
  // Widget UI (Modular Implementation)
  // ============================================================================
  createWidget() {
    var e, t, r;
    this.widget || (this.widget = new Gt({
      config: ((e = this.config) == null ? void 0 : e.widget) || {},
      themeMode: "auto",
      useMockData: ((r = (t = this.config) == null ? void 0 : t.widget) == null ? void 0 : r.useMockData) ?? !1,
      callbacks: {
        // Form submissions
        onBugSubmit: async (a) => {
          let s = a.screenshotBlob;
          s && a.annotations && a.annotations.length > 0 && (s = await Ie(
            s,
            a.annotations
          )), await this.captureBugFromWidget({
            title: a.title,
            description: a.description,
            severity: a.severity,
            includeScreenshot: a.includeScreenshot,
            includeLogs: a.includeLogs,
            attachments: a.attachments,
            screenshotBlob: s
          });
        },
        onFeedbackSubmit: async (a) => {
          await this.captureFeedback({
            text: a.text,
            category: a.category,
            rating: a.rating
          });
        },
        onFeatureRequestSubmit: async (a) => {
          await this.captureFeatureRequestFromWidget({
            title: a.title,
            description: a.description,
            category: a.category,
            attachments: a.attachments
          });
        },
        onScreenshotCapture: async () => {
          var a, s, i, l;
          try {
            return (await K({
              maskSelectors: (s = (a = this.config) == null ? void 0 : a.privacy) == null ? void 0 : s.maskSelectors,
              blockSelectors: (l = (i = this.config) == null ? void 0 : i.privacy) == null ? void 0 : l.blockSelectors
            })).blob;
          } catch (o) {
            return console.warn("[Relay] Screenshot capture failed:", o), null;
          }
        },
        // Chat API
        onFetchConversations: async () => !this.api || !this.sessionId ? [] : await this.api.getConversations(this.sessionId),
        onFetchMessages: async (a) => {
          if (!this.api)
            return { messages: [], hasMore: !1 };
          const s = await this.api.getMessages(a);
          return {
            messages: s.messages,
            hasMore: s.hasMore
          };
        },
        onSendMessage: async (a, s) => {
          if (!this.api)
            throw new Error("API not initialized");
          return await this.api.sendMessage(a, s);
        },
        onStartConversation: async (a) => {
          if (!this.api || !this.sessionId)
            throw new Error("API not initialized");
          const s = await this.api.startConversation({
            sessionId: this.sessionId,
            userId: this.userId || void 0,
            message: a
          });
          return this.emit("chat:opened"), s;
        },
        onMarkMessagesRead: async (a) => {
          this.api && await this.api.markMessagesRead(a);
        },
        // Roadmap API
        onFetchRoadmap: async () => this.api ? (await this.api.getPublicRoadmap()).data : [],
        onVote: async (a) => {
          if (!this.api || !this.sessionId)
            throw new Error("API not initialized");
          await this.api.voteFeedback(
            a,
            this.sessionId,
            this.userId || void 0
          );
        },
        onUnvote: async (a) => {
          if (!this.api || !this.sessionId)
            throw new Error("API not initialized");
          await this.api.unvoteFeedback(a, this.sessionId);
        },
        // Help API
        onFetchHelpCategories: async () => {
          if (!this.api)
            return [];
          try {
            return await this.api.getHelpCategories() || [];
          } catch (a) {
            return console.warn("[Relay] Failed to fetch help categories:", a), [];
          }
        },
        onFetchHelpArticles: async (a) => {
          if (!this.api)
            return [];
          try {
            return await this.api.getHelpArticles(a) || [];
          } catch (s) {
            return console.warn("[Relay] Failed to fetch help articles:", s), [];
          }
        },
        onSearchHelpArticles: async (a) => {
          if (!this.api)
            return [];
          try {
            return await this.api.searchHelpArticles(a) || [];
          } catch (s) {
            return console.warn("[Relay] Failed to search help articles:", s), [];
          }
        },
        onFetchHelpArticle: async (a) => {
          if (!this.api)
            return null;
          try {
            return await this.api.getHelpArticle(a) || null;
          } catch (s) {
            return console.warn("[Relay] Failed to fetch help article:", s), null;
          }
        },
        // File upload
        onUploadFiles: async (a) => {
          if (!this.api)
            throw new Error("API not initialized");
          const s = [];
          for (const i of a)
            console.warn(
              "[Relay] File upload requires interactionId - handle in form submission"
            );
          return s;
        }
      }
    }), this.widget.mount());
  }
  /**
   * Capture bug from the widget (with pre-captured screenshot)
   */
  async captureBugFromWidget(e) {
    if (!this.api || !this.sessionId)
      throw new Error("Relay not initialized");
    const t = this.getTechnicalContext(), { interactionId: r } = await this.api.createInteraction({
      type: "bug",
      source: "sdk",
      sessionId: this.sessionId,
      userId: this.userId || void 0,
      contentText: e.description,
      content: {
        title: e.title,
        description: e.description,
        tags: e.tags
      },
      severity: e.severity,
      tags: e.tags,
      technicalContext: t
    });
    if (e.includeLogs !== !1) {
      const a = this.consoleCapture.getEntries(), s = this.networkCapture.getEntries(), i = this.errorCapture.getEntries();
      (a.length > 0 || s.length > 0 || i.length > 0) && await this.api.storeLogs({
        interactionId: r,
        console: a,
        network: s,
        errors: i
      });
    }
    if (e.screenshotBlob && e.includeScreenshot !== !1 && await this.uploadMedia(r, "screenshot", e.screenshotBlob), e.attachments)
      for (const a of e.attachments)
        await this.uploadMedia(r, "attachment", a);
    return this.emit("bug:submitted", { interactionId: r }), r;
  }
  /**
   * Capture feature request from the widget (with file attachments)
   */
  async captureFeatureRequestFromWidget(e) {
    if (!this.api || !this.sessionId)
      throw new Error("Relay not initialized");
    const t = this.getTechnicalContext(), { interactionId: r } = await this.api.createInteraction({
      type: "feedback",
      source: "sdk",
      sessionId: this.sessionId,
      userId: this.userId || void 0,
      contentText: `[Feature Request] ${e.title}

${e.description}`,
      content: {
        title: e.title,
        description: e.description,
        category: e.category
      },
      technicalContext: t
    });
    if (e.attachments && e.attachments.length > 0)
      for (const a of e.attachments)
        await this.uploadMedia(r, "attachment", a);
    return this.emit("feedback:submitted", { interactionId: r }), r;
  }
  toggleWidget() {
    this.widget && (this.widget.toggle(), this.widgetOpen = this.widget.isWidgetOpen());
  }
  openWidget(e) {
    this.widget && (this.widget.open(e), this.widgetOpen = !0);
  }
  closeWidget() {
    this.widget && (this.widget.close(), this.widgetOpen = !1);
  }
}
const Qt = new Jt();
typeof window < "u" && (window.Relay = Qt);
export {
  Qt as Relay,
  Jt as RelaySDK,
  Qt as default
};
//# sourceMappingURL=relay.esm.js.map
