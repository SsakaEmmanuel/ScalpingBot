import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
const require = createRequire(import.meta.url);
const engine = require("../scalpingbot-v2-engine.js");

function candles(count, direction, startTime = 1_800_000_000, intervalSeconds = 60) {
  const rows = [];
  let price = 1.08;
  for (let i = 0; i < count; i++) {
    price += direction * 0.00012;
    const open = price - direction * 0.00004;
    const close = price + direction * 0.00004;
    rows.push({ time: startTime + i * intervalSeconds, open, high: Math.max(open, close) + 0.00008, low: Math.min(open, close) - 0.00008, close });
  }
  return rows;
}
const rising = candles(100, 1);
const now = (rising.at(-1).time + 120) * 1000;
const result = engine.analyze(rising, { timeframe: "M1", now });
assert.ok(["BUY", "SELL", "WAIT"].includes(result.signal));
assert.ok(result.candlesUsed >= 40);
assert.ok(Number.isFinite(result.atr) && result.atr > 0);
assert.ok(result.setupScore >= 0 && result.setupScore <= 100);
assert.ok(result.reasons.some(x => x.includes("Trend:")));
assert.match(result.invalidation, /invalidated|No trade/);

const formingOnly = engine.analyze(rising.slice(0, 40), { timeframe: "M1", now: (rising[39].time + 30) * 1000 });
assert.equal(formingOnly.candlesUsed, 39, "The still-forming final candle must be excluded");
assert.equal(formingOnly.signal, "WAIT");
assert.throws(() => engine.analyze(rising, { timeframe: "M2", now }), /Unsupported timeframe/);
assert.throws(() => engine.analyze({}, { timeframe: "M1", now }), /array/);

const alignedContext = candles(100, 1, 1_797_000_000, 300);
const bearishContext = candles(100, -1, 1_797_000_000, 300);
const aligned = engine.analyze(rising, { timeframe: "M1", now, context: { M5: alignedContext } });
assert.equal(aligned.contextBiases[0]?.bias, "BULLISH", "Higher timeframe bullish context must be detected");
const conflict = engine.analyze(rising, { timeframe: "M1", now, context: { M5: bearishContext } });
assert.equal(conflict.signal, "WAIT", "Conflicting higher timeframe context must block a directional signal");

const html = readFileSync(new URL("../ctrader.html", import.meta.url), "utf8");
const backend = readFileSync(new URL("../supabase/functions/ctrader-connect/index.ts", import.meta.url), "utf8");
assert.match(backend, /M30:\s*8/, "cTrader M30 period enum must match the official API");
assert.match(backend, /H1:\s*9/, "cTrader H1 period enum must match the official API");
assert.match(html, /contextCandles\[contextTf\]/, "Page must retrieve higher timeframe context");
assert.match(html, /value="H1"/, "H1 timeframe must be selectable");
assert.match(html, /scalpingbot-v2-engine\.js/, "cTrader page must load the v2 engine");
assert.match(html, /ScalpingBotV2\.analyze/, "cTrader analysis must use the v2 engine");
console.log("ScalpingBot v2 engine checks passed: completed-candle filtering, ATR, scoring, explanations, timeframe validation and page integration.");
