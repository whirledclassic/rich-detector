const TIERS = [
  { minCents: 100, id: "broke", title: "Broke on purpose", border: "gray" },
  { minCents: 500, id: "pocket", title: "Pocket change", border: "color" },
  { minCents: 1500, id: "comfortable", title: "Comfortable", border: "static" },
  { minCents: 4000, id: "welloff", title: "Well off", border: "dust" },
  { minCents: 10000, id: "rich", title: "Rich", border: "theme" },
  { minCents: 25000, id: "filthy", title: "Filthy", border: "idle" },
  { minCents: 50000, id: "dynasty", title: "Dynasty", border: "trail" }
];

const COSMETICS = [
  { id: "border-gray", slot: "border", name: "Tin plate", tier: "broke" },
  { id: "border-color", slot: "border", name: "Named color", tier: "pocket" },
  { id: "border-static", slot: "border", name: "Gold wire", tier: "comfortable" },
  { id: "border-dust", slot: "border", name: "Gold dust", tier: "welloff" },
  { id: "border-theme", slot: "border", name: "Liquid gold", tier: "rich" },
  { id: "border-idle", slot: "border", name: "Living flame", tier: "filthy" },
  { id: "border-trail", slot: "border", name: "Dynasty trail", tier: "dynasty" },
  { id: "border-cracked", slot: "border", name: "Cracked throne", special: "fallen" },
  { id: "border-throne", slot: "border", name: "Living throne", special: "throne" },
  { id: "banner-plain", slot: "banner", name: "Quiet cloth", tier: "comfortable" },
  { id: "banner-wide", slot: "banner", name: "Wide velvet", tier: "rich" },
  { id: "banner-smoke", slot: "banner", name: "Gold smoke", tier: "dynasty" },
  { id: "title-default", slot: "title", name: "No title", tier: "broke" },
  { id: "effect-sparkle", slot: "effect", name: "Click sparkle", tier: "pocket" },
  { id: "effect-drip", slot: "effect", name: "Lock drip", special: "sku" }
];

const SKUS = {
  SHOVE: { label: "Shove", addsScore: true, minCents: 100 },
  FLEX: { label: "Flex", addsScore: true, cents: 300, durationMs: 10_000 },
  BANNER_NIGHT: { label: "Banner night", addsScore: true, cents: 800, durationMs: 15 * 60_000 },
  LOCK_DRIP: { label: "Lock drip", addsScore: true, cents: 1200, durationMs: 30 * 60_000 },
  THRONE_ARMOR_15: { label: "Throne armor 15m", addsScore: false, cents: 500, armorMs: 15 * 60_000, marginCents: 500 },
  THRONE_ARMOR_30: { label: "Throne armor 30m", addsScore: false, cents: 900, armorMs: 30 * 60_000, marginCents: 1000 },
  THRONE_ARMOR_60: { label: "Throne armor 60m", addsScore: false, cents: 1500, armorMs: 60 * 60_000, marginCents: 1500 },
  REPAIR_FRAME: { label: "Repair cracked frame", addsScore: false, cents: 500 }
};

const MIN_SHOVE_CENTS = 100;
const MAX_SHOVE_CENTS = 50_000;

module.exports = {
  TIERS,
  COSMETICS,
  SKUS,
  MIN_SHOVE_CENTS,
  MAX_SHOVE_CENTS,
  HOUSE_HANDLE: "THE_HOUSE"
};
