/* Runs the game in the browser when there is no Node server (GitHub Pages). */
(function () {
  const KEY = "rd.offline.v1";
  const TIERS = [
    [100, "Broke on purpose"],
    [500, "Pocket change"],
    [1500, "Comfortable"],
    [4000, "Well off"],
    [10000, "Rich"],
    [25000, "Filthy"],
    [50000, "Dynasty"]
  ];
  const COSMETICS = [
    { id: "border-gray", slot: "border", name: "Tin plate", tier: "broke" },
    { id: "border-color", slot: "border", name: "Named color", tier: "pocket" },
    { id: "border-static", slot: "border", name: "Gold wire", tier: "comfortable" },
    { id: "border-dust", slot: "border", name: "Gold dust", tier: "welloff" },
    { id: "border-theme", slot: "border", name: "Liquid gold", tier: "rich" },
    { id: "border-idle", slot: "border", name: "Living flame", tier: "filthy" },
    { id: "border-trail", slot: "border", name: "Dynasty trail", tier: "dynasty" },
    { id: "border-throne", slot: "border", name: "Living throne", special: "throne" }
  ];
  const SKUS = {
    SHOVE: { cents: 0, add: true },
    FLEX: { cents: 300, add: true },
    BANNER_NIGHT: { cents: 800, add: true },
    LOCK_DRIP: { cents: 1200, add: true },
    THRONE_ARMOR_15: { cents: 500, add: false, armor: 15 * 60 * 1000, margin: 500 },
    REPAIR_FRAME: { cents: 500, add: false }
  };
  function money(c) {
    const n = (c || 0) / 100;
    return Number.isInteger(n) ? "$" + n : "$" + n.toFixed(2);
  }
  function title(c) {
    let t = TIERS[0][1];
    for (const x of TIERS) if (c >= x[0]) t = x[1];
    return t;
  }
  function load() {
    try { return JSON.parse(localStorage.getItem(KEY) || ""); } catch (e) { return null; }
  }
  function save(s) { localStorage.setItem(KEY, JSON.stringify(s)); }
  function blank() {
    return { users: {}, sessions: {}, events: [], payments: [], throne: { holder: null, since: Date.now(), armorUntil: 0, margin: 0 }, banner: null, daily: {} };
  }
  let S = load() || blank();
  const listeners = [];
  function uid() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }
  function ranked() {
    return Object.values(S.users).filter(function (u) { return u.lifetimeCents > 0; })
      .sort(function (a, b) { return b.lifetimeCents - a.lifetimeCents; })
      .map(function (u, i) { u.rank = i + 1; return u; });
  }
  function pub(u) {
    if (!u) return null;
    const list = ranked();
    const live = list.find(function (x) { return x.id === u.id; });
    const first = list[0];
    return {
      id: u.id, handle: u.handle, lifetimeCents: u.lifetimeCents, money: money(u.lifetimeCents),
      rank: live ? live.rank : 0, title: title(u.lifetimeCents), tagline: u.tagline || "",
      loadout: u.loadout, unlocks: u.unlocks, cracked: !!u.cracked, dripUntil: u.dripUntil || 0,
      flexUntil: u.flexUntil || 0, lastPaymentAt: u.lastPaymentAt || 0, throneSecondsTotal: u.throneSecondsTotal || 0,
      isThrone: S.throne.holder === u.id,
      gapToFirstCents: first && first.id !== u.id ? first.lifetimeCents - u.lifetimeCents : 0
    };
  }
  function trackers(me) {
    const list = ranked();
    const first = list[0];
    const now = Date.now();
    const reign = S.throne.holder && S.throne.since ? Math.floor((now - S.throne.since) / 1000) : 0;
    const armor = Math.max(0, Math.floor((S.throne.armorUntil - now) / 1000));
    const day = new Date().toISOString().slice(0, 10);
    S.daily[day] = S.daily[day] || {};
    const daily = Object.keys(S.daily[day]).map(function (id) {
      return { handle: S.users[id] && S.users[id].handle, cents: S.daily[day][id], money: money(S.daily[day][id]) };
    }).filter(function (x) { return x.handle; }).sort(function (a, b) { return b.cents - a.cents; });
    const meLive = me ? list.find(function (u) { return u.id === me.id; }) : null;
    return {
      now: now, utcDay: day, watchers: 1 + list.length,
      heat: { m5: { count: S.events.filter(function (e) { return now - e.createdAt < 300000; }).length }, m10: { count: S.events.filter(function (e) { return now - e.createdAt < 600000; }).length }, m60: { count: S.events.length } },
      throne: { holder: S.throne.holder ? pub(S.users[S.throne.holder]) : null, since: S.throne.since, reignSeconds: reign, armorSeconds: armor, armorMarginCents: S.throne.margin },
      banner: S.banner && S.banner.until > now ? S.banner : null,
      daily: daily,
      me: meLive ? { rank: meLive.rank, cents: meLive.lifetimeCents, gapToFirstCents: first ? first.lifetimeCents - meLive.lifetimeCents : 0 } : null
    };
  }
  function snapshot(me) {
    const list = ranked();
    return {
      board: list.slice(0, 50).map(pub),
      gapCents: list[0] && list[1] ? list[0].lifetimeCents - list[1].lifetimeCents : 0,
      events: S.events.slice(0, 25),
      trackers: trackers(me),
      houseEmpty: list.length === 0
    };
  }
  function userByHandle(h) {
    h = String(h || "").toLowerCase();
    return Object.values(S.users).find(function (u) { return u.handle.toLowerCase() === h; });
  }
  function sessionUser(sid) { return sid && S.sessions[sid] ? S.users[S.sessions[sid]] : null; }
  function register(handle) {
    handle = String(handle || "").replace(/[^a-zA-Z0-9_]/g, "").slice(0, 20);
    if (handle.length < 3) throw new Error("Handle must be 3-20 characters");
    let u = userByHandle(handle);
    if (!u) {
      u = { id: uid(), handle: handle, lifetimeCents: 0, tagline: "", loadout: { border: "border-gray" }, unlocks: ["border-gray", "border-color", "border-static"], cracked: false, createdAt: Date.now() };
      S.users[u.id] = u;
    }
    const sid = uid();
    S.sessions[sid] = u.id;
    save(S);
    return { session: sid, user: pub(u) };
  }
  function apply(user, sku, cents) {
    const spec = SKUS[sku] || SKUS.SHOVE;
    const add = spec.add === false ? 0 : (cents || spec.cents || 0);
    const pay = spec.cents || cents || 0;
    user.lifetimeCents += add;
    user.lastPaymentAt = Date.now();
    const day = new Date().toISOString().slice(0, 10);
    S.daily[day] = S.daily[day] || {};
    S.daily[day][user.id] = (S.daily[day][user.id] || 0) + add;
    if (sku === "FLEX") user.flexUntil = Date.now() + 10000;
    if (sku === "LOCK_DRIP") user.dripUntil = Date.now() + 30 * 60 * 1000;
    if (sku === "BANNER_NIGHT") S.banner = { text: user.handle + " paid.", until: Date.now() + 15 * 60 * 1000 };
    if (sku === "THRONE_ARMOR_15") {
      if (S.throne.holder !== user.id) throw new Error("Only #1 can buy armor");
      S.throne.armorUntil = Date.now() + spec.armor;
      S.throne.margin = spec.margin;
    }
    const list = ranked();
    const first = list[0];
    let dethroned = null;
    if (first && first.id !== S.throne.holder) {
      const armored = S.throne.holder && S.throne.armorUntil > Date.now() && S.users[S.throne.holder] && first.lifetimeCents < S.users[S.throne.holder].lifetimeCents + (S.throne.margin || 0);
      if (!armored) {
        const prev = S.users[S.throne.holder];
        if (prev) { prev.cracked = true; dethroned = pub(prev); }
        S.throne.holder = first.id;
        S.throne.since = Date.now();
        S.throne.armorUntil = 0;
        first.loadout.border = "border-throne";
      }
    } else if (!S.throne.holder && first) {
      S.throne.holder = first.id;
      S.throne.since = Date.now();
      first.loadout.border = "border-throne";
    }
    S.events.unshift({ type: "payment", handle: user.handle, cents: pay, createdAt: Date.now(), meta: {} });
    if (dethroned) S.events.unshift({ type: "dethrone", handle: user.handle, cents: pay, createdAt: Date.now(), meta: { fallen: dethroned.handle } });
    S.events = S.events.slice(0, 80);
    save(S);
    listeners.forEach(function (fn) { fn(); });
    return { user: pub(user), dethroned: dethroned };
  }
  function handle(url, method, body) {
    const path = url.replace(location.origin, "").split("?")[0];
    const sid = (body && body._sid) || null;
    if (path === "/api/health") return { ok: true, demo: true, pages: true };
    if (path === "/api/state") {
      const me = sessionUser(sid);
      return { demo: true, me: me ? pub(me) : null, cosmetics: COSMETICS, snapshot: snapshot(me) };
    }
    if (path === "/api/trackers") return trackers(sessionUser(sid));
    if (path === "/api/hall") {
      const kills = {};
      S.events.filter(function (e) { return e.type === "dethrone"; }).forEach(function (e) { kills[e.handle] = (kills[e.handle] || 0) + 1; });
      return {
        longestReign: ranked().slice(0, 10).map(pub),
        assassins: Object.keys(kills).map(function (h) { return { handle: h, kills: kills[h] }; }),
        fallen: S.events.filter(function (e) { return e.type === "dethrone"; }).slice(0, 20)
      };
    }
    if (path.indexOf("/api/u/") === 0) {
      const u = userByHandle(decodeURIComponent(path.slice(7)));
      if (!u) throw new Error("Not found");
      return { user: pub(u), payments: S.events.filter(function (e) { return e.handle === u.handle && e.type === "payment"; }).length };
    }
    if (path === "/api/register" || path === "/api/login") return register(body.handle);
    if (path === "/api/checkout") {
      const me = sessionUser(sid);
      if (!me) throw new Error("Sign in first");
      const sku = body.sku || "SHOVE";
      const cents = sku === "SHOVE" ? Number(body.cents || 0) : (SKUS[sku] && SKUS[sku].cents) || 0;
      if (sku === "SHOVE" && cents < 100) throw new Error("Min $1");
      const result = apply(me, sku, cents);
      return { demo: true, result: result, snapshot: snapshot(me) };
    }
    if (path === "/api/me/equip") {
      const me = sessionUser(sid);
      if (!me) throw new Error("Sign in first");
      me.loadout[body.slot] = body.id; save(S);
      return { user: pub(me) };
    }
    if (path === "/api/me/tagline" || path === "/api/pick") return { ok: true };
    throw new Error("offline stub missing " + path);
  }

  const realFetch = window.fetch.bind(window);
  window.fetch = function (url, opts) {
    const u = String(url);
    if (u.indexOf("/api/") === -1) return realFetch(url, opts);
    return realFetch(url, opts).then(function (res) {
      if (res.ok) return res;
      throw new Error("api down");
    }).catch(function () {
      window.__RD_PAGES = true;
      let body = {};
      try { body = JSON.parse((opts && opts.body) || "{}"); } catch (e) {}
      const auth = (opts && opts.headers && (opts.headers.Authorization || opts.headers.authorization)) || "";
      body._sid = auth.indexOf("Bearer ") === 0 ? auth.slice(7) : localStorage.getItem("rd.session") || "";
      try {
        const data = handle(u, (opts && opts.method) || "GET", body);
        return new Response(JSON.stringify(data), { status: 200, headers: { "Content-Type": "application/json" } });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 400, headers: { "Content-Type": "application/json" } });
      }
    });
  };

  const RealWS = window.WebSocket;
  window.WebSocket = function (url) {
    if (String(url).indexOf("/ws") === -1) return new RealWS(url);
    const fake = {
      readyState: 1,
      onmessage: null,
      onclose: null,
      send: function () {},
      close: function () {}
    };
    function emit() {
      if (!fake.onmessage) return;
      fake.onmessage({ data: JSON.stringify({ type: "board.snapshot", data: snapshot(null) }) });
      fake.onmessage({ data: JSON.stringify({ type: "trackers.tick", data: trackers(null) }) });
    }
    setTimeout(emit, 50);
    const iv = setInterval(emit, 1000);
    listeners.push(emit);
    fake.close = function () { clearInterval(iv); };
    return fake;
  };
})();
