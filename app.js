// ScalpingBot dashboard UI and per-user settings persistence.
// No trading commands are sent. MT5 remains locked.

const tabNames = [
  "Overview",
  "Strategy",
  "Risk controls",
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

  const marketPanelHTML = () => `
    <div class="panel" id="liveMarketPanel">
      <h3>Live market data <span class="tag">External feed</span></h3>
      <p>Indicative third-party prices; not broker quotes and may be delayed.</p>
      <label>Market symbol
        <select id="marketSymbol">
          <option value="EURUSD">EUR/USD</option>
          <option value="GBPUSD">GBP/USD</option>
          <option value="USDJPY">USD/JPY</option>
          <option value="XAUUSD">Gold (XAU/USD proxy)</option>
        </select>
      </label>
      <div class="market-quote"><small id="marketSymbolLabel">EUR/USD</small><h2 id="marketPrice">Loading…</h2><p id="marketState" class="notice" role="status">Connecting to market-data service…</p></div>
      <div class="chart-switch" role="group" aria-label="Chart type" style="display:flex;gap:8px;margin:12px 0">
        <button class="btn primary" id="lineChartBtn" type="button" aria-pressed="true">Line</button>
        <button class="btn outline" id="candleChartBtn" type="button" aria-pressed="false">Candlestick</button>
      </div>
      <svg id="marketChart" viewBox="0 0 600 180" role="img" aria-label="Recent indicative market prices" style="width:100%;height:auto;min-height:120px"></svg>
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
    "Overview": () => originalMainHTML + marketPanelHTML() + `
      <div class="panel" id="overviewSavedConfig">
        <h3>Saved configuration</h3>
        <p>Your personal strategy preferences from Supabase. These settings do not place trades.</p>
      </div>`,
    "Account status": accountPanelHTML,
    "Strategy": () => `
      <div class="panel"><h3>Strategy configuration</h3>
      <p>Saved strategy preferences from your Supabase account. These are configuration only; no signals or trades are executed.</p></div>`,
    "Risk controls": () => `
      <div class="panel"><h3>Risk controls</h3>
      <p>Your saved risk preferences. They are not enforced by an MT5 bridge yet, and trading remains disabled.</p></div>`,
    "Trade history": () => `
      <div class="panel"><h3>Trade history</h3>
      <p class="empty">No trading data available. MT5 is not connected.</p></div>`,
    "Settings": settingsHTML
  };

  let marketRefreshTimer = null;
  let marketChartType = "line";
  let lastMarketCandles = [];

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

    const visible = rows.slice(-60);
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

  async function loadLiveMarketData() {
    const panel = document.getElementById("liveMarketPanel");
    if (!panel) return;
    const symbolControl = document.getElementById("marketSymbol");
    const priceEl = document.getElementById("marketPrice");
    const statusEl = document.getElementById("marketState");
    const updatedEl = document.getElementById("marketUpdated");
    const chart = document.getElementById("marketChart");
    const symbol = symbolControl ? symbolControl.value : "EURUSD";
    const labels = { EURUSD: "EUR/USD", GBPUSD: "GBP/USD", USDJPY: "USD/JPY", XAUUSD: "Gold (XAU/USD proxy)" };
    document.getElementById("marketSymbolLabel").textContent = labels[symbol] || symbol;
    statusEl.textContent = "Fetching latest available indicative prices…";
    try {
      const response = await fetch("https://aejoqsckzceufdbwhegl.supabase.co/functions/v1/market-data?symbol=" + encodeURIComponent(symbol), { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Market data request failed.");
      if (data.price == null) throw new Error("The provider did not return a current price.");
      const decimals = symbol === "USDJPY" ? 3 : symbol === "XAUUSD" ? 2 : 5;
      priceEl.textContent = Number(data.price).toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
      statusEl.textContent = "Feed: " + data.provider + " · " + (data.marketState || "market status unavailable") + ". Indicative only.";
      updatedEl.textContent = "Fetched " + new Date(data.fetchedAt).toLocaleTimeString() + (data.exchangeTimezoneName ? " · Provider timezone: " + data.exchangeTimezoneName : "");
      lastMarketCandles = data.candles || [];
      drawMarketChart(lastMarketCandles);
    } catch (error) {
      statusEl.textContent = "Live feed unavailable: " + error.message + " You can retry.";
      updatedEl.textContent = "No successful update yet.";
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
    if (name === "Settings") {
      document.getElementById("saveSettings").addEventListener("click", saveSettings);
      loadSettings();
    } else if (name === "Overview") {
      loadSavedConfigSummary(name);
      document.getElementById("marketSymbol").addEventListener("change", loadLiveMarketData);
      document.getElementById("refreshMarket").addEventListener("click", loadLiveMarketData);
      document.getElementById("lineChartBtn").addEventListener("click", () => {
        marketChartType = "line";
        document.getElementById("lineChartBtn").className = "btn primary";
        document.getElementById("candleChartBtn").className = "btn outline";
        document.getElementById("lineChartBtn").setAttribute("aria-pressed", "true");
        document.getElementById("candleChartBtn").setAttribute("aria-pressed", "false");
        drawMarketChart(lastMarketCandles);
      });
      document.getElementById("candleChartBtn").addEventListener("click", () => {
        marketChartType = "candles";
        document.getElementById("lineChartBtn").className = "btn outline";
        document.getElementById("candleChartBtn").className = "btn primary";
        document.getElementById("lineChartBtn").setAttribute("aria-pressed", "false");
        document.getElementById("candleChartBtn").setAttribute("aria-pressed", "true");
        drawMarketChart(lastMarketCandles);
      });
      loadLiveMarketData();
      marketRefreshTimer = setInterval(loadLiveMarketData, 30000);
    } else if (name === "Strategy" || name === "Risk controls") {
      loadSavedConfigSummary(name);
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
    item.addEventListener("click", () => openTab(name, item));
    item.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openTab(name, item);
      }
    });
  });

  // Render the default Overview with the market panel on first page load.
  if (navItems[0]) openTab("Overview", navItems[0]);
}

document.addEventListener("click", event => {
  if (event.target.closest("#requestConnect")) {
    alert("MT5 bridge is not configured. Trading remains disabled until the authenticated Windows bridge is built and tested.");
  }
});
