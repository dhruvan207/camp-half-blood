import { defineConfig } from 'vite';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Name des GitHub-Repositorys. Die Seite liegt später unter
// https://<benutzername>.github.io/camp-half-blood/
const REPO = 'camp-half-blood';

// Nur beim Arbeiten auf dem Mac (npm run dev): Texte aus der Infobox direkt in
// public/content.json speichern. Auf GitHub Pages gibt es das nicht, dort kann niemand etwas ändern.
function inhaltSpeichern() {
  const datei = fileURLToPath(new URL('./public/content.json', import.meta.url));
  return {
    name: 'inhalt-speichern',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__inhalt-speichern', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end();
          return;
        }
        let body = '';
        req.on('data', (chunk) => {
          body += chunk;
          if (body.length > 2_000_000) req.destroy();
        });
        req.on('end', () => {
          res.setHeader('Content-Type', 'application/json');
          try {
            const data = JSON.parse(body);
            if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Inhalt ist kein gültiges Objekt');
            writeFileSync(datei, JSON.stringify(data, null, 2) + '\n', 'utf8');
            res.end(JSON.stringify({ ok: true }));
          } catch (e) {
            res.statusCode = 400;
            res.end(JSON.stringify({ ok: false, fehler: e.message }));
          }
        });
      });
    },
  };
}

export default defineConfig(({ command }) => ({
  base: command === 'build' ? `/${REPO}/` : '/',
  plugins: [inhaltSpeichern()],
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1200,
  },
  server: {
    host: true,
    // Änderungen an content.json sollen die Seite nicht neu laden (sonst springt man zurück zum Start)
    watch: { ignored: ['**/public/content.json'] },
  },
}));
