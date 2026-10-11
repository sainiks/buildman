/*! Buildman tracker. No cookies, no stored IPs. Honors Do Not Track.
 *  <script defer src="https://YOUR-GITMAN/t.js" data-key="pk_..."></script>
 *  Custom events:   window.buildman.track("signup")
 *  Click events:    <button data-buildman-event="buy">Buy</button>
 */
(function () {
  var script = document.currentScript;
  if (!script) return;
  var key = script.getAttribute("data-key");
  if (!key) return;
  // Add ?buildman_debug=1 to any page URL to see on-screen why a visit was or wasn't counted (handy on phones).
  var debug = /[?&]buildman_debug=1/.test(location.search);
  function toast(text, bad) {
    if (!debug) return;
    try {
      var el = document.getElementById("buildman-debug");
      if (!el) {
        el = document.createElement("div");
        el.id = "buildman-debug";
        el.style.cssText = "position:fixed;left:8px;right:8px;bottom:8px;z-index:2147483647;padding:10px 12px;border-radius:10px;font:13px/1.4 -apple-system,system-ui,sans-serif;color:#fff;box-shadow:0 4px 20px rgba(0,0,0,.4)";
        (document.body || document.documentElement).appendChild(el);
      }
      el.style.background = bad ? "#b3261e" : "#1e7a46";
      el.textContent = "Buildman: " + text;
    } catch (e) {}
  }
  if (navigator.doNotTrack === "1" || window.doNotTrack === "1" || navigator.msDoNotTrack === "1") {
    toast("not counted: this browser has Do Not Track turned on", true);
    return;
  }

  var endpoint;
  try {
    endpoint = new URL(script.src).origin + "/api/collect";
  } catch (e) {
    return;
  }

  function send(type, name) {
    var body = JSON.stringify({
      k: key,
      t: type,
      n: name || null,
      p: location.pathname,
      h: location.hostname,
      r: document.referrer || null,
      w: window.innerWidth || null,
    });
    if (debug) {
      fetch(endpoint, { method: "POST", body: body, headers: { "Content-Type": "text/plain" } })
        .then(function (r) {
          var why = r.headers.get("X-Buildman") || "no reason header (old server?)";
          toast((type === "pageview" ? "pageview " : "event ") + why + " [HTTP " + r.status + "]", why !== "counted");
        })
        .catch(function (e) {
          toast("couldn't reach " + endpoint + " (content blocker, VPN or network?)", true);
        });
      return;
    }
    try {
      // text/plain keeps this a "simple" request: no CORS preflight.
      if (navigator.sendBeacon && navigator.sendBeacon(endpoint, new Blob([body], { type: "text/plain" }))) return;
    } catch (e) {}
    try {
      fetch(endpoint, { method: "POST", body: body, keepalive: true, mode: "no-cors", headers: { "Content-Type": "text/plain" } });
    } catch (e) {}
  }

  var lastPath = null;
  function pageview() {
    if (location.pathname === lastPath) return;
    lastPath = location.pathname;
    send("pageview");
  }

  // Single-page apps change the URL without reloading.
  ["pushState", "replaceState"].forEach(function (fn) {
    var original = history[fn];
    if (typeof original !== "function") return;
    history[fn] = function () {
      var result = original.apply(this, arguments);
      setTimeout(pageview, 0);
      return result;
    };
  });
  window.addEventListener("popstate", function () {
    setTimeout(pageview, 0);
  });

  document.addEventListener(
    "click",
    function (e) {
      var el = e.target && e.target.closest ? e.target.closest("[data-buildman-event], a[href]") : null;
      if (!el) return;
      var custom = el.getAttribute("data-buildman-event");
      if (custom) return send("event", custom);
      try {
        var url = new URL(el.href, location.href);
        if (url.hostname && url.hostname !== location.hostname) send("event", "outbound:" + url.hostname);
      } catch (err) {}
    },
    true
  );

  window.buildman = window.buildman || {};
  window.gitman = window.buildman; // alias for snippets installed before the rename
  window.buildman.track = function (name) {
    if (typeof name === "string" && name) send("event", name);
  };

  if (document.visibilityState === "prerender") {
    document.addEventListener("visibilitychange", function once() {
      document.removeEventListener("visibilitychange", once);
      pageview();
    });
  } else {
    pageview();
  }
})();
