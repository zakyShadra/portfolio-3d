import { defineConfig } from 'vite';

// GitHub Pages serves this at https://<user>.github.io/portfolio-3d/, so the
// base path has to match the repo name there or assets 404 — but Vercel
// serves the same build at the domain root, where that prefix would break
// it instead. Vercel sets VERCEL=1 during its build, so key off that.
export default defineConfig({
  base: process.env.VERCEL ? '/' : '/portfolio-3d/',
});
