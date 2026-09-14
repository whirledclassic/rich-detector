const http = require("http");
const path = require("path");
const express = require("express");
const { WebSocketServer } = require("ws");
const Stripe = require("stripe");
const game = require("./game");
const store = require("./store");
const { SKUS, MIN_SHOVE_CENTS, MAX_SHOVE_CENTS, COSMETICS, TIERS } = require("./config");

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_URL = process.env.PUBLIC_URL || ("http://localhost:" + PORT);
const ADMIN_KEY = process.env.ADMIN_KEY || "dev-admin";
const stripeKey = process.env.STRIPE_SECRET_KEY || "";
const stripe = stripeKey ? new Stripe(stripeKey) : null;
const DEMO = !stripe;

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

app.use((req, res, next) => {
  if (req.path === "/api/stripe/webhook") return next();
  express.json()(req, res, next);
});

function sid(req) {
  const h = req.headers.authorization || "";
  if (h.startsWith("Bearer ")) return h.slice(7);
  return req.headers["x-session"] || req.query.session || "";
}
function requireUser(req, res, next) {
  const u = game.sessionUser(sid(req));
  if (!u) return res.status(401).json({ error: "Sign in first" });
  req.user = u;
  next();
}
const sockets = new Set();
function broadcast(obj) {
  const raw = JSON.stringify(obj);
  for (const ws of sockets) if (ws.readyState === 1) ws.send(raw);
}
function pushBoard() {
  broadcast({ type: "board.snapshot", data: game.snapshot(null) });
}
wss.on("connection", (ws) => {
  sockets.add(ws);
  store.get().watchers = sockets.size;
  store.touch();
  ws.send(JSON.stringify({ type: "board.snapshot", data: game.snapshot(null) }));
  ws.on("close", () => { sockets.delete(ws); store.get().watchers = sockets.size; store.touch(); });
});
setInterval(() => broadcast({ type: "trackers.tick", data: game.trackers(null) }), 1000).unref();
app.use(express.static(path.join(__dirname, "..", "public")));
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, demo: DEMO, lastPayment: store.get().payments[0] && store.get().payments[0].createdAt || null, users: Object.keys(store.get().users).length });
});
app.get("/api/state", (req, res) => {
  const u = game.sessionUser(sid(req));
  res.json({ demo: DEMO, publishable: process.env.STRIPE_PUBLISHABLE_KEY || "", me: u ? game.publicUser(u, { private: true }) : null, cosmetics: COSMETICS, tiers: TIERS, skus: SKUS, snapshot: game.snapshot(u) });
});
app.get("/api/trackers", (req, res) => res.json(game.trackers(game.sessionUser(sid(req)))));
app.get("/api/hall", (_req, res) => res.json(game.hall()));
app.get("/api/u/:handle", (req, res) => {
  const u = Object.values(store.get().users).find((x) => x.handle.toLowerCase() === String(req.params.handle).toLowerCase());
  if (!u) return res.status(404).json({ error: "Not found" });
  res.json({ user: game.publicUser(u), payments: store.get().payments.filter((p) => p.userId === u.id).length });
});
app.post("/api/register", (req, res) => {
  try {
    const user = game.createUser({ handle: req.body.handle, email: req.body.email });
    const session = game.login(user.id);
    res.json({ session, user: game.publicUser(user, { private: true }) });
  } catch (e) { res.status(400).json({ error: e.message }); }
});
app.post("/api/login", (req, res) => {
  const handle = String(req.body.handle || "");
  const u = Object.values(store.get().users).find((x) => x.handle.toLowerCase() === handle.toLowerCase() && !x.isHouse);
  if (!u) return res.status(404).json({ error: "No player with that handle" });
  const session = game.login(u.id);
  u.lastSeenAt = Date.now(); store.touch();
  res.json({ session, user: game.publicUser(u, { private: true }) });
});
app.post("/api/me/tagline", requireUser, (req, res) => {
  const t = String(req.body.tagline || "").slice(0, 80);
  if (/https?:|crypto|wallet|venmo|cashapp|wire me/i.test(t)) return res.status(400).json({ error: "Tagline blocked" });
  req.user.tagline = t; store.touch(); pushBoard(); res.json({ ok: true });
});
app.post("/api/me/equip", requireUser, (req, res) => {
  const { slot, id } = req.body || {};
  if (!req.user.unlocks.includes(id) && id !== "border-throne") return res.status(400).json({ error: "Locked" });
  if (id === "border-throne" && store.get().throne.holderId !== req.user.id) return res.status(400).json({ error: "Throne frame is only for #1" });
  req.user.loadout[slot] = id; store.touch(); pushBoard();
  res.json({ user: game.publicUser(req.user) });
});
app.post("/api/pick", requireUser, (req, res) => {
  const day = game.utcDay();
  const handle = String(req.body.handle || "");
  const target = Object.values(store.get().users).find((x) => x.handle.toLowerCase() === handle.toLowerCase());
  if (!target) return res.status(404).json({ error: "No such name" });
  store.get().spectatorPicks[day + ":" + req.user.id] = target.id; store.touch();
  res.json({ ok: true, day, pick: target.handle });
});
app.post("/api/checkout", requireUser, async (req, res) => {
  const sku = req.body.sku || "SHOVE";
  const spec = SKUS[sku];
  if (!spec) return res.status(400).json({ error: "Unknown play" });
  let cents = spec.cents || Number(req.body.cents || 0);
  if (sku === "SHOVE") {
    cents = Number(req.body.cents || 0);
    if (cents < MIN_SHOVE_CENTS || cents > MAX_SHOVE_CENTS) return res.status(400).json({ error: "Shove out of range" });
  }
  if (sku.startsWith("THRONE_ARMOR") && store.get().throne.holderId !== req.user.id) return res.status(400).json({ error: "Only #1 can buy armor" });
  if (req.body && req.body.bannerText) store.get()._pendingBanner = String(req.body.bannerText).slice(0, 80);
  if (DEMO) {
    try {
      const result = game.applyPayment({ userId: req.user.id, cents, sku, stripeId: null });
      pushBoard();
      if (result.dethroned) console.log("[mail] The throne is gone. " + result.dethroned.handle + " fell to " + req.user.handle);
      return res.json({ demo: true, result, snapshot: game.snapshot(req.user) });
    } catch (e) { return res.status(400).json({ error: e.message }); }
  }
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    success_url: PUBLIC_URL + "/?paid=1",
    cancel_url: PUBLIC_URL + "/#/shove",
    metadata: { userId: req.user.id, sku, cents: String(cents) },
    line_items: [{ quantity: 1, price_data: { currency: "usd", unit_amount: cents, product_data: { name: "Rich Detector · " + spec.label } } }]
  });
  res.json({ url: session.url });
});
app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), (req, res) => {
  if (!stripe) return res.json({ ok: true, demo: true });
  let event;
  try { event = stripe.webhooks.constructEvent(req.body, req.headers["stripe-signature"], process.env.STRIPE_WEBHOOK_SECRET); }
  catch (err) { return res.status(400).send("Webhook error: " + err.message); }
  if (store.get().stripeEvents[event.id]) return res.json({ received: true, dup: true });
  store.get().stripeEvents[event.id] = Date.now(); store.touch();
  if (event.type === "checkout.session.completed") {
    const sess = event.data.object;
    try {
      game.applyPayment({ userId: sess.metadata.userId, cents: Number(sess.metadata.cents || sess.amount_total || 0), sku: sess.metadata.sku || "SHOVE", stripeId: sess.payment_intent || sess.id });
      pushBoard();
    } catch (e) { console.error("applyPayment failed", e); }
  }
  res.json({ received: true });
});
app.post("/api/admin/freeze", (req, res) => {
  if (req.headers["x-admin-key"] !== ADMIN_KEY) return res.status(401).json({ error: "no" });
  res.json({ ok: true });
});
app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "..", "public", "index.html")));
server.listen(PORT, () => console.log("Rich Detector on " + PUBLIC_URL + " demo=" + DEMO));
