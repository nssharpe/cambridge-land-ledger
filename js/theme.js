/* Theme: "auto" follows the OS; "light"/"dark" set data-theme on <html>. Runs in <head> to avoid a flash.
   ?theme=light|dark in the URL overrides for testing. Fires a "ledger-theme" event on change. */
(function () {
  "use strict";
  var KEY = "ledger-theme", root = document.documentElement;
  function stored() { try { return localStorage.getItem(KEY) || "auto"; } catch (e) { return "auto"; } }
  function apply(mode) {
    if (mode === "light" || mode === "dark") root.setAttribute("data-theme", mode);
    else root.removeAttribute("data-theme");
  }
  var q = null;
  try { q = new URLSearchParams(location.search).get("theme"); } catch (e) { /* old browser */ }
  var mode = (q === "light" || q === "dark") ? q : stored();
  apply(mode);

  function label(btn, m) {
    btn.textContent = "Theme: " + m;
    btn.setAttribute("aria-label", "Color theme: " + (m === "auto" ? "automatic" : m) + ". Change theme");
  }
  document.addEventListener("DOMContentLoaded", function () {
    var btn = document.getElementById("theme-toggle");
    if (!btn) return;
    label(btn, mode);
    btn.addEventListener("click", function () {
      mode = mode === "auto" ? "light" : mode === "light" ? "dark" : "auto";
      try { localStorage.setItem(KEY, mode); } catch (e) { /* private mode */ }
      apply(mode);
      label(btn, mode);
      window.dispatchEvent(new Event("ledger-theme"));
    });
  });
  if (window.matchMedia) {
    var mq = window.matchMedia("(prefers-color-scheme: dark)");
    var fire = function () { window.dispatchEvent(new Event("ledger-theme")); };
    if (mq.addEventListener) mq.addEventListener("change", fire); else if (mq.addListener) mq.addListener(fire);
  }
})();
