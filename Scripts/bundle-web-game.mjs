#!/usr/bin/env node

/**
 * Copy the Vite production build into the iOS app and inline its generated
 * JavaScript and CSS. WKWebView blocks external module scripts loaded from a
 * file URL, while an inline module can run and still load bundled art using
 * paths relative to index.html.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'dist');
const destination = path.join(root, 'Vaalbara', 'Resources', 'WebApp');

if (!fs.existsSync(path.join(source, 'index.html'))) {
  throw new Error('dist/index.html is missing; run `npm run build` first');
}

fs.rmSync(destination, { recursive: true, force: true });
fs.cpSync(source, destination, { recursive: true });

const indexPath = path.join(destination, 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');

const scriptMatch = html.match(
  /<script type="module"[^>]*src="([^"]+)"[^>]*><\/script>/,
);
const styleMatch = html.match(
  /<link rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/,
);

if (!scriptMatch || !styleMatch) {
  throw new Error('Could not find generated Vite script and stylesheet tags');
}

const resolveAsset = (relativePath) =>
  path.join(destination, relativePath.replace(/^\.\//, ''));

const script = fs
  .readFileSync(resolveAsset(scriptMatch[1]), 'utf8')
  .replaceAll('</script', '<\\/script');
const style = fs
  .readFileSync(resolveAsset(styleMatch[1]), 'utf8')
  .replaceAll('</style', '<\\/style');

html = html
  // Use replacement callbacks so `$&`, `$`` and similar sequences inside the
  // minified bundle remain literal JavaScript rather than replacement tokens.
  .replace(scriptMatch[0], () => `<script type="module">${script}</script>`)
  .replace(styleMatch[0], () => `<style>${style}</style>`);

fs.writeFileSync(indexPath, html);
fs.rmSync(path.join(destination, 'assets'), { recursive: true, force: true });

console.log(`Bundled web game at ${destination}`);
