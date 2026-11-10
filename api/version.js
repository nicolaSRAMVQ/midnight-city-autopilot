/**
 * Version endpoint — check if latest code is deployed
 */

export default function handler(req, res) {
  res.status(200).json({
    version: "v3.44-max-efficiency",
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
      "dashboard-7d-opt"
    ],
  });
}
