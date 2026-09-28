/**
 * Version endpoint — check if latest code is deployed
 */

export default function handler(req, res) {
  res.status(200).json({
    version: "v3.21-live",
    timestamp: new Date().toISOString(),
    format: "Tolkien Newsletter",
    headers: ["CRÓNICA MATINAL", "PARTE MERIDIANO", "RELATO VESPERTINO", "SUSSURRO NOCTURNO"],
    features: ["minimalist-reporting", "tolkien-narratives", "flexible-windows"],
  });
}
