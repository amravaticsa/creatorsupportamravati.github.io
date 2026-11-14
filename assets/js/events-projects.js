/* CSA Events & Projects public feed
 * Public feed exposes only rows explicitly marked visible=TRUE.
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

  function errorState(message) {
    const box = make("div", "csa-empty");
    box.setAttribute("role", "status");
    box.append(make("h3", "", "Updates are temporarily unavailable"));
    box.append(make("p", "", message || "Please refresh this page in a little while, or contact CSA for the latest event and project information."));
    const link = make("a", "csa-event-link", "Contact Creator Support Amravati ↗");
    link.href = "contact.html";
    box.append(link);
    return box;
  }

  function formatDate(value) {
    if (!value) return "Date to be announced";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return new Intl.DateTimeFormat("en-IN", {
      day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata"
    }).format(d);
  }

  function safeUrl(value) {
    try {
      const url = new URL(value, window.location.origin);
      if (!["https:", "http:"].includes(url.protocol)) return "";
      if (url.hostname === "drive.google.com") {
        let fileId = "";
        const match = url.pathname.match(/\/file\/d\/([^/]+)/);
        if (match) fileId = match[1];
        if (!fileId) fileId = url.searchParams.get("id") || "";
        if (fileId) return "https://drive.google.com/thumbnail?id=" + encodeURIComponent(fileId) + "&sz=w1600";
      }
      return url.href;
    } catch (_) {
      return "";
    }
  }

  function card(item) {
    const article = make("article", "csa-event-card");
    const defaultImages = {
      event: "https://images.pexels.com/photos/4342498/pexels-photo-4342498.jpeg?auto=compress&cs=tinysrgb&w=1000&q=80",
      project: "https://images.pexels.com/photos/29272604/pexels-photo-29272604.jpeg?auto=compress&cs=tinysrgb&w=1000&q=80",
      workshop: "https://images.pexels.com/photos/7710084/pexels-photo-7710084.jpeg?auto=compress&cs=tinysrgb&w=1000&q=80"
    };
    const imageUrl = safeUrl(item.image || defaultImages[String(item.type || "project").toLowerCase()] || defaultImages.project);
    if (imageUrl) {
      const img = make("img", "csa-event-image");
      img.src = imageUrl;
      img.alt = item.title || "CSA event or project";
      img.loading = "lazy";
      img.onerror = () => img.remove();
      article.append(img);
    } else {
      const placeholder = make("div", "csa-event-image");
      placeholder.setAttribute("aria-hidden", "true");
      article.append(placeholder);
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
      a.href = actionUrl;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      body.append(a);
    }
    article.append(body);
    return article;
  }

  function render(root, items) {
    root.setAttribute("aria-busy", "false");
    root.replaceChildren();
    if (!items.length) {
      root.append(emptyState());
      return;
    }
    items.forEach(item => root.append(card(item)));
  }

  function validItems(data) {
    return (Array.isArray(data) ? data : [])
      .filter(item => item && item.title && String(item.visible).toLowerCase() === "true")
      // Never publish obvious spreadsheet test/demo rows on the public website.
      .filter(item => !/sample entry for website testing/i.test(String(item.description || "")) &&
        !/^CSA Digital Creator Workshop\s*[–-]\s*Demo$/i.test(String(item.title || "")))
      .map(item => ({
        ...item,
        type: String(item.type || "Project"),
        status: String(item.status || "Upcoming")
      }))
      .sort((a, b) => {
        const da = Date.parse(a.date) || Number.MAX_SAFE_INTEGER;
        const db = Date.parse(b.date) || Number.MAX_SAFE_INTEGER;
        return da - db;
      });
  }

  function addFilters(items) {
    if (!filterRoot) return;
    filterRoot.replaceChildren();
    const available = categories.filter(category =>
      category === "All" || items.some(item => item.type.toLowerCase() === category.toLowerCase())
    );
    available.forEach((category, index) => {
      const button = make("button", "csa-filter", category);
      button.type = "button";
      button.setAttribute("aria-pressed", index === 0 ? "true" : "false");
      button.addEventListener("click", () => {
        filterRoot.querySelectorAll("button").forEach(current =>
          current.setAttribute("aria-pressed", String(current === button))
        );
        render(pageRoot, category === "All"
          ? items
          : items.filter(item => item.type.toLowerCase() === category.toLowerCase())
        );
      });
      filterRoot.append(button);
    });
  }

  function load(items) {
    const list = validItems(items);
    if (homeRoot) render(homeRoot, list.filter(item => String(item.featured).toLowerCase() !== "false").slice(0, 3));
    if (pageRoot) {
      addFilters(list);
      render(pageRoot, list);
    }
  }

  function showError(message) {
    if (homeRoot) {
      homeRoot.setAttribute("aria-busy", "false");
      homeRoot.replaceChildren(errorState(message));
    }
    if (pageRoot) {
      pageRoot.setAttribute("aria-busy", "false");
      if (filterRoot) filterRoot.replaceChildren();
      pageRoot.replaceChildren(errorState(message));
    }
  }

  if (!CSA_EVENTS_API_URL) {
    load([]);
    return;
  }

  // Google Apps Script supports JSONP through the callback query parameter.
  const callbackName = "csaEventsCallback";
  const script = document.createElement("script");
  let finished = false;

  function cleanup() {
    window.clearTimeout(timeout);
    try {
      delete window[callbackName];
    } catch (_) {
      window[callbackName] = undefined;
    }
    script.remove();
  }

  const timeout = window.setTimeout(() => {
    if (finished) return;
    finished = true;
    cleanup();
    showError("The events feed did not respond in time. Please try again later.");
  }, 12000);

  window[callbackName] = data => {
    if (finished) return;
    finished = true;
    cleanup();
    if (data && data.success !== false && Array.isArray(data.events || data.items)) {
      load(data.events || data.items);
    } else {
      showError("The events feed returned an unexpected response. Please contact CSA for the latest updates.");
    }
  };

  script.onerror = () => {
    if (finished) return;
    finished = true;
    cleanup();
    showError("We could not connect to the events feed. Please refresh later or contact CSA.");
  };

  script.src = CSA_EVENTS_API_URL +
    (CSA_EVENTS_API_URL.includes("?") ? "&" : "?") +
    "callback=" + encodeURIComponent(callbackName);
  document.head.appendChild(script);
})();
