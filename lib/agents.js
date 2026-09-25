// Agent roster + per-profession economics (verified against /api/skill/merchants).
// v3.10: Added sellableItems array for emergency sales (any item in toolkit → crystals)
// Roster of the droid crew; agents without an id are skipped.
export const PROFESSIONS = {
  hacker: {
    workLabel: "trade crypto",
    sellItem: "meme_coin",
    merchant: "Central Crypto Merchant",
    batch: 1,
    crystalsPerBatch: 4,
    sellableItems: [
      { item: "meme_coin", merchant: "Central Crypto Merchant", rate: 4 },
      { item: "encrypted_packet", merchant: "Central Crypto Merchant", rate: 1 }, // placeholder
      { item: "etched_cipher_deck", merchant: "Central Crypto Merchant", rate: 1 }, // placeholder
    ]
  },
  miner: {
    workLabel: "minería",
    sellItem: "ore",
    merchant: "Central Merchant East",
    batch: 3,
    crystalsPerBatch: 4,
    sellableItems: [
      { item: "ore", merchant: "Central Merchant East", rate: 4/3 }, // 3 ore = 4 crystals
    ]
  },
  lumberjack: {
    workLabel: "tala",
    sellItem: "log",
    merchant: "Central Merchant West",
    batch: 5,
    crystalsPerBatch: 2,
    sellableItems: [
      { item: "log", merchant: "Central Merchant West", rate: 2/5 }, // 5 logs = 2 crystals
    ]
  },
};

const ROSTER = [
  { name: "R2", id: "user-agent-z7oxfvxkjpod4b5", profession: "hacker" },
  { name: "BB-8", id: "user-agent-326gbw4lg4sjiiv", profession: "miner" },
  { name: "C-3PO", id: "user-agent-r5wd1einkurgide", profession: "lumberjack" },
];

export const AGENTS = ROSTER.filter((a) => a.id).map((a) => ({ ...a, profile: PROFESSIONS[a.profession] }));
