const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
const DATA_FILE = path.join(DATA_DIR, "state.json");

function blank() {
  return {
    users: {},
    sessions: {},
    payments: [],
    events: [],
    stripeEvents: {},
    throne: {
      holderId: null,
      since: null,
      armorUntil: 0,
      armorMarginCents: 0
    },
    banner: { text: "", until: 0, userId: null },
    daily: {},
    spectatorPicks: {},
    watchers: 0
  };
}

function load() {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    return { ...blank(), ...JSON.parse(raw) };
  } catch {
    return blank();
  }
}

let state = load();
let dirty = false;

function saveNow() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2));
  dirty = false;
}

setInterval(() => {
  if (dirty) saveNow();
}, 1500).unref();

process.on("exit", () => {
  if (dirty) saveNow();
});

module.exports = {
  get: () => state,
  touch() {
    dirty = true;
  },
  saveNow
};
