import { defineConfig } from 'vite';

// Name des GitHub-Repositorys. Die Seite liegt später unter
// https://<benutzername>.github.io/camp-half-blood/
const REPO = 'camp-half-blood';

export default defineConfig(({ command }) => ({
  base: command === 'build' ? `/${REPO}/` : '/',
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1200,
  },
  server: {
    host: true,
  },
}));
