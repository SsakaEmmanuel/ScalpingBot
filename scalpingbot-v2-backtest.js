(function (root) {
  "use strict";
  const INTERVAL = { M1: 60, M5: 300, M15: 900, M30: 1800, H1: 3600 };
  function run(candles, options) {
    const opts = options || {};
    const timeframe = String(opts.timeframe || "M1").toUpperCase();
    const seconds = INTERVAL[timeframe];
    if (!seconds) throw new Error("Unsupported backtest timeframe.");
    if (!Array.isArray(candles)) throw new Error("Backtest candles must be an array.");
    const spread = Number(opts.spread || 0);
    const commission = Number(opts.commission || 0);
    const slippage = Number(opts.slippage || 0);
    const riskAtr = Number(opts.riskAtr || 1.5);
    const rewardRisk = Number(opts.rewardRisk || 2);
    const maxHoldBars = Math.max(1, Math.min(200, Math.trunc(Number(opts.maxHoldBars || 20))));
    if (![spread, commission, slippage, riskAtr, rewardRisk].every(Number.isFinite) ||
        spread < 0 || commission < 0 || slippage < 0 || riskAtr <= 0 || rewardRisk <= 0) {
      throw new Error("Costs and risk settings must be non-negative, with positive ATR and reward-risk values.");
    }
    const engine = root.ScalpingBotV2;
    if (!engine || typeof engine.analyze !== "function") throw new Error("Load the ScalpingBot 2.0 signal engine first.");

    const rows = candles.map(c => ({
      time: Number(c.time), open: Number(c.open), high: Number(c.high),
      low: Number(c.low), close: Number(c.close), volume: Number(c.volume || 0)
    })).filter(c => [c.time,c.open,c.high,c.low,c.close].every(Number.isFinite))
      .sort((a,b)=>a.time-b.time);
    if (rows.length < 80) throw new Error("Backtesting requires at least 80 valid candles.");
    const trades = [];
    let nextAllowedIndex = 0;
    let equityR = 0, peakR = 0, maxDrawdownR = 0;
    for (let i = 39; i < rows.length - 2; i++) {
      if (i < nextAllowedIndex) continue;
      const signalTime = rows[i].time;
      const analysis = engine.analyze(rows.slice(0, i + 1), {
        timeframe, now: (signalTime + seconds) * 1000
      });
      if (analysis.signal !== "BUY" && analysis.signal !== "SELL") continue;
      const entryBar = rows[i + 1];
      const entry = analysis.signal === "BUY" ? entryBar.open + spread : entryBar.open;
      const riskDistance = analysis.atr * riskAtr;
      if (!Number.isFinite(riskDistance) || riskDistance <= 0) continue;
      const stop = analysis.signal === "BUY" ? entry - riskDistance : entry + riskDistance;
      const target = analysis.signal === "BUY" ? entry + riskDistance * rewardRisk : entry - riskDistance * rewardRisk;
      const lastIndex = Math.min(rows.length - 1, i + maxHoldBars);
      let exit = rows[lastIndex].close;
      let exitIndex = lastIndex;
      let exitReason = "TIME";
      for (let j = i + 1; j <= lastIndex; j++) {
        const bar = rows[j];
        const stopHit = analysis.signal === "BUY" ? bar.low <= stop : bar.high >= stop;
        const targetHit = analysis.signal === "BUY" ? bar.high >= target : bar.low <= target;
        if (stopHit) { exit = stop; exitIndex = j; exitReason = "STOP"; break; }
        if (targetHit) { exit = target; exitIndex = j; exitReason = "TARGET"; break; }
      }
      const gross = analysis.signal === "BUY" ? exit - entry : entry - exit;
      const totalCosts = spread + commission + (2 * slippage);
      const net = gross - totalCosts;
      const netR = net / riskDistance;
      equityR += netR;
      peakR = Math.max(peakR, equityR);
      maxDrawdownR = Math.max(maxDrawdownR, peakR - equityR);
      trades.push({
        direction: analysis.signal, signalTime, entryTime: entryBar.time,
        exitTime: rows[exitIndex].time, entry, exit, stop, target,
        exitReason, gross, costs: totalCosts, net, netR,
        setupScore: analysis.setupScore
      });
      nextAllowedIndex = exitIndex + 1;
      i = Math.max(i, exitIndex - 1);
    }
    const wins = trades.filter(t => t.net > 0);
    const losses = trades.filter(t => t.net < 0);
    const grossProfit = wins.reduce((s,t)=>s+t.net,0);
    const grossLoss = Math.abs(losses.reduce((s,t)=>s+t.net,0));
    const netTotal = trades.reduce((s,t)=>s+t.net,0);
    return {
      timeframe, trades, tradeCount: trades.length,
      winRate: trades.length ? wins.length / trades.length * 100 : 0,
      profitFactor: grossLoss ? grossProfit / grossLoss : grossProfit ? null : 0,
      expectancy: trades.length ? netTotal / trades.length : 0,
      netTotal, maxDrawdownR, totalCosts: trades.reduce((s,t)=>s+t.costs,0),
      assumptions: {
        entry: "Next candle open after signal candle closes",
        costs: "Spread charged once per round trip, commission as round-trip price units, slippage on entry and exit",
        sameBarStopAndTarget: "Stop is assumed first (conservative)",
        context: "Single-timeframe historical test; no future candles are used to form a signal"
      }
    };
  }
  const api = Object.freeze({ run });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.ScalpingBotBacktest = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
