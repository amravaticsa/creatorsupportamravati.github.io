/* CSA Events & Projects public feed
 * Paste the deployed Google Apps Script /exec URL below.
 * The public feed exposes only rows explicitly marked visible=TRUE.
 */
const CSA_EVENTS_API_URL = "https://script.google.com/macros/s/AKfycbwSSvSq1xOCzs1Xe6tO5qdN_JFMLYrvmoSxwdxCao1DKOyJdZqMN7fYx6Vb8D32QQA/exec";

(function () {
  "use strict";
  const categories = ["All", "Event", "Project", "Workshop"];
  const homeRoot = document.getElementById("csa-home-events");
  const pageRoot = document.getElementById("csa-all-events");
  const filterRoot = document.getElementById("csa-event-filters");
  if (!homeRoot && !pageRoot) return;

  function make(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
  }
  function emptyState() {
    const box = make("div", "csa-empty");
    box.append(make("h3", "", "New updates are coming soon"));
    box.append(make("p", "", "There are no public events or projects listed right now. Please check back soon or contact CSA to discuss your idea."));
    const link = make("a", "csa-event-link", "Contact Creator Support Amravati ↗");
    link.href = "contact.html";
    box.append(link);
    return box;
  }
  function formatDate(value) {
    if (!value) return "Date to be announced";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return new Intl.DateTimeFormat("en-IN", {day:"numeric", month:"short", year:"numeric"}).format(d);
  }
  function safeUrl(value) {
    try {
      const url = new URL(value, window.location.origin);
      return ["https:", "http:"].includes(url.protocol) ? url.href : "";
    } catch (_) { return ""; }
  }
  function card(item) {
    const article = make("article", "csa-event-card");
    const imageUrl = safeUrl(item.image || "");
    if (imageUrl) {
      const img = make("img", "csa-event-image");
      img.src = imageUrl; img.alt = item.title || "CSA event or project"; img.loading = "lazy";
      img.onerror = () => img.remove();
      article.append(img);
    } else {
      const placeholder = make("div", "csa-event-image");
      placeholder.setAttribute("aria-hidden", "true"); article.append(placeholder);
    }
    const body = make("div", "csa-event-body");
    const meta = make("div", "csa-event-meta");
    meta.append(make("span", "csa-event-tag", item.type || "Project"));
    if (item.status) meta.append(make("span", "csa-event-tag status", item.status));
    body.append(meta);
    body.append(make("h3", "", item.title || "CSA update"));
    if (item.description) body.append(make("p", "", item.description));
    const details = make("div", "csa-event-details");
    details.append(make("span", "", "📅 " + formatDate(item.date)));
    if (item.location) details.append(make("span", "", "📍 " + item.location));
    body.append(details);
    const actionUrl = safeUrl(item.action_url || "");
    if (actionUrl) {
      const a = make("a", "csa-event-link", item.action_label || "Know more ↗");
      a.href = actionUrl; a.target = "_blank"; a.rel = "noopener noreferrer"; body.append(a);
    }
    article.append(body); return article;
  }
  function render(root, items) {
    root.replaceChildren();
    if (!items.length) { root.append(emptyState()); return; }
    items.forEach(item => root.append(card(item)));
  }
  function validItems(data) {
    return (Array.isArray(data) ? data : []).filter(x => x && x.title && String(x.visible).toLowerCase() === "true")
      .map(x => ({...x, type: String(x.type || "Project"), status: String(x.status || "Upcoming")}))
      .sort((a,b) => {
        const da = Date.parse(a.date) || Number.MAX_SAFE_INTEGER;
        const db = Date.parse(b.date) || Number.MAX_SAFE_INTEGER;
        return da - db;
      });
  }
  function addFilters(items) {
    if (!filterRoot) return;
    filterRoot.replaceChildren();
    const available = categories.filter(c => c === "All" || items.some(x => x.type.toLowerCase() === c.toLowerCase()));
    available.forEach((category, index) => {
      const button = make("button", "csa-filter", category);
      button.type = "button"; button.setAttribute("aria-pressed", index === 0 ? "true" : "false");
      button.addEventListener("click", () => {
        filterRoot.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b === button)));
        render(pageRoot, category === "All" ? items : items.filter(x => x.type.toLowerCase() === category.toLowerCase()));
      });
      filterRoot.append(button);
    });
  }
  function load(items) {
    const list = validItems(items);
    if (homeRoot) render(homeRoot, list.filter(x => String(x.featured).toLowerCase() !== "false").slice(0,3));
    if (pageRoot) { addFilters(list); render(pageRoot, list); }
  }
  if (!CSA_EVENTS_API_URL) { load([]); return; }

  // JSONP avoids cross-origin fetch restrictions on Google Apps Script web apps.
  const callbackName = "csaEventsCallback";
  const script = document.createElement("script");
  const timeout = window.setTimeout(() => { cleanup(); load([]); }, 12000);
  function cleanup() {
    window.clearTimeout(timeout);
    try { delete window[callbackName]; } catch (_) { window[callbackName] = undefined; }
    script.remove();
  }
  window[callbackName] = data => {
    cleanup();
    if (data && data.success !== false) load(data.events || data.items || []);
    else load([]);
  };
  script.onerror = () => { cleanup(); load([]); };
  script.src = CSA_EVENTS_API_URL + (CSA_EVENTS_API_URL.includes("?") ? "&" : "?") + "callback=" + callbackName;
  document.head.appendChild(script);
})();
