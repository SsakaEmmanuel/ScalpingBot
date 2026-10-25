import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../pocket-signals.html", import.meta.url), "utf8");
assert.match(html, /^<!doctype html>/i, "Pocket Signals must be an HTML document");

const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/i);
assert.ok(scriptMatch, "Expected one inline application script");
new Function(scriptMatch[1]);

const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]));
const references = [...scriptMatch[1].matchAll(/\$\("([^"]+)"\)/g)].map(match => match[1]);
const missing = [...new Set(references.filter(id => !ids.has(id)))];
assert.deepEqual(missing, [], "Every JavaScript element reference must exist in the HTML");

for (const id of ["modeSelect", "marketType", "asset", "assetSuggestions", "interval", "expiry", "marketApiKey", "priceChart", "runBacktest", "riskSummary", "journalRows", "exportJournal", "autoBtn"]) {
  assert.ok(ids.has(id), "Missing required UI element: " + id);
}
assert.match(html, /<input id="asset"[^>]*list="assetSuggestions"/, "Assets must accept custom market pairs");
assert.match(scriptMatch[1], /function normalizeAsset\(value\)/, "Custom market pairs must be normalized");
assert.match(scriptMatch[1], /sessionStorage\.setItem\("pocketSignalLiveKey"/, "The live key must be stored for the current session only");
assert.doesNotMatch(scriptMatch[1], /marketApiKey:\$\("marketApiKey"\)\.value\.trim\(\)/, "The live key must not be persisted with journal settings");
const visibleUi = html.slice(0, html.indexOf("<script>"));
assert.doesNotMatch(visibleUi, /Twelve Data/i, "The page UI should not expose the feed provider name");
assert.match(html, /option value="demo">Demo<\/option>/, "Demo mode must be available");
assert.match(html, /option value="live">Live market data<\/option>/, "Live mode must be available");
assert.match(html, /api\.twelvedata\.com\/time_series/, "Live time-series integration must exist");
for (const fn of ["evaluateSetup", "runHistoricalTest", "riskSnapshot", "startAutoScan", "exportCsv"]) {
  assert.ok(scriptMatch[1].includes("function " + fn), "Missing required engine feature: " + fn);
}
assert.match(html, /OTC is available in Demo mode only/i, "OTC must be restricted to Demo mode");

console.log("Pocket Signals checks passed: script syntax, required UI, element references, Demo/Live modes, live endpoint, engine features, and OTC guard.");
