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
    const section = make("section", "csa-coming-soon");
    section.setAttribute("aria-label", "Upcoming CSA event and production categories");
    const heading = make("div", "csa-coming-head");
    const copy = make("div", "csa-coming-copy");
    copy.append(make("span", "csa-coming-kicker", "COMING NEXT AT CSA"));
    copy.append(make("h3", "", "Big moments. Beautifully captured."));
    copy.append(make("p", "", "We’re preparing exciting event and production experiences. Explore what’s coming soon."));
    heading.append(copy);
    const controls = make("div", "csa-coming-controls");
    const prev = make("button", "csa-slider-arrow", "‹");
    prev.type = "button"; prev.setAttribute("aria-label", "Previous categories");
    const next = make("button", "csa-slider-arrow", "›");
    next.type = "button"; next.setAttribute("aria-label", "Next categories");
    controls.append(prev, next); heading.append(controls); section.append(heading);

    const track = make("div", "csa-coming-track");
    track.setAttribute("tabindex", "0");
    track.setAttribute("aria-label", "Coming soon categories slider");
    const slides = [
      ["Wedding & Pre-Wedding Events", "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=900&q=85", "Wedding ceremonies, candid moments and cinematic highlights."],
      ["Corporate Programs", "https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=900&q=85", "Conferences, launches, award nights and business events."],
      ["Product Photography & Shoots", "https://images.unsplash.com/photo-1490312278390-ab64016e0aa9?auto=format&fit=crop&w=900&q=85", "Premium product visuals, catalogue images and promotional videos."],
      ["Birthday & Special Events", "https://images.pexels.com/photos/796606/pexels-photo-796606.jpeg?auto=compress&cs=tinysrgb&w=1200&q=85", "Celebrate milestones with memorable photo and video coverage."],
      ["Brand Promotional Shoots", "https://images.unsplash.com/photo-1492619375914-88005aa9e8fb?auto=format&fit=crop&w=900&q=85", "Creative campaigns, brand films and social media content."],
      ["Podcast & Creator Productions", "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?auto=format&fit=crop&w=900&q=85", "Multi-camera podcasts, interviews and creator-led shows."],
      ["Wedding Live Coverage & Streaming", "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=900&q=85", "Live wedding ceremonies, varmala, pheras and real-time streaming for family and guests."],
      ["Religious & Spiritual Programs – Live", "https://images.unsplash.com/photo-1604608672516-8f3ce5b7b7b7?auto=format&fit=crop&w=900&q=85", "Bhajan, kirtan, pravachan, jagran, aarti, yatra and religious functions streamed live."],
      ["Concerts, Cultural Shows & Stage Events", "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=900&q=85", "Concerts, festivals, dance performances, award shows and stage programs."],
      ["Political Rallies & Public Meetings", "https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?auto=format&fit=crop&w=900&q=85", "Public meetings, rallies, speeches, press conferences and community gatherings."],
      ["School, College & Sports Events", "https://images.unsplash.com/photo-1523580494863-6f3031224c94?auto=format&fit=crop&w=900&q=85", "Annual days, graduations, competitions, tournaments and school or college functions."],
      ["Corporate Seminars & Conferences – Live", "https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=900&q=85", "Business conferences, seminars, training sessions, product launches and panel discussions."],
      ["Inauguration & Grand Opening – Live", "https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=900&q=85", "Shop openings, office inaugurations, launches and ribbon-cutting ceremonies streamed live."] ,
      ["Engagement, Ring Ceremony & Anniversary", "https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&w=900&q=85", "Engagements, ring ceremonies, anniversaries and family celebrations covered live."],
      ["Birthday, Baby Shower & Naming Ceremony", "https://images.unsplash.com/photo-1513151233558-d860c5398176?auto=format&fit=crop&w=900&q=85", "Birthday parties, baby showers, naming ceremonies and special family occasions."],
      ["Fashion Shows & Beauty Pageants", "https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=900&q=85", "Fashion shows, designer showcases, beauty pageants and ramp walks."],
      ["Award Functions & Felicitation Ceremonies", "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?auto=format&fit=crop&w=900&q=85", "Award nights, prize distributions, felicitation programs and recognition ceremonies."],
      ["Exhibitions, Trade Fairs & Business Expos", "https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=900&q=85", "Trade fairs, exhibitions, business expos, stalls and public showcases."],
      ["Temple Festivals, Yatra & Processions", "https://images.unsplash.com/photo-1606293926075-69a00db407e3?auto=format&fit=crop&w=900&q=85", "Temple festivals, palkhi, yatra, processions and community religious celebrations."],
      ["Marathons, Races & Fitness Events", "https://images.unsplash.com/photo-1530549387789-4c1017266635?auto=format&fit=crop&w=900&q=85", "Marathons, cycling events, fitness challenges, yoga sessions and sports meets."],
      ["Press Conferences & Media Launches", "https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=900&q=85", "Press meets, media briefings, announcements, interviews and launch events."],
      ["Webinars, Online Classes & Training", "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&q=85", "Online lectures, webinars, coaching sessions, workshops and virtual training."],
      ["Product Launches & Brand Activations", "https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=900&q=85", "New product launches, brand activations, dealer meets and promotional events."],
      ["Real Estate Launches & Property Events", "https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=900&q=85", "Project launches, site inaugurations, property expos and real-estate events."],
      ["Government & Public Awareness Programs", "https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?auto=format&fit=crop&w=900&q=85", "Public awareness campaigns, civic programs, government functions and community outreach."],
      ["Annual General Meetings & Board Events", "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=900&q=85", "AGMs, shareholder meetings, board presentations and internal corporate events."],
      ["Dance, Music & Talent Competitions", "https://images.unsplash.com/photo-1504609813442-a8924e83f76e?auto=format&fit=crop&w=900&q=85", "Dance competitions, singing contests, talent hunts and cultural performances."],
      ["Hybrid Events & Multi-Camera Webcasting", "https://images.unsplash.com/photo-1475721027785-f74eccf877e2?auto=format&fit=crop&w=900&q=85", "In-person plus online events with multi-camera production, live switching and streaming."],
      ["Community, NGO & Charity Events", "https://images.unsplash.com/photo-1559027615-cd4628902d4a?auto=format&fit=crop&w=900&q=85", "Community gatherings, NGO programs, charity events, blood donation camps and social initiatives."],
      ["Memorial & Tribute Programs", "https://images.unsplash.com/photo-1511632765486-a01980e01a18?auto=format&fit=crop&w=900&q=85", "Memorial meetings, tribute events and remembrance programs covered respectfully."],
      ["School Lectures, Guest Talks & Convocations", "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=900&q=85", "Guest lectures, expert talks, convocations, seminars and educational events."],
      ["Live Sports Commentary & Match Streaming", "https://images.unsplash.com/photo-1461896836934-ima?auto=format&fit=crop&w=900&q=85", "Local matches, tournaments and competitions with live commentary and score overlays."],
      ["Factory, Office & Facility Inaugurations", "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=900&q=85", "Factory openings, office launches, facility inaugurations and industrial events."]
    ];
    slides.forEach(([title, image, description]) => {
      const card = make("article", "csa-coming-card");
      const img = make("img", "csa-coming-image");
      img.src = image; img.alt = title; img.loading = "lazy"; img.decoding = "async";
      img.onerror = () => { img.style.display = "none"; };
      card.append(img);
      const shade = make("div", "csa-coming-shade");
      shade.append(make("span", "csa-coming-badge", "COMING SOON"));
      const body = make("div", "csa-coming-card-copy");
      body.append(make("h4", "", title), make("p", "", description));
      const link = make("a", "csa-coming-link", "Discuss your project ↗");
      link.href = "contact.html";
      body.append(link); shade.append(body); card.append(shade); track.append(card);
    });
    section.append(track);
    prev.addEventListener("click", () => track.scrollBy({left: -track.clientWidth * .82, behavior: "smooth"}));
    next.addEventListener("click", () => track.scrollBy({left: track.clientWidth * .82, behavior: "smooth"}));
    const note = make("p", "csa-coming-note", "These are upcoming service categories. Dates and bookings will be announced soon.");
    section.append(note);
    return section;
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
      root.classList.add("has-coming-soon");
      root.append(emptyState());
      return;
    }
    root.classList.remove("has-coming-soon");
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
    // Keep the homepage visually complete even when the optional live feed is offline.
    // The homepage uses the local Coming Soon slider as a graceful fallback.
    if (homeRoot) render(homeRoot, []);
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
