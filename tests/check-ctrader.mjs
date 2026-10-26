import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../ctrader.html", import.meta.url), "utf8");
const fn = readFileSync(new URL("../supabase/functions/ctrader-connect/index.ts", import.meta.url), "utf8");

assert.match(html, /^<!doctype html>/i, "cTrader connection must be a valid HTML page");
const scriptStart = html.indexOf("<script>");
const scriptEnd = html.indexOf("</script>", scriptStart);
assert.ok(scriptStart >= 0 && scriptEnd > scriptStart, "Expected the inline cTrader page script");
const script = html.slice(scriptStart + "<script>".length, scriptEnd);
new Function(script);

const idCounts = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
const ids = new Set(idCounts);
assert.equal(ids.size, idCounts.length, "Page element IDs must be unique");
const references = [...script.matchAll(/\$\("([^"]+)"\)/g)].map((match) => match[1]);
const missing = [...new Set(references.filter((id) => !ids.has(id)))];
assert.deepEqual(missing, [], "Every cTrader page DOM reference must exist");

for (const id of ["mainStatus", "connectBtn", "refreshBtn", "accountSelect", "accountBtn", "marketBtn", "candlesBody"]) {
  assert.ok(ids.has(id), "Missing required cTrader UI element: " + id);
}
assert.match(html, /functions\/v1\/ctrader-connect/, "Page must call the Supabase Edge Function");
assert.match(script, /session\.access_token/, "Backend calls must send the signed-in Supabase session");
assert.match(html, /No order operations were requested|cannot place orders/i, "UI must remain read-only");
assert.doesNotMatch(html, /<input[^>]+(client.?secret|access.?token|refresh.?token)/i, "The browser must not collect cTrader secrets or tokens");
assert.doesNotMatch(html, /access_token_ciphertext|refresh_token_ciphertext|CTRADER_CLIENT_SECRET/i, "Sensitive backend fields must not be exposed in the client page");

assert.match(fn, /auth\/v1\/user/, "Edge Function must validate the Supabase user session");
assert.match(fn, /ctrader_oauth_states/, "OAuth state must be stored and checked server-side");
assert.match(fn, /AES-GCM/, "cTrader tokens must be encrypted before storage");
assert.match(fn, /scope", "accounts"/, "OAuth must request read-only account scope");
assert.match(fn, /wss:\/\/demo\.ctraderapi\.com:5036/, "Requests must use cTrader's demo-only JSON WebSocket");
assert.match(fn, /2121/, "Account information request must be implemented");
assert.match(fn, /2137/, "Historical candle request must be implemented");
assert.doesNotMatch(fn, /payloadType:\s*2106/, "The function must not add order-placement requests");

console.log("cTrader checks passed: inline script syntax, DOM references, session auth, one-time state, encrypted tokens, demo-only host, and read-only market/account actions.");
