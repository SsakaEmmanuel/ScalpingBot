// ScalpingBot dashboard UI and per-user settings persistence.
// No trading commands are sent. MT5 remains locked.

const tabNames = [
  "Overview",
  "Market Analysis",
  "Demo Trading",
  "Trade history",
  "Account status",
  "Settings"
];

const sidebar = document.querySelector("#privateDashboard aside");
const main = document.querySelector("#privateDashboard .dash-main");
const supabaseClient = () => window.SCALPINGBOT_SUPABASE || null;

if (sidebar && main) {
  const navItems = [...sidebar.querySelectorAll("b")].slice(0, 6);
  const originalMainHTML = main.innerHTML;

  const settingsHTML = () => `
    <div class="panel">
      <h3>Settings</h3>
      <p>Settings are saved to your private Supabase account.
      They do not connect to MT5 or place trades.</p>
      <label>Symbol
        <select id="settingsSymbol">
          <option>EURUSD</option><option>GBPUSD</option>
          <option>USDJPY</option><option>XAUUSD</option>
        </select>
      </label>
      <label>Timeframe
        <select id="settingsTimeframe">
          <option>M1</option><option>M5</option>
        </select>
      </label>
      <label>Risk per trade
        <select id="settingsRisk">
          <option value="0.25">0.25%</option>
          <option value="0.5" selected>0.5%</option>
          <option value="1">1.0%</option>
        </select>
      </label>
      <label>Daily loss limit
        <select id="settingsDaily">
          <option value="1">1.0%</option>
          <option value="2" selected>2.0%</option>
          <option value="3">3.0%</option>
        </select>
      </label>
      <button class="btn primary full" id="saveSettings">Save settings</button>
      <p id="settingsStatus" class="notice" role="status">Loading your saved settings…</p>
    </div>
  `;

  const demoPanelHTML = () => `
    <div class="panel" id="demoEnginePanel">
      <h3>Strategy signals & demo engine <span class="tag">SIMULATION ONLY</span></h3>
      <p>EMA 9/21 trend + RSI 14 filter. Signals are educational, not guarantees. Simulated results use candle data and simplified costs.</p>
      <div class="demo-stats">
        <div><small>Signal</small><strong id="demoSignal">Waiting for candles</strong></div>
        <div><small>Demo balance</small><strong id="demoBalance">$10,000.00</strong></div>
        <div><small>Closed trades</small><strong id="demoClosedCount">0</strong></div>
        <div><small>Win rate</small><strong id="demoWinRate">—</strong></div>
      </div>
      <p id="demoReason" class="notice" role="status">Waiting for market candles to explain the current signal.</p>
      <p id="demoIndicators" class="notice">Indicator details will appear when enough candles are available.</p>
      <p id="demoRiskSummary" class="notice">Demo risk: 0.5% per trade · Daily loss limit: 2.0%.</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin:10px 0">
        <button class="btn primary" id="demoStart" type="button">Start demo simulation</button>
        <button class="btn outline" id="demoPause" type="button">Pause simulation</button>
        <button class="btn outline" id="demoReset" type="button">Reset demo results</button>
      </div>
      <p id="demoStatus" class="notice" role="status">Simulation is paused. No real orders can be sent.</p>
      <p><small>Dashboard refresh: every 1 second · External market feed: every 30 seconds to reduce provider rate-limit risk.</small></p>
      <div id="demoOpenTrade" class="empty">No open simulated trade.</div>
    </div>
  `;

  const marketPanelHTML = () => `
    <div class="panel" id="liveMarketPanel">
      <h3>Live market data <span class="tag">External feed</span></h3>
      <p>Indicative third-party prices; not broker quotes and may be delayed.</p>
      <div class="feed-status" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:10px 0">
        <span id="feedIndicator" aria-hidden="true" style="display:inline-block;width:9px;height:9px;border-radius:50%;background:#e0a34b"></span>
        <strong id="feedConnectionState">Connecting to external feed…</strong>
        <small id="feedAutoState">Auto-refresh: every 30 seconds</small>
      </div>
      <div class="market-controls" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px">
        <label>Market symbol
          <select id="marketSymbol">
            <option value="EURUSD">EUR/USD</option>
            <option value="GBPUSD">GBP/USD</option>
            <option value="USDJPY">USD/JPY</option>
            <option value="XAUUSD">Gold (XAU/USD proxy)</option>
          </select>
        </label>
        <label>Chart timeframe
          <select id="marketTimeframe">
            <option value="1m">M1 · 1 minute</option>
            <option value="5m" selected>M5 · 5 minutes</option>
            <option value="15m">M15 · 15 minutes</option>
            <option value="30m">M30 · 30 minutes</option>
            <option value="60m">H1 · 1 hour</option>
          </select>
        </label>
      </div>
      <div class="market-quote"><small id="marketSymbolLabel">EUR/USD</small><h2 id="marketPrice">Loading…</h2><p id="marketState" class="notice" role="status">Connecting to market-data service…</p></div>
      <div class="chart-switch" role="group" aria-label="Chart type" style="display:flex;gap:8px;margin:12px 0">
        <button class="btn primary" id="lineChartBtn" type="button" aria-pressed="true">Line</button>
        <button class="btn outline" id="candleChartBtn" type="button" aria-pressed="false">Candlestick</button>
      </div>
      <div class="chart-zoom" role="group" aria-label="Chart zoom controls" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:8px 0">
        <button class="btn outline" id="zoomOut" type="button" aria-label="Zoom out">−</button>
        <button class="btn outline" id="zoomIn" type="button" aria-label="Zoom in">+</button>
        <button class="btn outline" id="zoomReset" type="button">Reset zoom</button>
        <small id="zoomLabel">60 candles</small>
      </div>
      <svg id="marketChart" viewBox="0 0 600 180" role="img" aria-label="Recent indicative market prices" style="width:100%;height:auto;min-height:120px;touch-action:pan-y"></svg>
      <p><small id="marketUpdated">Waiting for first update…</small></p>
      <button class="btn outline" id="refreshMarket" type="button">Refresh prices</button>
    </div>
  `;

  const accountPanelHTML = () => `
    <div class="panel">
      <h3>Account and connection status</h3>
      <p>Account identity and service connectivity for your current session.</p>
      <p id="accountEmail">Checking signed-in account…</p>
      <p id="accountAuthState" class="notice" role="status">Checking authentication…</p>
      <p><strong>Supabase:</strong> <span id="supabaseState">Checking…</span></p>
      <p><strong>MT5 bridge:</strong> <span class="amber-text">Not connected</span></p>
      <p><strong>Trade execution:</strong> <span class="amber-text">Locked</span></p>
      <button class="btn outline" id="refreshAccountStatus" type="button">Refresh status</button>
    </div>
  `;

  const panels = {
    "Overview": () => originalMainHTML + `
      <div class="panel" id="overviewSavedConfig">
        <h3>Saved configuration</h3>
        <p>Your personal strategy preferences from Supabase. These settings do not place trades.</p>
      </div>`,
    "Market Analysis": () => marketPanelHTML(),
    "Demo Trading": () => demoPanelHTML() + '<div style="display:none" aria-hidden="true">' + marketPanelHTML() + '</div>',
    "Account status": accountPanelHTML,
    "Strategy": () => `
      <div class="panel"><h3>Strategy configuration</h3>
      <p>Saved strategy preferences from your Supabase account. These are configuration only; no signals or trades are executed.</p></div>`,
    "Risk controls": () => `
      <div class="panel"><h3>Risk controls</h3>
      <p>Your saved risk preferences. They are not enforced by an MT5 bridge yet, and trading remains disabled.</p></div>`,
    "Trade history": () => `
      <div class="panel"><h3>Demo trade history <span class="tag">SIMULATED</span></h3>
      <p>Locally saved simulated trades only. These are not broker orders.</p>
      <div id="demoHistoryRows" class="empty">Loading demo history…</div>
      <button class="btn outline" id="demoHistoryRefresh" type="button">Refresh history</button></div>`,
    "Settings": settingsHTML
  };


  let demoStorageKey = "scalpingbot-demo-v1-guest";
  let demoState = { balance: 10000, initialBalance: 10000, enabled: false, trades: [], openTrade: null, lastProcessedCandle: null, dayStartBalance: 10000, dayKey: new Date().toISOString().slice(0,10), pausedReason: "" };
  let demoStateLoaded = false;
  let demoRiskPercent = 0.5;
  let demoDailyLossLimit = 2;
  let latestSignal = { side: "WAIT", reason: "Waiting for market candles." };

  async function loadDemoRiskSettings() {
    const client = supabaseClient();
    if (!client) return;
    try {
      const { data: userData, error: userError } = await client.auth.getUser();
      if (userError) throw userError;
      if (!userData.user) return;
      const { data, error } = await client.from("bot_settings")
        .select("risk_percent, daily_loss_limit_percent")
        .eq("user_id", userData.user.id).maybeSingle();
      if (error) throw error;
      if (data) {
        const risk = Number(data.risk_percent);
        const daily = Number(data.daily_loss_limit_percent);
        if ([0.25, 0.5, 1].includes(risk)) demoRiskPercent = risk;
        if ([1, 2, 3].includes(daily)) demoDailyLossLimit = daily;
      }
    } catch (error) {
      console.warn("Saved demo risk settings could not be loaded; safe defaults remain active.", error);
    }
    renderDemoEngine();
  }

  async function loadDemoState() {
    try {
      const client = supabaseClient();
      const result = client ? await client.auth.getUser() : null;
      const user = result && result.data ? result.data.user : null;
      demoStorageKey = "scalpingbot-demo-v1-" + (user ? user.id : "guest");
      const saved = localStorage.getItem(demoStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && Array.isArray(parsed.trades) && Number.isFinite(Number(parsed.balance))) demoState = { ...demoState, ...parsed, enabled: false };
      }
    } catch (error) { console.warn("Demo state could not be loaded:", error); }
    demoStateLoaded = true;
    renderDemoEngine();
    // Market data can arrive before local demo state finishes loading. Re-process
    // the latest candles now so the signal does not remain stuck on its placeholder.
    if (lastMarketCandles.length) {
      const symbolControl = document.getElementById("marketSymbol");
      processDemoCandles(lastMarketCandles, symbolControl ? symbolControl.value : "EURUSD");
    }
  }

  function saveDemoState() {
    try { localStorage.setItem(demoStorageKey, JSON.stringify({ ...demoState, enabled: false })); }
    catch (error) {
      const status = document.getElementById("demoStatus");
      if (status) status.textContent = "Browser storage unavailable; results may not persist after closing this page.";
    }
  }

  function ema(values, period) {
    if (values.length < period) return null;
    const k = 2 / (period + 1);
    let value = values.slice(0, period).reduce((a,b)=>a+b,0) / period;
    for (let i = period; i < values.length; i++) value = values[i] * k + value * (1-k);
    return value;
  }

  function calculateSignal(candles) {
    const closes = (candles || []).map(c => Number(c.close)).filter(Number.isFinite);
    if (closes.length < 30) return { side: "WAIT", reason: "Need at least 30 valid candles before EMA 9/21 and RSI 14 analysis.", indicators: "Waiting for enough candles." };
    const fast = ema(closes.slice(-40), 9), slow = ema(closes.slice(-60), 21);
    const priorFast = ema(closes.slice(-41,-1), 9), priorSlow = ema(closes.slice(-61,-1), 21);
    const recent = closes.slice(-15);
    const changes = recent.slice(1).map((v,i)=>v-recent[i]);
    const avgGain = changes.reduce((a,v)=>a+Math.max(0,v),0)/14;
    const avgLoss = changes.reduce((a,v)=>a+Math.max(0,-v),0)/14;
    const rsi = avgLoss === 0 ? 100 : avgLoss === 0 && avgGain === 0 ? 50 : 100 - 100/(1 + avgGain/avgLoss);
    const trend = fast > slow ? "EMA 9 is above EMA 21" : fast < slow ? "EMA 9 is below EMA 21" : "EMA 9 equals EMA 21";
    const indicators = trend + " · RSI 14: " + rsi.toFixed(1);
    if (fast > slow && priorFast <= priorSlow && rsi >= 50 && rsi <= 70)
      return { side:"BUY", reason:"Bullish crossover confirmed; RSI is within the 50–70 filter.", indicators };
    if (fast < slow && priorFast >= priorSlow && rsi >= 30 && rsi <= 50)
      return { side:"SELL", reason:"Bearish crossover confirmed; RSI is within the 30–50 filter.", indicators };
    let reason = "WAIT: no fresh EMA crossover with confirming RSI.";
    if (fast > slow && (rsi < 50 || rsi > 70)) reason += " RSI is outside the BUY filter.";
    else if (fast < slow && (rsi < 30 || rsi > 50)) reason += " RSI is outside the SELL filter.";
    else reason += " Waiting for a new crossover.";
    return { side:"WAIT", reason, indicators };
  }

  function renderDemoEngine() {
    const signal = document.getElementById("demoSignal");
    if (!signal) return;
    signal.textContent = latestSignal.side;
    signal.style.color = latestSignal.side === "BUY" ? "#42d6ad" : latestSignal.side === "SELL" ? "#ff7185" : "var(--text)";
    document.getElementById("demoReason").textContent = latestSignal.reason;
    const indicators = document.getElementById("demoIndicators");
    if (indicators) indicators.textContent = latestSignal.indicators || "Indicator details will appear when enough candles are available.";
    const riskSummary = document.getElementById("demoRiskSummary");
    if (riskSummary) riskSummary.textContent = "Demo risk: " + demoRiskPercent.toFixed(2).replace(/0$/, "") + "% per trade · Daily loss limit: " + demoDailyLossLimit.toFixed(1) + "%.";
    document.getElementById("demoBalance").textContent = "$" + Number(demoState.balance).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
    const closed = demoState.trades.filter(t=>t.status==="CLOSED");
    document.getElementById("demoClosedCount").textContent = String(closed.length);
    const wins = closed.filter(t=>t.pnl>0).length;
    document.getElementById("demoWinRate").textContent = closed.length ? (wins/closed.length*100).toFixed(1)+"%" : "—";
    document.getElementById("demoStatus").textContent = demoState.enabled ? "Simulation RUNNING · local browser only · real trading disabled." : "Simulation PAUSED · no real orders can be sent.";
    document.getElementById("demoOpenTrade").textContent = demoState.openTrade
      ? "Open simulated " + demoState.openTrade.side + " " + demoState.openTrade.symbol + " at " + Number(demoState.openTrade.entry).toPrecision(7) + " · stop " + Number(demoState.openTrade.stop).toPrecision(7) + " · target " + Number(demoState.openTrade.target).toPrecision(7)
      : "No open simulated trade.";
  }

  function renderDemoHistory() {
    const target = document.getElementById("demoHistoryRows");
    if (!target) return;
    const rows = demoState.trades.slice().reverse().slice(0,50);
    if (!rows.length) { target.textContent = "No simulated trades yet. Start the demo engine on Overview."; return; }
    target.innerHTML = '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr><th align="left">Time</th><th>Symbol</th><th>Side</th><th>Entry</th><th>Exit</th><th>P/L</th><th>Status</th></tr></thead><tbody>' +
      rows.map(t=>'<tr><td>'+escapeHTML(new Date(t.openedAt).toLocaleString())+'</td><td>'+escapeHTML(t.symbol)+'</td><td>'+escapeHTML(t.side)+'</td><td>'+escapeHTML(Number(t.entry).toPrecision(7))+'</td><td>'+(t.exit==null?"—":escapeHTML(Number(t.exit).toPrecision(7)))+'</td><td>'+(t.pnl==null?"—":(t.pnl>=0?"+":"")+"$"+Number(t.pnl).toFixed(2))+'</td><td>'+escapeHTML(t.status)+'</td></tr>').join("")+
      '</tbody></table></div>';
  }

  function processDemoCandles(candles, symbol) {
    if (!demoStateLoaded || !candles) return;
    if (candles.length < 30) {
      latestSignal = {
        side: "WAIT",
        reason: "Waiting for at least 30 candles; the feed currently supplied " + candles.length + ".",
        indicators: "Not enough candles to calculate EMA 9/21 and RSI 14."
      };
      renderDemoEngine();
      return;
    }
    const last = candles[candles.length-1];
    const candleId = String(last.time || last.timestamp || last.date || "") + "|" + String(last.close);
    latestSignal = calculateSignal(candles);
    const riskPercent = demoRiskPercent;
    const dailyLimit = demoDailyLossLimit;
    const today = new Date().toISOString().slice(0,10);
    if (demoState.dayKey !== today) { demoState.dayKey=today; demoState.dayStartBalance=demoState.balance; }
    const dailyLoss = demoState.dayStartBalance > 0 ? (demoState.dayStartBalance-demoState.balance)/demoState.dayStartBalance*100 : 100;
    if (dailyLoss >= dailyLimit) { demoState.enabled=false; demoState.pausedReason="Daily loss guard reached."; }
    if (demoState.openTrade) {
      const t=demoState.openTrade, high=Number(last.high), low=Number(last.low);
      const stopHit=t.side==="BUY" ? low<=t.stop : high>=t.stop;
      const targetHit=t.side==="BUY" ? high>=t.target : low<=t.target;
      if (stopHit || targetHit) {
        // Conservative rule: if stop and target occur in the same candle, count the stop first.
        const exit=stopHit?t.stop:t.target, pnl=t.riskCash*(stopHit?-1:1.5);
        demoState.balance=Math.max(0,demoState.balance+pnl);
        const closedTrade={...t,status:"CLOSED",exit,pnl,closedAt:new Date().toISOString(),closeReason:stopHit?"Stop-loss":"Take-profit"};
        const existingIndex=demoState.trades.findIndex(item=>item.id===t.id);
        if (existingIndex>=0) demoState.trades[existingIndex]=closedTrade;
        else demoState.trades.push(closedTrade);
        demoState.openTrade=null;
      }
    }
    if (demoState.enabled && candleId!==demoState.lastProcessedCandle && !demoState.openTrade && (latestSignal.side==="BUY" || latestSignal.side==="SELL")) {
      const entry=Number(last.close);
      const ranges=candles.slice(-15).map(c=>Number(c.high)-Number(c.low)).filter(v=>Number.isFinite(v)&&v>0);
      const stopDistance=ranges.reduce((a,b)=>a+b,0)/Math.max(1,ranges.length);
      const riskCash=demoState.balance*riskPercent/100;
      if (stopDistance>0 && riskCash>0) {
        const direction=latestSignal.side==="BUY"?1:-1;
        const trade={id:String(Date.now()),symbol,side:latestSignal.side,entry,stop:entry-direction*stopDistance,target:entry+direction*stopDistance*1.5,riskCash,openedAt:new Date().toISOString(),status:"OPEN",reason:latestSignal.reason};
        demoState.openTrade=trade; demoState.trades.push(trade);
      }
    }
    if (candleId!==demoState.lastProcessedCandle) demoState.lastProcessedCandle=candleId;
    saveDemoState(); renderDemoEngine();
  }

  let marketRefreshTimer = null;
  let demoUiRefreshTimer = null;
  let marketChartType = "line";
  let lastMarketCandles = [];
  let visibleCandleCount = 30;

  function drawMarketChart(candles) {
    const chart = document.getElementById("marketChart");
    if (!chart) return;
    const rows = (candles || []).filter(c =>
      Number.isFinite(Number(c.open)) && Number.isFinite(Number(c.high)) &&
      Number.isFinite(Number(c.low)) && Number.isFinite(Number(c.close))
    );
    if (rows.length < 2) {
      chart.innerHTML = '<text x="12" y="80" fill="currentColor">Chart history unavailable</text>';
      return;
    }

    const visible = rows.slice(-visibleCandleCount);
    const zoomLabel = document.getElementById("zoomLabel");
    if (zoomLabel) zoomLabel.textContent = visible.length + " candles";
    const allValues = visible.flatMap(c => [Number(c.high), Number(c.low)]);
    const min = Math.min(...allValues);
    const max = Math.max(...allValues);
    const range = max - min || Math.abs(max) * 0.0001 || 1;
    const y = value => 12 + (max - value) / range * 150;
    const x = index => 8 + index * 584 / (visible.length - 1);
    const grid = '<path d="M8 12H592 M8 87H592 M8 162H592" stroke="#26334d" fill="none"/>';
    if (marketChartType === "candles") {
      const candleWidth = Math.max(3, Math.min(9, 560 / visible.length * 0.58));
      const sticks = visible.map((c, index) => {
        const open = Number(c.open), close = Number(c.close);
        const high = Number(c.high), low = Number(c.low);
        const rising = close >= open;
        const color = rising ? "#42d6ad" : "#ff7185";
        const cx = x(index);
        const top = Math.min(y(open), y(close));
        const bodyHeight = Math.max(1.5, Math.abs(y(open) - y(close)));
        return '<g stroke="' + color + '" fill="' + color + '">' +
          '<line x1="' + cx.toFixed(1) + '" y1="' + y(high).toFixed(1) + '" x2="' + cx.toFixed(1) + '" y2="' + y(low).toFixed(1) + '" stroke-width="1.5"/>' +
          '<rect x="' + (cx - candleWidth / 2).toFixed(1) + '" y="' + top.toFixed(1) + '" width="' + candleWidth.toFixed(1) + '" height="' + bodyHeight.toFixed(1) + '" rx="0.5"/>' +
          '</g>';
      }).join("");
      chart.innerHTML = grid + sticks;
    } else {
      const closes = visible.map(c => Number(c.close));
      const points = closes.map((value, index) => x(index).toFixed(1) + "," + y(value).toFixed(1)).join(" ");
      chart.innerHTML = grid + '<polyline points="' + points + '" fill="none" stroke="#42d6ad" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>';
    }
  }

  let marketRequestInProgress = false;
  let marketLastSuccessAt = null;

  async function loadLiveMarketData() {
    const panel = document.getElementById("liveMarketPanel");
    if (!panel) return;
    const symbolControl = document.getElementById("marketSymbol");
    const priceEl = document.getElementById("marketPrice");
    const statusEl = document.getElementById("marketState");
    const updatedEl = document.getElementById("marketUpdated");
    const chart = document.getElementById("marketChart");
    const symbol = symbolControl ? symbolControl.value : "EURUSD";
    const timeframeControl = document.getElementById("marketTimeframe");
    const timeframe = timeframeControl ? timeframeControl.value : "5m";
    const labels = { EURUSD: "EUR/USD", GBPUSD: "GBP/USD", USDJPY: "USD/JPY", XAUUSD: "Gold (XAU/USD proxy)" };
    document.getElementById("marketSymbolLabel").textContent = labels[symbol] || symbol;
    const feedState = document.getElementById("feedConnectionState");
    const feedIndicator = document.getElementById("feedIndicator");
    const autoState = document.getElementById("feedAutoState");
    if (marketRequestInProgress) return;
    marketRequestInProgress = true;
    statusEl.textContent = "Fetching latest available indicative prices…";
    feedState.textContent = "Updating external feed…";
    feedIndicator.style.background = "#e0a34b";
    autoState.textContent = "Auto-refresh: every 30 seconds";
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);
      const response = await fetch("https://aejoqsckzceufdbwhegl.supabase.co/functions/v1/market-data?symbol=" + encodeURIComponent(symbol) + "&timeframe=" + encodeURIComponent(timeframe), { cache: "no-store", signal: controller.signal });
      clearTimeout(timeoutId);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Market data request failed.");
      if (data.price == null) throw new Error("The provider did not return a current price.");
      const decimals = symbol === "USDJPY" ? 3 : symbol === "XAUUSD" ? 2 : 5;
      priceEl.textContent = Number(data.price).toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
      marketLastSuccessAt = new Date();
      statusEl.textContent = "Feed: " + data.provider + " · " + (data.marketState || "market status unavailable") + ". Indicative only.";
      feedState.textContent = "External feed connected · updated " + marketLastSuccessAt.toLocaleTimeString();
      feedIndicator.style.background = "#42d6ad";
      updatedEl.textContent = "Fetched " + marketLastSuccessAt.toLocaleTimeString() + (data.exchangeTimezoneName ? " · Provider timezone: " + data.exchangeTimezoneName : "");
      lastMarketCandles = data.candles || [];
      drawMarketChart(lastMarketCandles);
      processDemoCandles(lastMarketCandles, symbol);
    } catch (error) {
      const reason = error.name === "AbortError" ? "Request timed out" : error.message;
      statusEl.textContent = "Live feed unavailable: " + reason + ". Retry automatically or tap Refresh prices.";
      feedState.textContent = marketLastSuccessAt ? "Feed reconnecting · last successful update " + marketLastSuccessAt.toLocaleTimeString() : "External feed disconnected";
      feedIndicator.style.background = "#ff7185";
      updatedEl.textContent = marketLastSuccessAt ? "Last successful update: " + marketLastSuccessAt.toLocaleString() : "No successful update yet.";
      if (document.getElementById("demoSignal")) {
        latestSignal = { side: "WAIT", reason: "Market feed unavailable; the demo engine cannot calculate a fresh signal until candle data returns.", indicators: "Waiting for market candle data." };
        renderDemoEngine();
      }
    } finally {
      marketRequestInProgress = false;
    }
  }

  async function refreshAccountStatus() {
    const email = document.getElementById("accountEmail");
    const authState = document.getElementById("accountAuthState");
    const supabaseState = document.getElementById("supabaseState");
    const client = supabaseClient();
    if (!email || !authState || !supabaseState) return;

    supabaseState.textContent = client ? "Client initialized" : "Not configured";
    if (!client) {
      email.textContent = "Account: unavailable";
      authState.textContent = "Supabase client is not initialized.";
      return;
    }

    authState.textContent = "Checking session…";
    try {
      const { data, error } = await client.auth.getUser();
      if (error) throw error;
      if (data.user) {
        email.textContent = "Signed in as " + data.user.email;
        authState.textContent = "Authenticated";
      } else {
        email.textContent = "No signed-in account";
        authState.textContent = "Sign-in required";
      }
    } catch (error) {
      email.textContent = "Could not read account";
      authState.textContent = "Status check failed: " + error.message;
    }
  }

  async function loadSavedConfigSummary(name) {
    const client = supabaseClient();
    const panel = name === "Overview"
      ? main.querySelector("#overviewSavedConfig")
      : main.querySelector(".panel");
    if (!panel) return;

    if (!client) {
      panel.insertAdjacentHTML("beforeend",
        '<p class="notice" role="status">Supabase client unavailable. Settings could not be loaded.</p>');
      return;
    }

    const notice = document.createElement("p");
    notice.className = "notice";
    notice.setAttribute("role", "status");
    notice.textContent = "Loading saved configuration…";
    panel.appendChild(notice);

    try {
      const { data: userData, error: userError } = await client.auth.getUser();
      if (userError) throw userError;
      if (!userData.user) throw new Error("Please sign in to view saved settings.");

      const { data, error } = await client
        .from("bot_settings")
        .select("symbol, timeframe, risk_percent, daily_loss_limit_percent, updated_at")
        .eq("user_id", userData.user.id)
        .maybeSingle();

      if (error) throw error;

      const details = document.createElement("div");
      details.className = "saved-config";
      if (data) {
        const updated = data.updated_at
          ? new Date(data.updated_at).toLocaleString()
          : "Not recorded";
        details.innerHTML =
          '<p><strong>Symbol:</strong> ' + escapeHTML(data.symbol) + '</p>' +
          '<p><strong>Timeframe:</strong> ' + escapeHTML(data.timeframe) + '</p>' +
          '<p><strong>Proposed risk per trade:</strong> ' + escapeHTML(String(data.risk_percent)) + '%</p>' +
          '<p><strong>Daily loss limit:</strong> ' + escapeHTML(String(data.daily_loss_limit_percent)) + '%</p>' +
          '<p><small>Last saved: ' + escapeHTML(updated) + '</small></p>';
      } else {
        details.textContent = "No saved settings yet. Open Settings to choose and save your preferences.";
      }
      notice.replaceWith(details);
    } catch (error) {
      notice.textContent = "Could not load saved configuration: " + error.message;
    }
  }

  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, char => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[char]);
  }

  async function loadSettings() {
    const status = document.getElementById("settingsStatus");
    const saveButton = document.getElementById("saveSettings");
    const client = supabaseClient();

    if (!client) {
      status.textContent = "Supabase client unavailable. Check auth.js and reload.";
      return;
    }

    saveButton.disabled = true;
    status.textContent = "Loading your settings…";

    try {
      const { data: userData, error: userError } = await client.auth.getUser();
      if (userError) throw userError;
      if (!userData.user) {
        status.textContent = "Please sign in to load your settings.";
        return;
      }

      const { data, error } = await client
        .from("bot_settings")
        .select("symbol, timeframe, risk_percent, daily_loss_limit_percent")
        .eq("user_id", userData.user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        document.getElementById("settingsSymbol").value = data.symbol;
        document.getElementById("settingsTimeframe").value = data.timeframe;
        document.getElementById("settingsRisk").value = String(data.risk_percent);
        document.getElementById("settingsDaily").value = String(data.daily_loss_limit_percent);
        status.textContent = "Your saved settings have been loaded.";
      } else {
        status.textContent = "No saved settings yet. Defaults are shown; tap Save settings to store them.";
      }
    } catch (error) {
      status.textContent = "Could not load settings: " + error.message;
    } finally {
      saveButton.disabled = false;
    }
  }

  async function saveSettings() {
    const status = document.getElementById("settingsStatus");
    const saveButton = document.getElementById("saveSettings");
    const client = supabaseClient();

    if (!client) {
      status.textContent = "Supabase client unavailable. Check auth.js and reload.";
      return;
    }

    saveButton.disabled = true;
    status.textContent = "Saving your settings…";

    try {
      const { data: userData, error: userError } = await client.auth.getUser();
      if (userError) throw userError;
      if (!userData.user) throw new Error("Please sign in before saving settings.");

      const settings = {
        user_id: userData.user.id,
        symbol: document.getElementById("settingsSymbol").value,
        timeframe: document.getElementById("settingsTimeframe").value,
        risk_percent: Number(document.getElementById("settingsRisk").value),
        daily_loss_limit_percent: Number(document.getElementById("settingsDaily").value),
        updated_at: new Date().toISOString()
      };

      const { error } = await client
        .from("bot_settings")
        .upsert(settings, { onConflict: "user_id" });

      if (error) throw error;
      status.textContent = "Settings saved successfully!";
    } catch (error) {
      status.textContent = "Could not save settings: " + error.message;
    } finally {
      saveButton.disabled = false;
    }
  }

  function openTab(name, item) {
    navItems.forEach(nav => nav.classList.remove("active"));
    item.classList.add("active");
    main.innerHTML = panels[name]();

    if (marketRefreshTimer) {
      clearInterval(marketRefreshTimer);
      marketRefreshTimer = null;
    }
    if (demoUiRefreshTimer) {
      clearInterval(demoUiRefreshTimer);
      demoUiRefreshTimer = null;
    }
    if (name === "Settings") {
      document.getElementById("saveSettings").addEventListener("click", saveSettings);
      loadSettings();
    } else if (name === "Overview" || name === "Market Analysis" || name === "Demo Trading") {
      if (name === "Overview") loadSavedConfigSummary(name);
      if (document.getElementById("marketSymbol")) document.getElementById("marketSymbol").addEventListener("change", loadLiveMarketData);
      if (document.getElementById("marketTimeframe")) document.getElementById("marketTimeframe").addEventListener("change", loadLiveMarketData);
      if (document.getElementById("refreshMarket")) document.getElementById("refreshMarket").addEventListener("click", loadLiveMarketData);
      if (document.getElementById("zoomIn")) document.getElementById("zoomIn").addEventListener("click", () => {
        visibleCandleCount = Math.max(10, visibleCandleCount - 5);
        drawMarketChart(lastMarketCandles);
      });
      if (document.getElementById("zoomOut")) document.getElementById("zoomOut").addEventListener("click", () => {
        visibleCandleCount = Math.min(60, visibleCandleCount + 5);
        drawMarketChart(lastMarketCandles);
      });
      if (document.getElementById("zoomReset")) document.getElementById("zoomReset").addEventListener("click", () => {
        visibleCandleCount = 30;
        drawMarketChart(lastMarketCandles);
      });
      if (document.getElementById("lineChartBtn")) document.getElementById("lineChartBtn").addEventListener("click", () => {
        marketChartType = "line";
        document.getElementById("lineChartBtn").className = "btn primary";
        document.getElementById("candleChartBtn").className = "btn outline";
        document.getElementById("lineChartBtn").setAttribute("aria-pressed", "true");
        document.getElementById("candleChartBtn").setAttribute("aria-pressed", "false");
        drawMarketChart(lastMarketCandles);
      });
      if (document.getElementById("candleChartBtn")) document.getElementById("candleChartBtn").addEventListener("click", () => {
        marketChartType = "candles";
        document.getElementById("lineChartBtn").className = "btn outline";
        document.getElementById("candleChartBtn").className = "btn primary";
        document.getElementById("lineChartBtn").setAttribute("aria-pressed", "false");
        document.getElementById("candleChartBtn").setAttribute("aria-pressed", "true");
        drawMarketChart(lastMarketCandles);
      });
      if (document.getElementById("demoStart")) document.getElementById("demoStart").addEventListener("click", () => { demoState.enabled=true; demoState.pausedReason=""; saveDemoState(); renderDemoEngine(); });
      if (document.getElementById("demoPause")) document.getElementById("demoPause").addEventListener("click", () => { demoState.enabled=false; saveDemoState(); renderDemoEngine(); });
      if (document.getElementById("demoReset")) document.getElementById("demoReset").addEventListener("click", () => {
        if (!confirm("Reset your local simulated balance and demo trade history?")) return;
        demoState={balance:10000,initialBalance:10000,enabled:false,trades:[],openTrade:null,lastProcessedCandle:null,dayStartBalance:10000,dayKey:new Date().toISOString().slice(0,10),pausedReason:""};
        saveDemoState(); renderDemoEngine();
      });
      if (name === "Overview" || name === "Demo Trading") {
        loadDemoState();
        loadDemoRiskSettings();
        demoUiRefreshTimer = setInterval(renderDemoEngine, 1000);
      }
      if (name === "Overview" || name === "Market Analysis" || name === "Demo Trading") {
        loadLiveMarketData();
        marketRefreshTimer = setInterval(loadLiveMarketData, 30000);
      }
    } else if (name === "Strategy" || name === "Risk controls") {
      loadSavedConfigSummary(name);
    } else if (name === "Trade history") {
      renderDemoHistory();
      document.getElementById("demoHistoryRefresh").addEventListener("click", renderDemoHistory);
    } else if (name === "Account status") {
      refreshAccountStatus();
      document.getElementById("refreshAccountStatus").addEventListener("click", refreshAccountStatus);
    }
  }

  navItems.forEach((item, index) => {
    const name = tabNames[index];
    item.setAttribute("role", "button");
    item.setAttribute("tabindex", "0");
    item.style.cursor = "pointer";
    item.addEventListener("click", () => {
      const routes = { "Overview": "dashboard.html", "Market Analysis": "market.html", "Demo Trading": "demo.html" };
      if (routes[name]) { window.location.href = routes[name]; return; }
      openTab(name, item);
    });
    item.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        const routes = { "Overview": "dashboard.html", "Market Analysis": "market.html", "Demo Trading": "demo.html" };
        if (routes[name]) { window.location.href = routes[name]; return; }
        openTab(name, item);
      }
    });
  });

  // Render the selected page while keeping one shared dashboard controller.
  const requestedView = document.body.dataset.view;
  const initialTab = requestedView === "market" ? "Market Analysis" : requestedView === "demo" ? "Demo Trading" : "Overview";
  const initialIndex = tabNames.indexOf(initialTab);
  if (navItems[initialIndex]) openTab(initialTab, navItems[initialIndex]);
}

document.addEventListener("click", event => {
  if (event.target.closest("#requestConnect")) {
    alert("MT5 bridge is not configured. Trading remains disabled until the authenticated Windows bridge is built and tested.");
  }
});
