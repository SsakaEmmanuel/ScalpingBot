// ScalpingBot UI interactions only.
// Trading remains disabled. Settings are local drafts only.

const tabNames = [
  "Overview",
  "Strategy",
  "Risk controls",
  "Trade history",
  "Settings"
];

const sidebar = document.querySelector("#privateDashboard aside");
const main = document.querySelector("#privateDashboard .dash-main");

if (sidebar && main) {
  const navItems = [...sidebar.querySelectorAll("b")].slice(0, 5);
  const originalMainHTML = main.innerHTML;

  const panels = {
    "Overview": () => originalMainHTML,

    "Strategy": () => `
      <div class="panel">
        <h3>Strategy configuration</h3>
        <p>Choose your proposed strategy settings below.</p>
        ${document.querySelector(".lower .panel")?.outerHTML || ""}
      </div>
    `,

    "Risk controls": () => `
      <div class="panel">
        <h3>Risk controls</h3>
        <p>These are proposed limits only. They are not connected to MT5.</p>
        <label>Risk per trade
          <select id="risk">
            <option>0.25%</option>
            <option selected>0.5%</option>
            <option>1.0%</option>
          </select>
        </label>
        <label>Daily loss limit
          <select id="daily">
            <option>1.0%</option>
            <option selected>2.0%</option>
            <option>3.0%</option>
          </select>
        </label>
        <p class="notice">Draft only. No trades can be placed.</p>
      </div>
    `,

    "Trade history": () => `
      <div class="panel">
        <h3>Trade history</h3>
        <p class="empty">No trading data available. MT5 is not connected.</p>
      </div>
    `,

    "Settings": () => `
      <div class="panel">
        <h3>Settings</h3>
        <p>These settings are saved only in this browser session's page state.
        They are not saved to Supabase or sent to MT5.</p>
        <label>Symbol
          <select id="settingsSymbol">
            <option>EURUSD</option>
            <option>GBPUSD</option>
            <option>USDJPY</option>
            <option>XAUUSD</option>
          </select>
        </label>
        <label>Timeframe
          <select id="settingsTimeframe">
            <option>M1</option>
            <option>M5</option>
          </select>
        </label>
        <label>Risk per trade
          <select id="settingsRisk">
            <option>0.25%</option>
            <option selected>0.5%</option>
            <option>1.0%</option>
          </select>
        </label>
        <label>Daily loss limit
          <select id="settingsDaily">
            <option>1.0%</option>
            <option selected>2.0%</option>
            <option>3.0%</option>
          </select>
        </label>
        <p class="notice">Demo mode: these are proposed values only.</p>
      </div>
    `
  };

  navItems.forEach((item, index) => {
    const name = tabNames[index];
    item.setAttribute("role", "button");
    item.setAttribute("tabindex", "0");
    item.style.cursor = "pointer";

    function openTab() {
      navItems.forEach(nav => nav.classList.remove("active"));
      item.classList.add("active");
      main.innerHTML = panels[name]();
    }

    item.addEventListener("click", openTab);
    item.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openTab();
      }
    });
  });
}

const connectButton = document.getElementById("requestConnect");
if (connectButton) {
  connectButton.addEventListener("click", () => {
    alert("MT5 bridge is not configured. Trading remains disabled until the authenticated Windows bridge is built and tested.");
  });
}
