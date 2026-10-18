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
      <p>Settings are saved to your private account.
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
      <h3>Price-driven scalping engine <span class="tag">PAPER TRADING</span></h3>
      <p>Manual or rule-based paper trading using the latest available market price. No EMA/RSI indicators. Live broker orders are disabled until a broker connection is configured and tested.</p>
      <div class="demo-stats">
        <div><small>Latest indicative price</small><strong id="scalpPrice">Waiting for feed</strong></div>
        <div><small>Paper balance</small><strong id="demoBalance">$10,000.00</strong></div>
        <div><small>Closed paper trades</small><strong id="demoClosedCount">0</strong></div>
        <div><small>Paper win rate</small><strong id="demoWinRate">—</strong></div>
      </div>
      <div class="market-controls" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:14px 0">
        <label>Symbol
          <select id="scalpSymbol"><option value="EURUSD" selected>EUR/USD</option><option value="GBPUSD">GBP/USD</option><option value="USDJPY">USD/JPY</option><option value="XAUUSD">Gold (XAU/USD proxy)</option></select>
        </label>
        <label>Trading mode
          <select id="scalpMode"><option value="manual" selected>Manual</option><option value="auto">Auto (paper only)</option></select>
        </label>
        <label>Lot size
          <input id="scalpLot" type="number" min="0.01" max="10" step="0.01" value="0.01">
        </label>
        <label>Risk per trade (%)
          <input id="scalpRisk" type="number" min="0.1" max="5" step="0.1" value="1">
        </label>
        <label>Stop loss (pips)
          <input id="scalpSL" type="number" min="1" max="500" step="1" value="5">
        </label>
        <label>Take profit (pips)
          <input id="scalpTP" type="number" min="1" max="1000" step="1" value="8">
        </label>
        <label>Auto entry interval
          <select id="scalpInterval"><option value="1" selected>Every eligible price update</option><option value="5">5 seconds</option><option value="15">15 seconds</option></select>
        </label>
        <label>Daily loss limit (%)
          <input id="scalpDailyLimit" type="number" min="1" max="10" step="0.5" value="2">
        </label>
      </div>
      <p id="scalpQuoteStatus" class="notice" role="status">Waiting for the indicative market feed. This is not a broker quote stream.</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin:10px 0">
        <button class="btn primary" id="scalpBuy" type="button">Paper BUY</button>
        <button class="btn outline" id="scalpSell" type="button">Paper SELL</button>
        <button class="btn outline" id="scalpClose" type="button">Close paper position</button>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin:10px 0">
        <button class="btn primary" id="scalpAutoStart" type="button">Start auto paper mode</button>
        <button class="btn outline" id="scalpStop" type="button">Stop engine</button>
        <button class="btn outline" id="demoReset" type="button">Reset paper results</button>
      </div>
      <p id="demoReason" class="notice" role="status">Manual mode is selected. Choose Paper BUY or Paper SELL to open a simulated position.</p>
      <p id="demoRiskSummary" class="notice">Risk 1% · SL 5 pips · TP 8 pips · Lot 0.01</p>
      <p id="demoStatus" class="notice" role="status">Paper engine stopped. Live broker orders are disabled.</p>
      <div id="demoOpenTrade" class="empty">No open paper position.</div>
      <p><small>Price source refreshes on the existing feed schedule (currently 30 seconds). This is not suitable for true tick-scalping; a broker streaming quote connection is required for that.</small></p>
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
        <p>Your saved personal strategy preferences. These settings do not place trades.</p>
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


  let demoStorageKey = "scalpingbot-demo-v2-guest";
  let demoState = { balance:10000, initialBalance:10000, enabled:false, mode:"manual", trades:[], openTrade:null, dayStartBalance:10000, dayKey:new Date().toISOString().slice(0,10), pausedReason:"" };
  let demoStateLoaded = false;
  let demoRiskPercent = 1;
  let demoDailyLossLimit = 2;
  let scalpLatestPrice = null;
  let scalpPreviousPrice = null;
  let scalpLastAutoEntryAt = 0;
  let scalpSettings = { symbol:"EURUSD", lot:0.01, stopPips:5, targetPips:8, riskPercent:1, intervalSeconds:1, dailyLimit:2, mode:"manual" };

  function scalpPipSize(symbol) { return symbol === "USDJPY" ? 0.01 : symbol === "XAUUSD" ? 0.1 : 0.0001; }
  // Approximate pip value in account currency for risk preview only; actual value
  // varies with broker contract size and conversion rates. Live orders remain disabled.
  function scalpPipValuePerLot(symbol) { return symbol === "XAUUSD" ? 1 : symbol === "USDJPY" ? 6.7 : 10; }
  function scalpRiskBudget() { return demoState.balance * scalpSettings.riskPercent / 100; }
  function scalpEstimatedRisk() { return scalpSettings.stopPips * scalpPipValuePerLot(scalpSettings.symbol) * scalpSettings.lot; }
  function readScalpSettings() {
    const value = id => document.getElementById(id);
    const num = (id, fallback) => { const el=value(id), n=el?Number(el.value):fallback; return Number.isFinite(n)&&n>0?n:fallback; };
    scalpSettings = {
      symbol: value("scalpSymbol")?.value || "EURUSD",
      mode: value("scalpMode")?.value || "manual",
      lot: Math.min(10,Math.max(0.01,num("scalpLot",0.01))),
      riskPercent: Math.min(5,Math.max(0.1,num("scalpRisk",1))),
      stopPips: Math.min(500,Math.max(1,num("scalpSL",5))),
      targetPips: Math.min(1000,Math.max(1,num("scalpTP",8))),
      intervalSeconds: Number(value("scalpInterval")?.value || 1),
      dailyLimit: Math.min(10,Math.max(1,num("scalpDailyLimit",2)))
    };
    demoRiskPercent = scalpSettings.riskPercent;
    demoDailyLossLimit = scalpSettings.dailyLimit;
    if (demoState) demoState.mode = scalpSettings.mode;
    renderDemoEngine();
    saveDemoState();
  }

  async function loadDemoRiskSettings() { renderDemoEngine(); }

  async function loadDemoState() {
    try {
      const client = supabaseClient();
      const result = client ? await client.auth.getUser() : null;
      const user = result && result.data ? result.data.user : null;
      demoStorageKey = "scalpingbot-demo-v2-" + (user ? user.id : "guest");
      const saved = localStorage.getItem(demoStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && Array.isArray(parsed.trades) && Number.isFinite(Number(parsed.balance))) demoState = { ...demoState, ...parsed, enabled:false };
      }
    } catch (error) { console.warn("Paper trading state could not be loaded:", error); }
    demoStateLoaded = true;
    renderDemoEngine();
    if (lastMarketCandles.length) {
      const last = lastMarketCandles[lastMarketCandles.length-1];
      if (last && Number.isFinite(Number(last.close))) handleScalpPrice(Number(last.close), scalpSettings.symbol);
    }
  }

  function saveDemoState() {
    try { localStorage.setItem(demoStorageKey, JSON.stringify({ ...demoState, enabled: false })); }
    catch (error) {
      const status = document.getElementById("demoStatus");
      if (status) status.textContent = "Browser storage unavailable; paper history may not persist.";
    }
  }

  function renderDemoEngine() {
    const get = id => document.getElementById(id);
    const price = get("scalpPrice");
    if (!price) return;
    price.textContent = scalpLatestPrice == null ? "Waiting for feed" : Number(scalpLatestPrice).toLocaleString(undefined,{minimumFractionDigits:scalpSettings.symbol==="USDJPY"?3:scalpSettings.symbol==="XAUUSD"?2:5,maximumFractionDigits:scalpSettings.symbol==="USDJPY"?3:scalpSettings.symbol==="XAUUSD"?2:5});
    get("demoBalance").textContent = "$" + Number(demoState.balance).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
    const closed = demoState.trades.filter(t=>t.status==="CLOSED");
    get("demoClosedCount").textContent = String(closed.length);
    const wins = closed.filter(t=>Number(t.pnl)>0).length;
    get("demoWinRate").textContent = closed.length ? (wins/closed.length*100).toFixed(1)+"%" : "—";
    get("demoRiskSummary").textContent = "Risk budget ≈ $" + scalpRiskBudget().toFixed(2) + " · estimated stop risk ≈ $" + scalpEstimatedRisk().toFixed(2) + " · SL " + scalpSettings.stopPips + " pips · TP " + scalpSettings.targetPips + " pips · Lot " + scalpSettings.lot + ". Pip values are estimates; confirm broker contract specs.";
    get("demoStatus").textContent = demoState.enabled ? "AUTO PAPER MODE RUNNING · simulated positions only · broker orders disabled." : "Paper engine stopped. Live broker orders are disabled.";
    get("demoReason").textContent = demoState.openTrade ? "Open paper " + demoState.openTrade.side + " position. It will close when the configured stop-loss or take-profit price is reached." : (scalpSettings.mode === "manual" ? "Manual mode: choose Paper BUY or Paper SELL. No indicator gate is used." : "Auto paper mode uses the direction of the latest price change; it does not use EMA/RSI. A new position is considered only on an eligible feed update.");
    get("demoOpenTrade").textContent = demoState.openTrade ? ("Open paper " + demoState.openTrade.side + " " + demoState.openTrade.symbol + " · entry " + Number(demoState.openTrade.entry).toPrecision(7) + " · stop " + Number(demoState.openTrade.stop).toPrecision(7) + " · target " + Number(demoState.openTrade.target).toPrecision(7) + " · unrealized " + (demoState.openTrade.unrealizedPips||0).toFixed(1) + " pips") : "No open paper position.";
  }

  function closeScalpPosition(exitPrice, reason) {
    const t=demoState.openTrade;
    if (!t || !Number.isFinite(exitPrice)) return;
    const pipSize=scalpPipSize(t.symbol);
    const direction=t.side==="BUY"?1:-1;
    const pips=(exitPrice-t.entry)/pipSize*direction;
    const pnl=pips*scalpPipValuePerLot(t.symbol)*t.lot;
    demoState.balance=Math.max(0,demoState.balance+pnl);
    const closed={...t,status:"CLOSED",exit:exitPrice,pnl,closedAt:new Date().toISOString(),closeReason:reason,realizedPips:pips};
    const i=demoState.trades.findIndex(x=>x.id===t.id);
    if(i>=0) demoState.trades[i]=closed; else demoState.trades.push(closed);
    demoState.openTrade=null;
    saveDemoState(); renderDemoEngine();
  }

  function openScalpPosition(side, price, symbol) {
    if (!Number.isFinite(price) || price<=0) {
      const status=document.getElementById("scalpQuoteStatus");
      if(status) status.textContent="Cannot open paper position: no valid market price yet.";
      return;
    }
    if (demoState.openTrade) {
      const status=document.getElementById("scalpQuoteStatus");
      if(status) status.textContent="One paper position is already open. Close it before opening another.";
      return;
    }
    const riskCash=scalpRiskBudget();
    const pipSize=scalpPipSize(symbol);
    const direction=side==="BUY"?1:-1;
    const riskByLots=scalpSettings.stopPips*scalpPipValuePerLot(symbol)*scalpSettings.lot;
    if(riskByLots>riskCash+0.005) {
      const status=document.getElementById("scalpQuoteStatus");
      if(status) status.textContent="Lot size exceeds the configured risk budget. Reduce lot size or increase the risk limit.";
      return;
    }
    const trade={id:String(Date.now()),symbol,side,entry:price,stop:price-direction*scalpSettings.stopPips*pipSize,target:price+direction*scalpSettings.targetPips*pipSize,lot:scalpSettings.lot,riskCash,openedAt:new Date().toISOString(),status:"OPEN",mode:scalpSettings.mode,unrealizedPips:0};
    demoState.openTrade=trade; demoState.trades.push(trade);
    const status=document.getElementById("scalpQuoteStatus");
    if(status) status.textContent="Paper " + side + " opened at " + price + ". This is simulated only; no broker order was sent.";
    saveDemoState(); renderDemoEngine();
  }

  function handleScalpPrice(price, symbol) {
    if (!Number.isFinite(price) || price<=0) return;
    scalpPreviousPrice=scalpLatestPrice;
    scalpLatestPrice=price;
    const quote=document.getElementById("scalpQuoteStatus");
    if(quote) quote.textContent="Indicative feed update: " + new Date().toLocaleTimeString() + " · " + symbol + " · broker bid/ask stream not connected.";
    const t=demoState.openTrade;
    if(t && t.symbol===symbol) {
      const direction=t.side==="BUY"?1:-1;
      t.unrealizedPips=(price-t.entry)/scalpPipSize(symbol)*direction;
      const stopHit=t.side==="BUY"?price<=t.stop:price>=t.stop;
      const targetHit=t.side==="BUY"?price>=t.target:price<=t.target;
      if(stopHit||targetHit) closeScalpPosition(stopHit?t.stop:t.target,stopHit?"Stop-loss":"Take-profit");
    }
    const today=new Date().toISOString().slice(0,10);
    if(demoState.dayKey!==today){demoState.dayKey=today;demoState.dayStartBalance=demoState.balance;}
    const dailyLoss=demoState.dayStartBalance>0?(demoState.dayStartBalance-demoState.balance)/demoState.dayStartBalance*100:100;
    if(dailyLoss>=scalpSettings.dailyLimit){demoState.enabled=false;demoState.pausedReason="Daily loss limit reached."; }
    if(demoState.enabled && scalpSettings.mode==="auto" && !demoState.openTrade &&
       symbol===scalpSettings.symbol && scalpPreviousPrice!=null &&
       Date.now()-scalpLastAutoEntryAt>=scalpSettings.intervalSeconds*1000) {
      // The current provider is polling candles every 30 seconds, not streaming ticks.
      // Require a move of at least 1 pip to avoid entering on insignificant noise.
      const delta=price-scalpPreviousPrice;
      const minimumMove=scalpPipSize(symbol);
      if(Math.abs(delta)>=minimumMove) {
        openScalpPosition(delta>0?"BUY":"SELL",price,symbol);
        scalpLastAutoEntryAt=Date.now();
      }
    }
    saveDemoState(); renderDemoEngine();
  }

  function processDemoCandles(candles, symbol) {
    if (!demoStateLoaded || !Array.isArray(candles) || !candles.length) return;
    const last=candles[candles.length-1];
    const price=Number(last.close);
    if(Number.isFinite(price)&&price>0) handleScalpPrice(price,symbol);
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
    const scalpSymbolControl = document.getElementById("scalpSymbol");
    if (!symbolControl && scalpSymbolControl) { /* Demo-only fallback below uses the selected scalping symbol. */ }
    const priceEl = document.getElementById("marketPrice");
    const statusEl = document.getElementById("marketState");
    const updatedEl = document.getElementById("marketUpdated");
    const chart = document.getElementById("marketChart");
    const symbol = symbolControl ? (document.getElementById("scalpSymbol") && document.getElementById("scalpSymbol").value || symbolControl.value) : (scalpSymbolControl ? scalpSymbolControl.value : "EURUSD");
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
      const scalpSymbolControl = document.getElementById("scalpSymbol");
      if (scalpSymbolControl && scalpSymbolControl.value !== symbol) {
        // Keep the scalping panel's selected symbol authoritative on Demo Trading.
        scalpSymbolControl.value = symbol;
      }
      handleScalpPrice(Number(data.price), symbol);
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
        '<p class="notice" role="status">Account service unavailable. Settings could not be loaded.</p>');
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
      status.textContent = "Account service unavailable. Please reload and try again.";
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
      ["scalpSymbol","scalpMode","scalpLot","scalpRisk","scalpSL","scalpTP","scalpInterval","scalpDailyLimit"].forEach(id => {
        const el=document.getElementById(id);
        if(el) el.addEventListener("change", () => {
          readScalpSettings();
          if(id==="scalpSymbol") { const marketSymbol=document.getElementById("marketSymbol"); if(marketSymbol) marketSymbol.value=document.getElementById("scalpSymbol").value; loadLiveMarketData(); }
        });
      });
      if (document.getElementById("scalpBuy")) document.getElementById("scalpBuy").addEventListener("click", () => { readScalpSettings(); openScalpPosition("BUY",scalpLatestPrice,scalpSettings.symbol); });
      if (document.getElementById("scalpSell")) document.getElementById("scalpSell").addEventListener("click", () => { readScalpSettings(); openScalpPosition("SELL",scalpLatestPrice,scalpSettings.symbol); });
      if (document.getElementById("scalpClose")) document.getElementById("scalpClose").addEventListener("click", () => { if(scalpLatestPrice==null){alert("No price available to close the paper position.");return;} closeScalpPosition(scalpLatestPrice,"Manual close"); });
      if (document.getElementById("scalpAutoStart")) document.getElementById("scalpAutoStart").addEventListener("click", () => {
        readScalpSettings();
        if(scalpSettings.mode!=="auto"){alert("Select Auto mode first.");return;}
        demoState.enabled=true; demoState.pausedReason=""; saveDemoState(); renderDemoEngine();
      });
      if (document.getElementById("scalpStop")) document.getElementById("scalpStop").addEventListener("click", () => { demoState.enabled=false; saveDemoState(); renderDemoEngine(); });
      if (document.getElementById("demoReset")) document.getElementById("demoReset").addEventListener("click", () => {
        if (!confirm("Reset paper balance and paper trade history?")) return;
        demoState={balance:10000,initialBalance:10000,enabled:false,mode:"manual",trades:[],openTrade:null,dayStartBalance:10000,dayKey:new Date().toISOString().slice(0,10),pausedReason:""};
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
