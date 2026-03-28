/**
 * Build script for the Chrome Extension.
 * Produces dist/ with all necessary files.
 */
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { writeFileSync, mkdirSync, copyFileSync, existsSync, readdirSync } from "fs";
import { corsRules } from "./src/background/dnr.js";

const __dir = dirname(fileURLToPath(import.meta.url));
const dist = resolve(__dir, "dist");

mkdirSync(dist, { recursive: true });

// Build each entry point separately to control output names
const builds = [
  { entry: "src/content/index.ts", outName: "content.js" },
  { entry: "src/background/index.ts", outName: "background.js" },
  { entry: "src/popup/popup.ts", outName: "popup.js" },
];

console.log("Building extension...");

let totalOutputs = 0;
for (const { entry, outName } of builds) {
  const result = await Bun.build({
    entrypoints: [resolve(__dir, entry)],
    outdir: dist,
    target: "browser",
    format: "esm",
    minify: false,
    naming: {
      entry: outName,
      chunk: "[name]-[hash].js",
    },
  });

  if (!result.success) {
    console.error(`Build failed for ${entry}:`);
    for (const log of result.logs) {
      console.error(log);
    }
    process.exit(1);
  }
  totalOutputs += result.outputs.length;
}

console.log(`Built ${totalOutputs} files.`);

// Build content CSS
console.log("Building CSS...");
const cssResult = await Bun.build({
  entrypoints: [resolve(__dir, "src/content/content.css")],
  outdir: dist,
  target: "browser",
  naming: { entry: "[name].css" },
});

if (!cssResult.success) {
  console.warn("CSS build had issues:", cssResult.logs);
}

// Copy popup CSS manually since it's not imported
copyFileSync(
  resolve(__dir, "src/popup/popup.css"),
  resolve(dist, "popup.css")
);

// Process popup.html — update script path and copy
const popupHtml = await Bun.file(resolve(__dir, "src/popup/popup.html")).text();
writeFileSync(resolve(dist, "popup.html"), popupHtml, "utf8");

// Write CORS rules JSON (for declarativeNetRequest)
writeFileSync(
  resolve(dist, "cors_rules.json"),
  JSON.stringify(corsRules, null, 2),
  "utf8"
);

// Copy manifest.json to dist (Chrome loads it from extension root)
// The manifest references dist/ for all files

console.log("Copying static assets...");
const assetsDir = resolve(__dir, "assets");
const distAssetsDir = resolve(dist, "assets");
if (existsSync(assetsDir)) {
  mkdirSync(distAssetsDir, { recursive: true });
  for (const file of readdirSync(assetsDir)) {
    copyFileSync(resolve(assetsDir, file), resolve(distAssetsDir, file));
  }
}

console.log("✓ Build complete! Load the extension root directory in Chrome.");
console.log(`  Extension directory: ${__dir}`);
