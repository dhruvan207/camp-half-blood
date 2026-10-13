// Erzeugt den QR-Code (PNG, hohe Auflösung, Fehlerkorrektur „H“) und die A4-Druckseite.
// Aufruf im Projektordner:  npm run qr

import QRCode from 'qrcode';
import { writeFileSync } from 'node:fs';

const URL = 'https://dhruvan207.github.io/camp-half-blood/';

// Bild zum Drucken oder Einfügen ins Plakat (2400 × 2400 Pixel)
await QRCode.toFile('druck/qr-code.png', URL, {
  errorCorrectionLevel: 'H', // auch lesbar, wenn ein Teil verdeckt oder zerknittert ist
  width: 2400,
  margin: 4,
  color: { dark: '#1b1410', light: '#ffffff' },
});

// gestochen scharfe Vektor-Version für die Druckseite
const svg = await QRCode.toString(URL, { type: 'svg', errorCorrectionLevel: 'H', margin: 2, color: { dark: '#1b1410', light: '#ffffff' } });

const html = `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Camp Half-Blood – QR-Code zum Ausdrucken</title>
<style>
  @page { size: A4 portrait; margin: 18mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; background: #fff; color: #1b1410; font-family: Georgia, 'Times New Roman', serif; }
  .seite { width: 100%; max-width: 174mm; min-height: 255mm; margin: 0 auto; padding: 8mm 0; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
  .rahmen { border: 2.5mm solid #c9952f; border-radius: 6mm; padding: 14mm 12mm; width: 100%; }
  h1 { font-size: 34pt; margin: 0 0 3mm; letter-spacing: 0.02em; color: #8a5e14; }
  .unter { font-size: 14pt; font-style: italic; margin: 0 0 10mm; }
  .qr { width: 120mm; height: 120mm; margin: 0 auto; }
  .qr svg { width: 100%; height: 100%; display: block; }
  .aufruf { font-size: 22pt; font-weight: bold; margin: 10mm 0 3mm; }
  .tipp { font-size: 12pt; margin: 0 0 6mm; }
  .adresse { font-family: 'Courier New', monospace; font-size: 10.5pt; word-break: break-all; color: #555; }
  .knopf { margin: 6mm 0 0; }
  .knopf button { font: inherit; font-size: 12pt; padding: 3mm 8mm; border-radius: 999px; border: 0; background: #c9952f; color: #1b1410; cursor: pointer; }
  @media print { .knopf { display: none; } .seite { min-height: auto; } }
</style>
</head>
<body>
  <div class="seite">
    <div class="rahmen">
      <h1>Camp Half-Blood</h1>
      <p class="unter">Ein begehbares Buchprojekt zu „Percy Jackson – Diebe im Olymp“</p>
      <div class="qr" role="img" aria-label="QR-Code zur Website">${svg}</div>
      <p class="aufruf">Scannen und Camp Half-Blood betreten</p>
      <p class="tipp">Mit der Handykamera scannen · Joystick zum Laufen · Namen und Häuser antippen</p>
      <p class="adresse">${URL}</p>
    </div>
    <p class="knopf"><button type="button" onclick="window.print()">Drucken</button></p>
  </div>
</body>
</html>
`;
writeFileSync('druck/qr-druck.html', html);
console.log('Fertig: druck/qr-code.png und druck/qr-druck.html für ' + URL);
