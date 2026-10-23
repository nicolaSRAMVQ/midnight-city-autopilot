/**
 * Version endpoint — check if latest code is deployed
 */

export default function handler(req, res) {
  res.status(200).json({
    version: "v3.39-mundo-play",
    timestamp: new Date().toISOString(),
    format: "Tolkien Newsletter",
    headers: ["CRÓNICA MATINAL", "PARTE MERIDIANO", "RELATO VESPERTINO", "SUSSURRO NOCTURNO"],
    features: ["mundo-playable", "mundo3d-integration", "telegram-menu", "alert-streaks", "minimalist-reporting", "tolkien-narratives", "flexible-windows"],
  });
}
