import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
require("../scalpingbot-v2-engine.js");
const backtest = require("../scalpingbot-v2-backtest.js");
function bars(count, direction) {
  let price = 1.08;
  return Array.from({length:count},(_,i)=>{
    price += direction * 0.00012;
    const open=price-direction*0.00004, close=price+direction*0.00004;
    return {time:1800000000+i*60,open,high:Math.max(open,close)+0.00008,low:Math.min(open,close)-0.00008,close};
  });
}
const result=backtest.run(bars(180,1),{timeframe:"M1",spread:0.00002,commission:0.00001,slippage:0.00001,maxHoldBars:15});
assert.ok(result.tradeCount>0, "Synthetic trend sample should produce testable setups");
assert.equal(result.trades.length,result.tradeCount);
assert.ok(result.totalCosts>0, "Configured spread, commission and slippage must be charged");
assert.ok(result.maxDrawdownR>=0);
assert.equal(result.assumptions.sameBarStopAndTarget,"Stop is assumed first (conservative)");
assert.throws(()=>backtest.run([],{}),/80 valid candles/);
assert.throws(()=>backtest.run(bars(100,1),{spread:-1}),/non-negative/);
console.log("ScalpingBot v2 backtest checks passed: validation, costs, conservative same-bar handling and metrics.");
