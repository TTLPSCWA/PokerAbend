// Monopoly-Theme-Assets ausliefern (ART-046, Paket F): ausschließlich hashbenannte, unveränderliche Bilddateien unter
//   /games/monopoly/themes/<theme>/assets/<asset>.<variante>.<sha256-12>.webp
// bekommen langes Caching (`public, max-age=31536000, immutable`). Der Dateiname enthält den Inhalts-Hash: ändert sich das Bild, ändert sich die URL.
// Alles andere (manifest.json, HTML, Skripte, APIs, andere Spiele) läuft unverändert durch die bestehende Auslieferung – es gibt keine globale Cache-Regel.
import express from 'express';

// Pfad relativ zum Einhängepunkt /games/monopoly/themes: streng, ohne Punkte außer der Dateiendung → kein Pfad-Traversal, keine Fremdformate
export const THEME_ASSET_PATH = /^\/[a-z][a-z0-9-]{1,23}\/assets\/[a-z][a-z0-9-]{0,40}\.(desktop|mobile|thumb)\.[0-9a-f]{12}\.webp$/;

export function themeAssets(root) {
  const files = express.static(root, { index: false, dotfiles: 'ignore', redirect: false, fallthrough: true, immutable: true, maxAge: '365d', extensions: false });
  return (req, res, next) => {
    if ((req.method !== 'GET' && req.method !== 'HEAD') || !THEME_ASSET_PATH.test(req.path)) return next();
    res.setHeader('X-Content-Type-Options', 'nosniff');
    files(req, res, next);
  };
}
