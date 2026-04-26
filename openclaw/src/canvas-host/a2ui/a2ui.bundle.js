// Auto-generated placeholder bundle.
// This source checkout does not include the full A2UI renderer sources.
// Canvas A2UI remains unavailable until those sources are restored.
(function () {
  const message = "OpenClaw built without the optional A2UI renderer sources. Canvas A2UI is unavailable in this checkout. Restore vendor/a2ui and apps/shared/OpenClawKit/Tools/CanvasA2UI, then rerun `pnpm canvas:a2ui:bundle`.";
  console.warn(message);
  function render() {
    const root = document.body;
    if (!root) return;
    root.innerHTML = "";
    root.style.margin = "0";
    root.style.fontFamily = "ui-sans-serif, system-ui, sans-serif";
    root.style.background = "#0f1117";
    root.style.color = "#f3f4f6";
    root.style.minHeight = "100vh";
    root.style.display = "grid";
    root.style.placeItems = "center";
    const card = document.createElement("div");
    card.style.maxWidth = "720px";
    card.style.padding = "24px";
    card.style.margin = "24px";
    card.style.border = "1px solid rgba(255,255,255,0.12)";
    card.style.borderRadius = "16px";
    card.style.background = "rgba(255,255,255,0.04)";
    card.innerHTML =
      "<h1 style=\"margin:0 0 12px;font-size:24px\">A2UI unavailable</h1>" +
      "<p style=\"margin:0;line-height:1.6\">" + message + "</p>";
    root.appendChild(card);
  }
  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", render, { once: true });
    } else {
      render();
    }
  }
})();
