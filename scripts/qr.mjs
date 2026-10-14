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
  @page { size: A4 portrait; margin: 14mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; background: #fff; color: #1b1410; font-family: Georgia, 'Times New Roman', serif; }
  .seite { width: 182mm; margin: 0 auto; text-align: center; }
  .rahmen { border: 2.2mm solid #c9952f; border-radius: 6mm; padding: 9mm 11mm 8mm; }
  h1 { font-size: 34pt; margin: 0 0 2mm; letter-spacing: 0.02em; color: #8a5e14; }
  .unter { font-size: 13pt; font-style: italic; margin: 0 0 6mm; }
  .qr { width: 95mm; height: 95mm; margin: 0 auto; }
  .qr svg { width: 100%; height: 100%; display: block; }
  .aufruf { font-size: 21pt; font-weight: bold; margin: 5mm 0 6mm; }
  .anleitung { text-align: left; background: #faf3e3; border: 0.5mm solid #e2c88a; border-radius: 4mm; padding: 5mm 7mm 3mm; }
  .anleitung h2 { font-size: 14pt; margin: 0 0 3mm; color: #8a5e14; }
  .anleitung ol { list-style: none; margin: 0; padding: 0; counter-reset: schritt; }
  .anleitung li { counter-increment: schritt; position: relative; padding-left: 10mm; margin: 0 0 3mm; font-size: 12pt; line-height: 1.35; }
  .anleitung li::before { content: counter(schritt); position: absolute; left: 0; top: -0.3mm; width: 6.5mm; height: 6.5mm; border-radius: 50%; background: #c9952f; color: #fff; font-weight: bold; font-size: 10.5pt; line-height: 6.5mm; text-align: center; }
  .hinweis { font-size: 10pt; margin: 4mm 0 2mm; color: #5a4a3a; }
  .adresse { font-family: 'Courier New', monospace; font-size: 9.5pt; word-break: break-all; color: #666; margin: 0; }
  .knopf { margin: 6mm 0; }
  .knopf button { font: inherit; font-size: 12pt; padding: 3mm 8mm; border-radius: 999px; border: 0; background: #c9952f; color: #1b1410; cursor: pointer; }
  @media print { .knopf { display: none; } }
</style>
</head>
<body>
  <div class="seite">
    <div class="rahmen">
      <h1>Camp Half-Blood</h1>
      <p class="unter">Ein begehbares Buchprojekt zu „Percy Jackson – Diebe im Olymp“</p>
      <div class="qr" role="img" aria-label="QR-Code zur Website">${svg}</div>
      <p class="aufruf">Scannen und Camp Half-Blood betreten</p>
      <div class="anleitung">
        <h2>So funktioniert es</h2>
        <ol>
          <li><b>Kamera öffnen</b> und auf den QR-Code halten. Dann auf den Link tippen, der erscheint.</li>
          <li><b>Kurz warten</b>, bis das Camp geladen ist, und auf <b>„Camp betreten“</b> tippen.</li>
          <li><b>Laufen:</b> Mit dem Daumen den goldenen <b>Joystick</b> unten links in die gewünschte Richtung ziehen.</li>
          <li><b>Umschauen:</b> Mit dem anderen Finger über den Bildschirm wischen.</li>
          <li><b>Mehr erfahren:</b> Figuren, Namensschilder und Häuser <b>antippen</b>. Es öffnet sich eine Infobox. Mit dem <b>X</b> wieder schließen.</li>
        </ol>
      </div>
      <p class="hinweis">Funktioniert auf iPhone, iPad und Android-Handys. Internet wird benötigt.</p>
      <p class="adresse">${URL}</p>
    </div>
    <p class="knopf"><button type="button" onclick="window.print()">Drucken</button></p>
  </div>
</body>
</html>
`;
writeFileSync('druck/qr-druck.html', html);
console.log('Fertig: druck/qr-code.png und druck/qr-druck.html für ' + URL);
