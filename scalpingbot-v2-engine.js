(function (root) {
  "use strict";
  const INTERVAL_SECONDS = { M1: 60, M5: 300, M15: 900, M30: 1800, H1: 3600, H4: 14400 };

  function average(values) { return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length); }
  function ema(values, period) {
    const k = 2 / (period + 1);
    let result = values[0];
    for (let i = 1; i < values.length; i++) result = values[i] * k + result * (1 - k);
    return result;
  }
  function rsi(values, period) {
    if (values.length <= period) return 50;
    let gains = 0, losses = 0;
    for (let i = 1; i <= period; i++) {
      const change = values[i] - values[i - 1];
      gains += Math.max(change, 0);
      losses += Math.max(-change, 0);
    }
    let avgGain = gains / period, avgLoss = losses / period;
    for (let i = period + 1; i < values.length; i++) {
      const change = values[i] - values[i - 1];
      avgGain = (avgGain * (period - 1) + Math.max(change, 0)) / period;
      avgLoss = (avgLoss * (period - 1) + Math.max(-change, 0)) / period;
    }
    if (avgLoss === 0) return avgGain === 0 ? 50 : 100;
    return 100 - 100 / (1 + avgGain / avgLoss);
  }
  function atrSeries(candles, period) {
    const tr = candles.map((c, i) => {
      if (i === 0) return c.high - c.low;
      const previous = candles[i - 1].close;
      return Math.max(c.high - c.low, Math.abs(c.high - previous), Math.abs(c.low - previous));
    });
    let value = average(tr.slice(0, period));
    const values = [value];
    for (let i = period; i < tr.length; i++) {
      value = (value * (period - 1) + tr[i]) / period;
      values.push(value);
    }
    return values;
  }
  function analyze(input, options) {
    const opts = options || {};
    const timeframe = String(opts.timeframe || "M1").toUpperCase();
    const interval = INTERVAL_SECONDS[timeframe];
    if (!interval) throw new Error("Unsupported timeframe. Use M1, M5, M15, M30 or H1.");
    if (!Array.isArray(input)) throw new Error("Candle data must be an array.");

    const nowSeconds = Number.isFinite(Number(opts.now)) ? Number(opts.now) / 1000 : Date.now() / 1000;
    const unique = new Map();
    for (const raw of input) {
      const candle = {
        time: Number(raw.time), open: Number(raw.open), high: Number(raw.high),
        low: Number(raw.low), close: Number(raw.close), volume: Number(raw.volume || 0)
      };
      if (![candle.time, candle.open, candle.high, candle.low, candle.close].every(Number.isFinite)) continue;
      if (candle.high < Math.max(candle.open, candle.close, candle.low) ||
          candle.low > Math.min(candle.open, candle.close, candle.high)) continue;
      unique.set(candle.time, candle);
    }
    const candles = [...unique.values()].sort((a, b) => a.time - b.time)
      .filter(c => c.time + interval <= nowSeconds);
    if (candles.length < 40) {
      return { signal: "WAIT", setupScore: 0, reasons: ["At least 40 completed candles are required; the current forming candle is excluded."], invalidation: "Wait for more completed candles.", candlesUsed: candles.length, timeframe };
    }

    const closes = candles.map(c => c.close);
    const last = candles[candles.length - 1];
    const previous = candles[candles.length - 2];
    const ema9 = ema(closes.slice(-Math.min(closes.length, 80)), 9);
    const ema21 = ema(closes.slice(-Math.min(closes.length, 120)), 21);
    const rsi14 = rsi(closes, 14);
    const atrValues = atrSeries(candles, 14);
    const atr14 = atrValues[atrValues.length - 1];
    const typicalAtr = average(atrValues.slice(-Math.min(atrValues.length, 30)));
    const volatilityRatio = typicalAtr > 0 ? atr14 / typicalAtr : 1;
    const prior = candles.slice(-13, -1);
    const swingHigh = Math.max(...prior.map(c => c.high));
    const swingLow = Math.min(...prior.map(c => c.low));
    const bullishSweep = last.low < swingLow && last.close > swingLow;
    const bearishSweep = last.high > swingHigh && last.close < swingHigh;
    const bullishBreak = last.close > swingHigh;
    const bearishBreak = last.close < swingLow;
    const momentum = last.close - candles[candles.length - 4].close;
    const bullishTrend = ema9 > ema21 && last.close > ema9;
    const bearishTrend = ema9 < ema21 && last.close < ema9;
    const contextBiases = [];
    const contextInput = opts.context && typeof opts.context === "object" ? opts.context : {};
    for (const [contextTf, contextRows] of Object.entries(contextInput)) {
      const contextInterval = INTERVAL_SECONDS[String(contextTf).toUpperCase()];
      if (!contextInterval || !Array.isArray(contextRows)) continue;
      const contextCloses = contextRows
        .filter(c => Number(c.time) + contextInterval <= nowSeconds)
        .sort((a, b) => Number(a.time) - Number(b.time))
        .map(c => Number(c.close)).filter(Number.isFinite);
      if (contextCloses.length < 30) continue;
      const fast = ema(contextCloses.slice(-Math.min(contextCloses.length, 80)), 9);
      const slow = ema(contextCloses.slice(-Math.min(contextCloses.length, 120)), 21);
      const bias = fast > slow && contextCloses.at(-1) > fast ? "BULLISH"
        : fast < slow && contextCloses.at(-1) < fast ? "BEARISH" : "NEUTRAL";
      contextBiases.push({ timeframe: String(contextTf).toUpperCase(), bias, candles: contextCloses.length });
    }
    const bullishContexts = contextBiases.filter(x => x.bias === "BULLISH");
    const bearishContexts = contextBiases.filter(x => x.bias === "BEARISH");
    const contextConflict = bullishContexts.length > 0 && bearishContexts.length > 0;
    const contextSupportsBuy = bullishContexts.length > 0 && bearishContexts.length === 0;
    const contextSupportsSell = bearishContexts.length > 0 && bullishContexts.length === 0;
    const bullishRsi = rsi14 >= 52 && rsi14 < 72;
    const bearishRsi = rsi14 <= 48 && rsi14 > 28;
    const bullishCandle = last.close > last.open;
    const bearishCandle = last.close < last.open;
    const volatilitySafe = volatilityRatio >= 0.35 && volatilityRatio <= 2.5 && atr14 > 0;

    let bull = 0, bear = 0;
    if (bullishTrend) bull += 2;
    if (bearishTrend) bear += 2;
    if (momentum > 0) bull += 1;
    if (momentum < 0) bear += 1;
    if (bullishRsi) bull += 1;
    if (bearishRsi) bear += 1;
    if (bullishSweep || bullishBreak) bull += 1;
    if (bearishSweep || bearishBreak) bear += 1;
    if (bullishCandle) bull += 1;
    if (bearishCandle) bear += 1;
    if (contextSupportsBuy) bull += 2;
    if (contextSupportsSell) bear += 2;

    const reasons = [];
    reasons.push("Trend: EMA 9 " + (ema9 >= ema21 ? "above" : "below") + " EMA 21; latest completed close " + (last.close >= ema9 ? "above" : "below") + " EMA 9.");
    reasons.push("Momentum: 3-candle change is " + momentum.toPrecision(6) + "; RSI 14 is " + rsi14.toFixed(1) + ".");
    reasons.push("Structure: recent 12-candle high " + swingHigh.toPrecision(7) + ", low " + swingLow.toPrecision(7) + (bullishSweep ? "; bullish liquidity sweep detected." : bearishSweep ? "; bearish liquidity sweep detected." : bullishBreak ? "; close broke above the recent range." : bearishBreak ? "; close broke below the recent range." : "; no confirmed sweep or range break."));
    reasons.push("Volatility: ATR 14 is " + atr14.toPrecision(6) + "; current/typical ATR ratio is " + volatilityRatio.toFixed(2) + ".");
    if (contextBiases.length) reasons.push("Higher-timeframe alignment: " + contextBiases.map(x => x.timeframe + " " + x.bias).join(", ") + ".");
    else reasons.push("Higher-timeframe alignment: no confirmed context timeframe was supplied; this analysis is single-timeframe.");
    if (!volatilitySafe) reasons.push("No-trade filter: volatility is unusually compressed/expanded or ATR is unavailable.");
    if (bullishSweep && bearishSweep) reasons.push("Conflicting wick sweep conditions; wait for clearer structure.");
    if (contextConflict) reasons.push("No-trade filter: higher timeframes disagree with one another.");

    const signal = volatilitySafe && !contextConflict && (!contextBiases.length || contextSupportsBuy) && bull >= 5 && bull - bear >= 2 ? "BUY"
      : volatilitySafe && !contextConflict && (!contextBiases.length || contextSupportsSell) && bear >= 5 && bear - bull >= 2 ? "SELL" : "WAIT";
    const chosenScore = signal === "BUY" ? bull : signal === "SELL" ? bear : Math.max(bull, bear);
    const setupScore = Math.round(chosenScore / 6 * 100);
    if (signal === "BUY") reasons.push("Confluence: bullish trend, momentum, RSI, structure and candle direction meet the rule threshold.");
    else if (signal === "SELL") reasons.push("Confluence: bearish trend, momentum, RSI, structure and candle direction meet the rule threshold.");
    else reasons.push("Decision: WAIT. Directional evidence is not strong or clean enough under the current rules.");
    reasons.push("Setup score is a rule-confluence score, not a win probability or performance forecast.");

    const invalidation = signal === "BUY"
      ? "Bullish idea is invalidated below the recent structure low near " + swingLow.toPrecision(7) + "."
      : signal === "SELL"
        ? "Bearish idea is invalidated above the recent structure high near " + swingHigh.toPrecision(7) + "."
        : "No trade setup is active; reassess after a completed candle closes beyond the recent range with aligned momentum.";
    return {
      signal, setupScore, bullishScore: bull, bearishScore: bear, timeframe,
      candleTime: last.time, close: last.close, ema9, ema21, rsi: rsi14, atr: atr14,
      atrPercent: atr14 / last.close * 100, volatilityRatio, swingHigh, swingLow,
      momentum, candlesUsed: candles.length, contextBiases, reasons, invalidation
    };
  }

  const api = Object.freeze({ analyze });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.ScalpingBotV2 = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
