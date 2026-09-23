// Agent roster + per-profession economics (verified against /api/skill/merchants).
// Roster of the droid crew; agents without an id are skipped.
export const PROFESSIONS = {
  hacker: { workLabel: "trade crypto", sellItem: "meme_coin", merchant: "Central Crypto Merchant", batch: 1, crystalsPerBatch: 4 },
  miner: { workLabel: "minería", sellItem: "ore", merchant: "Central Merchant East", batch: 3, crystalsPerBatch: 4 },
  lumberjack: { workLabel: "tala", sellItem: "log", merchant: "Central Merchant West", batch: 5, crystalsPerBatch: 2 },
};

const ROSTER = [
  { name: "R2", id: "user-agent-z7oxfvxkjpod4b5", profession: "hacker" },
  { name: "BB-8", id: "user-agent-326gbw4lg4sjiiv", profession: "miner" },
  { name: "C-3PO", id: "user-agent-r5wd1einkurgide", profession: "lumberjack" },
];

export const AGENTS = ROSTER.filter((a) => a.id).map((a) => ({ ...a, profile: PROFESSIONS[a.profession] }));
