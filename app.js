// ScalpingBot dashboard UI and per-user settings persistence.
// No trading commands are sent. MT5 remains locked.

const tabNames = [
  "Overview",
  "Strategy",
  "Risk controls",
  "Trade history",
  "Settings"
];

const sidebar = document.querySelector("#privateDashboard aside");
const main = document.querySelector("#privateDashboard .dash-main");
const supabaseClient = () => window.SCALPINGBOT_SUPABASE || null;

if (sidebar && main) {
  const navItems = [...sidebar.querySelectorAll("b")].slice(0, 5);
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

  const panels = {
    "Overview": () => originalMainHTML,
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

  async function loadSavedConfigSummary(name) {
    const client = supabaseClient();
    const panel = main.querySelector(".panel");
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

    if (name === "Settings") {
      document.getElementById("saveSettings").addEventListener("click", saveSettings);
      loadSettings();
    } else if (name === "Strategy" || name === "Risk controls") {
      loadSavedConfigSummary(name);
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
}

document.addEventListener("click", event => {
  if (event.target.closest("#requestConnect")) {
    alert("MT5 bridge is not configured. Trading remains disabled until the authenticated Windows bridge is built and tested.");
  }
});
