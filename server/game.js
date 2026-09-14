const { v4: uuid } = require("uuid");
const store = require("./store");
const { TIERS, SKUS, HOUSE_HANDLE, COSMETICS } = require("./config");

const now = () => Date.now();
const utcDay = (ts = now()) => new Date(ts).toISOString().slice(0, 10);
function money(cents) {
  const n = (cents || 0) / 100;
  return Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`;
}
function tierFor(cents) {
  let t = TIERS[0];
  for (const x of TIERS) if (cents >= x.minCents) t = x;
  return t;
}
function usersList() {
  return Object.values(store.get().users).filter((u) => !u.banned && !u.isHouse);
}
function ranked() {
  return usersList()
    .filter((u) => u.lifetimeCents > 0)
    .sort((a, b) => b.lifetimeCents - a.lifetimeCents || (a.lastPaymentAt || a.createdAt) - (b.lastPaymentAt || b.createdAt))
    .map((u, i) => ((u.rank = i + 1), u));
}
function baseUser(id, handle, isHouse) {
  return {
    id, handle, email: null, isHouse, lifetimeCents: 0, rank: 0, peakRank: 999, peakCents: 0,
    throneSecondsTotal: 0, createdAt: now(), lastPaymentAt: 0, lastSeenAt: now(),
    tagline: isHouse ? "The chair is empty until someone pays." : "",
    loadout: { border: "border-gray", banner: null, title: "title-default", effect: null },
    unlocks: ["border-gray", "title-default"], cracked: false, repaired: false, dripUntil: 0, flexUntil: 0,
    notify: { dethrone: true }, banned: false, handleLocked: !!isHouse
  };
}
function ensureHouse() {
  const s = store.get();
  if (s.users.house) return;
  s.users.house = baseUser("house", HOUSE_HANDLE, true);
  store.touch();
}
function createUser({ handle, email }) {
  const s = store.get();
  const clean = String(handle || "").trim().replace(/[^a-zA-Z0-9_]/g, "").slice(0, 20);
  if (clean.length < 3) throw new Error("Handle must be 3-20 letters, numbers, or _");
  if (Object.values(s.users).some((u) => u.handle.toLowerCase() === clean.toLowerCase())) throw new Error("Handle taken");
  const id = uuid();
  s.users[id] = { ...baseUser(id, clean, false), email: email || null };
  store.touch();
  return s.users[id];
}
function sessionUser(sessionId) {
  const sid = store.get().sessions[sessionId];
  return sid ? store.get().users[sid] || null : null;
}
function login(userId) {
  const sid = uuid();
  store.get().sessions[sid] = userId;
  store.touch();
  return sid;
}
function applyUnlocks(user) {
  const idx = TIERS.findIndex((x) => x.id === tierFor(user.lifetimeCents).id);
  for (let i = 0; i <= idx; i++) {
    for (const c of COSMETICS) if (c.tier === TIERS[i].id && !user.unlocks.includes(c.id)) user.unlocks.push(c.id);
  }
  if (user.cracked && !user.unlocks.includes("border-cracked")) user.unlocks.push("border-cracked");
}
function publicUser(u, opts = {}) {
  if (!u) return null;
  const list = ranked();
  const live = list.find((x) => x.id === u.id);
  const rank = live ? live.rank : 0;
  const next = live ? list[rank] : null;
  const first = list[0];
  const isThrone = store.get().throne.holderId === u.id;
  return {
    id: u.id, handle: u.handle, isHouse: !!u.isHouse, lifetimeCents: u.lifetimeCents, money: money(u.lifetimeCents),
    rank, title: tierFor(u.lifetimeCents).title, tier: tierFor(u.lifetimeCents).id, tagline: u.tagline, loadout: u.loadout,
    unlocks: u.unlocks, cracked: u.cracked, dripUntil: u.dripUntil, flexUntil: u.flexUntil, lastPaymentAt: u.lastPaymentAt,
    throneSecondsTotal: u.throneSecondsTotal, isThrone,
    gapToNextCents: next ? u.lifetimeCents - next.lifetimeCents : 0,
    gapToFirstCents: first && !isThrone ? first.lifetimeCents - u.lifetimeCents : 0,
    email: opts.private ? u.email : undefined
  };
}
function addEvent(type, actorId, cents, meta) {
  const ev = { id: uuid(), type, actorId, cents: cents || 0, meta: meta || {}, createdAt: now() };
  const s = store.get();
  s.events.unshift(ev);
  s.events = s.events.slice(0, 200);
  store.touch();
  return ev;
}
function heat(windowMs = 10 * 60000) {
  const cutoff = now() - windowMs;
  const evs = store.get().events.filter((e) => e.createdAt >= cutoff && e.type === "payment");
  return { count: evs.length, cents: evs.reduce((a, e) => a + (e.cents || 0), 0) };
}
function dailyMap() {
  const day = utcDay();
  const s = store.get();
  s.daily[day] = s.daily[day] || {};
  return s.daily[day];
}
function dailyRanked() {
  return Object.entries(dailyMap())
    .map(([id, cents]) => ({ user: store.get().users[id], cents }))
    .filter((x) => x.user && !x.user.banned)
    .sort((a, b) => b.cents - a.cents);
}
function closeReign(s, ts) {
  if (!s.throne.holderId || !s.throne.since) return;
  const holder = s.users[s.throne.holderId];
  if (holder) holder.throneSecondsTotal += Math.max(0, Math.floor((ts - s.throne.since) / 1000));
}
function applyPayment({ userId, cents, sku, stripeId }) {
  const s = store.get();
  const user = s.users[userId];
  if (!user || user.banned) throw new Error("No user");
  const spec = SKUS[sku] || SKUS.SHOVE;
  const add = spec.addsScore === false ? 0 : cents;
  const ts = now();
  user.lifetimeCents += add;
  user.lastPaymentAt = ts;
  user.handleLocked = true;
  if (user.lifetimeCents > user.peakCents) user.peakCents = user.lifetimeCents;
  if (sku === "FLEX") user.flexUntil = ts + spec.durationMs;
  if (sku === "LOCK_DRIP") user.dripUntil = ts + spec.durationMs;
  if (sku === "BANNER_NIGHT") {
    s.banner = { text: (s._pendingBanner || user.tagline || user.handle + " paid.").slice(0, 80), until: ts + spec.durationMs, userId };
  }
  if (sku === "REPAIR_FRAME") {
    user.repaired = true; user.cracked = false;
    if (user.loadout.border === "border-cracked") user.loadout.border = "border-theme";
  }
  if (sku.startsWith("THRONE_ARMOR")) {
    if (s.throne.holderId !== user.id) throw new Error("Only the throne can buy armor");
    s.throne.armorUntil = ts + spec.armorMs;
    s.throne.armorMarginCents = spec.marginCents;
  }
  applyUnlocks(user);
  dailyMap()[user.id] = (dailyMap()[user.id] || 0) + add;
  const after = ranked();
  after.forEach((u) => { if (u.rank < u.peakRank) u.peakRank = u.rank; });
  const newFirst = after[0] || null;
  let dethroned = null;
  let throneHeldByArmor = false;
  if (newFirst && newFirst.id !== s.throne.holderId) {
    const armored = s.throne.holderId && s.throne.armorUntil > ts && s.users[s.throne.holderId] &&
      newFirst.lifetimeCents < s.users[s.throne.holderId].lifetimeCents + s.throne.armorMarginCents;
    if (armored) throneHeldByArmor = true;
    else {
      const prev = s.users[s.throne.holderId];
      closeReign(s, ts);
      if (prev && !prev.isHouse) {
        prev.cracked = true; applyUnlocks(prev);
        if (prev.loadout.border === "border-throne") prev.loadout.border = "border-cracked";
        dethroned = prev;
      }
      s.throne.holderId = newFirst.id; s.throne.since = ts; s.throne.armorUntil = 0; s.throne.armorMarginCents = 0;
      newFirst.loadout.border = "border-throne";
      if (!newFirst.unlocks.includes("border-throne")) newFirst.unlocks.push("border-throne");
    }
  } else if (!s.throne.holderId && newFirst) {
    s.throne.holderId = newFirst.id; s.throne.since = ts; newFirst.loadout.border = "border-throne";
  }
  const payment = { id: uuid(), userId, stripeId: stripeId || ("demo_" + uuid()), cents, sku, status: "succeeded", createdAt: ts };
  s.payments.unshift(payment);
  addEvent("payment", userId, cents, { sku });
  if (dethroned) addEvent("dethrone", userId, cents, { fallen: dethroned.handle, fallenId: dethroned.id });
  if (throneHeldByArmor) addEvent("armor.held", userId, cents, {});
  if (sku.startsWith("THRONE_ARMOR")) addEvent("armor", userId, cents, { until: s.throne.armorUntil });
  store.touch();
  return { payment, user: publicUser(user, { private: true }), dethroned: dethroned ? publicUser(dethroned) : null, throneHeldByArmor };
}
function trackers(user) {
  const s = store.get();
  const ts = now();
  const list = ranked();
  const first = list[0];
  const me = user ? list.find((u) => u.id === user.id) : null;
  const armorLeft = Math.max(0, s.throne.armorUntil - ts);
  const reignSeconds = s.throne.holderId && s.throne.since ? Math.floor((ts - s.throne.since) / 1000) : 0;
  const h5 = heat(5 * 60000), h10 = heat(10 * 60000), h60 = heat(60 * 60000);
  return {
    now: ts, utcDay: utcDay(ts), watchers: s.watchers || 0, heat: { m5: h5, m10: h10, m60: h60 },
    throne: {
      holder: s.throne.holderId ? publicUser(s.users[s.throne.holderId]) : null, since: s.throne.since, reignSeconds,
      armorUntil: s.throne.armorUntil, armorSeconds: Math.floor(armorLeft / 1000), armorMarginCents: s.throne.armorMarginCents
    },
    banner: s.banner.until > ts ? { text: s.banner.text, until: s.banner.until, handle: s.users[s.banner.userId] && s.users[s.banner.userId].handle } : null,
    daily: dailyRanked().slice(0, 10).map((x) => ({ handle: x.user.handle, cents: x.cents, money: money(x.cents) })),
    me: me ? {
      rank: me.rank, cents: me.lifetimeCents,
      gapToNextCents: list[me.rank] ? me.lifetimeCents - list[me.rank].lifetimeCents : 0,
      gapToFirstCents: first ? first.lifetimeCents - me.lifetimeCents : 0,
      lastPaymentAt: me.lastPaymentAt,
      throneSecondsTotal: me.throneSecondsTotal + (s.throne.holderId === me.id ? reignSeconds : 0)
    } : null
  };
}
function snapshot(user) {
  const list = ranked();
  const gap = list[0] && list[1] ? list[0].lifetimeCents - list[1].lifetimeCents : 0;
  return {
    board: list.slice(0, 50).map((u) => publicUser(u)),
    gapCents: gap,
    events: store.get().events.slice(0, 25).map((e) => ({ ...e, handle: (store.get().users[e.actorId] && store.get().users[e.actorId].handle) || "someone" })),
    trackers: trackers(user),
    houseEmpty: list.length === 0
  };
}
function hall() {
  const s = store.get();
  const list = Object.values(s.users).filter((u) => !u.isHouse && !u.banned);
  const dethrones = s.events.filter((e) => e.type === "dethrone");
  const assassin = {};
  for (const e of dethrones) assassin[e.actorId] = (assassin[e.actorId] || 0) + 1;
  const biggest = [...s.payments].sort((a, b) => b.cents - a.cents)[0];
  return {
    longestReign: [...list].sort((a, b) => b.throneSecondsTotal - a.throneSecondsTotal).slice(0, 10).map(publicUser),
    assassins: Object.entries(assassin).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([id, n]) => ({ ...publicUser(s.users[id]), kills: n })),
    biggestShove: biggest ? { ...publicUser(s.users[biggest.userId]), cents: biggest.cents, money: money(biggest.cents) } : null,
    fallen: dethrones.slice(0, 20).map((e) => ({ at: e.createdAt, killer: s.users[e.actorId] && s.users[e.actorId].handle, fallen: e.meta.fallen, cents: e.cents }))
  };
}
ensureHouse();
module.exports = { now, money, utcDay, tierFor, ranked, createUser, sessionUser, login, publicUser, applyPayment, snapshot, trackers, hall, addEvent, applyUnlocks, dailyRanked, ensureHouse };
