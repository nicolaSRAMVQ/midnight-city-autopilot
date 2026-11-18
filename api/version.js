/**
 * Version endpoint — check if latest code is deployed
 */

export default function handler(req, res) {
  res.status(200).json({
    version: "v3.46-sprints-progression",
    timestamp: new Date().toISOString(),
    format: "Tolkien Newsletter",
    headers: ["CRÓNICA MATINAL", "PARTE MERIDIANO", "RELATO VESPERTINO", "SUSSURRO NOCTURNO"],
    features: [
      "mundo-playable",
      "mundo3d-integration",
      "telegram-menu",
      "alert-streaks",
      "minimalist-reporting",
      "tolkien-narratives",
      "flexible-windows",
      "flight-keepalive-protection",
      "c3po-no-axe-savings",
      "bb8-bulk-sell-80",
      "food-buffer-12",
      "dashboard-7d-opt",
      "fase2-forge-smithing",
      "fase2-workbench-crafting",
      "sprint1-bb8-no-tool-saving",
      "sprint1-craft-timeout-fix",
      "sprint1-instant-work-resume",
      "sprint2-quest-engine-deliveries",
      "sprint3-cooking-fish-reserve"
    ],
  });
}
