/* CSA Events & Projects public feed
 * Connect the Google Apps Script web app URL here after deployment.
 * Leave blank until the Sheet API has been deployed; the page will show a friendly empty state.
 */
const CSA_EVENTS_API_URL = "";

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
  function card(item) {
    const article = make("article", "csa-event-card");
    if (item.image) {
      const img = make("img", "csa-event-image");
      img.src = item.image; img.alt = item.title || "CSA event or project"; img.loading = "lazy";
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
    if (item.action_url) {
      const a = make("a", "csa-event-link", item.action_label || "Know more ↗");
      a.href = item.action_url; a.target = "_blank"; a.rel = "noopener noreferrer"; body.append(a);
    }
    article.append(body); return article;
  }
  function render(root, items) {
    root.replaceChildren();
    if (!items.length) { root.append(emptyState()); return; }
    items.forEach(item => root.append(card(item)));
  }
  function validItems(data) {
    const today = new Date(); today.setHours(0,0,0,0);
    return (Array.isArray(data) ? data : []).filter(x => x && x.title && String(x.visible).toLowerCase() !== "false")
      .map(x => ({...x, type: String(x.type || "Project"), status: String(x.status || "Upcoming")}))
      .sort((a,b) => new Date(a.date || "2999-12-31") - new Date(b.date || "2999-12-31"));
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
  fetch(CSA_EVENTS_API_URL, {cache:"no-store"})
    .then(response => { if (!response.ok) throw new Error("Feed unavailable"); return response.json(); })
    .then(data => load(data.items || data))
    .catch(() => load([]));
})();
