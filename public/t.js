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
  if (navigator.doNotTrack === "1" || window.doNotTrack === "1") return;

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
