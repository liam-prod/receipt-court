import { defineConfig } from 'vite';

// Built output lands in docs/ so GitHub Pages can serve it straight from main.
// The app also runs unbuilt (plain ES modules) — the build is an optimisation,
// never a dependency of the courtroom working.
export default defineConfig({
  base: './',
  build: { outDir: 'docs', emptyOutDir: true, target: 'es2020' },
});
