// UI-only interactions. No trading command is sent from this file.
document.getElementById("requestConnect").addEventListener("click", () => {
  alert("MT5 bridge is not configured. Trading remains disabled until the authenticated Windows bridge is built and tested.");
});
for (const id of ["symbol", "timeframe", "risk", "daily"]) {
  document.getElementById(id).addEventListener("change", () => {
    alert("This is a local draft setting only. It is not saved to Supabase and cannot change an MT5 account.");
  });
}
