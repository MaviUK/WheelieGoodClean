(function () {
  const API_BASE = ""; // same domain; set to "https://yourdomain.com" if hosting widget elsewhere

  function esc(str) {
    return String(str || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function stars(n) {
    const full = Math.max(0, Math.min(5, Number(n || 0)));
    return "★★★★★☆☆☆☆☆".slice(5 - full, 10 - full);
  }

  class GRWidget extends HTMLElement {
    async connectedCallback() {
      const widgetId = this.getAttribute("data-widget-id");
      if (!widgetId) return;

      const shadow = this.attachShadow({ mode: "open" });
      shadow.innerHTML = this.skeleton();

      try {
        const res = await fetch(`${API_BASE}/api/w/${encodeURIComponent(widgetId)}`, { mode: "cors" });
        const data = await res.json();
        shadow.innerHTML = this.render(data);
        this.bind(shadow);
      } catch (e) {
        shadow.innerHTML = this.error(String(e));
      }
    }

    skeleton() {
      return `
        <style>${baseCss()}</style>
        <div class="wrap">
          <div class="head">
            <div class="title">Loading reviews…</div>
          </div>
          <div class="grid">
            ${Array.from({ length: 3 }).map(() => `<div class="card sk"></div>`).join("")}
          </div>
        </div>
      `;
    }

    error(msg) {
      return `
        <style>${baseCss()}</style>
        <div class="wrap">
          <div class="card">
            <div class="title">Widget error</div>
            <div class="text">${esc(msg)}</div>
          </div>
        </div>
      `;
    }

    render(data) {
      const layout = data?.widget?.layout || "grid";
      const theme = data?.widget?.theme || {};
      const reviews = data?.reviews || [];
      const businessName = data?.business?.name || "Reviews";

      const cssVars = `
        :host{
          --accent:${esc(theme.accent || "#111")};
          --radius:${Number(theme.radius ?? 14)}px;
          --bg:${esc(theme.bg || "#fff")};
          --text:${esc(theme.text || "#111")};
          --muted:${esc(theme.muted || "#666")};
          --card:${esc(theme.card || "#f6f6f6")};
        }
      `;

      if (layout === "badge") {
        const avg = data?.business?.averageRating ?? null;
        const count = data?.business?.reviewCount ?? null;
        return `
          <style>${cssVars}${baseCss()}${badgeCss()}</style>
          <div class="badge">
            <div class="badgeTitle">${esc(businessName)}</div>
            <div class="badgeRow">
              <div class="badgeStars">${esc(stars(Math.round(avg || 0)))}</div>
              <div class="badgeMeta">${avg ? esc(Number(avg).toFixed(1)) : ""} ${count ? `(${esc(count)} reviews)` : ""}</div>
            </div>
          </div>
        `;
      }

      if (layout === "carousel") {
        return `
          <style>${cssVars}${baseCss()}${carouselCss()}</style>
          <div class="wrap">
            <div class="head">
              <div class="title">${esc(businessName)}</div>
              <div class="controls">
                <button class="btn" data-dir="-1" aria-label="Previous">‹</button>
                <button class="btn" data-dir="1" aria-label="Next">›</button>
              </div>
            </div>
            <div class="rail" part="rail">
              ${reviews.map(cardHtml).join("")}
            </div>
          </div>
        `;
      }

      // default grid
      return `
        <style>${cssVars}${baseCss()}${gridCss()}</style>
        <div class="wrap">
          <div class="head">
            <div class="title">${esc(businessName)}</div>
          </div>
          <div class="grid">
            ${reviews.map(cardHtml).join("")}
          </div>
        </div>
      `;
    }

    bind(shadow) {
      // Carousel controls (safe even if not carousel)
      const rail = shadow.querySelector(".rail");
      shadow.querySelectorAll("[data-dir]").forEach((btn) => {
        btn.addEventListener("click", () => {
          if (!rail) return;
          const dir = Number(btn.getAttribute("data-dir"));
          rail.scrollBy({ left: dir * 320, behavior: "smooth" });
        });
      });

      // Read more
      shadow.querySelectorAll("[data-more]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const id = btn.getAttribute("data-more");
          const p = shadow.querySelector(`[data-text="${CSS.escape(id)}"]`);
          if (!p) return;
          p.classList.toggle("expanded");
          btn.textContent = p.classList.contains("expanded") ? "Show less" : "Read more";
        });
      });
    }
  }

  function cardHtml(r) {
    const text = esc(r.text || "");
    const short = text.length > 160 ? text.slice(0, 160) + "…" : text;
    const needsMore = text.length > 160;

    return `
      <div class="card">
        <div class="top">
          <div class="who">
            ${r.photo ? `<img class="avatar" src="${esc(r.photo)}" alt="" />` : `<div class="avatar ph"></div>`}
            <div class="meta">
              <div class="name">${esc(r.author || "Anonymous")}</div>
              <div class="sub">${esc(r.date || "")}</div>
            </div>
          </div>
          <div class="rating" aria-label="${esc(r.rating)} stars">${esc(stars(r.rating))}</div>
        </div>
        <div class="text" data-text="${esc(r.id)}">
          ${short}
          ${needsMore ? `<span class="full">${text}</span>` : ""}
        </div>
        ${needsMore ? `<button class="more" data-more="${esc(r.id)}">Read more</button>` : ""}
      </div>
    `;
  }

  function baseCss() {
    return `
      :host{ display:block; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; color:var(--text); }
      .wrap{ background:var(--bg); border-radius:var(--radius); }
      .head{ display:flex; align-items:center; justify-content:space-between; gap:12px; padding:12px 12px 6px; }
      .title{ font-weight:700; font-size:14px; }
      .grid,.rail{ padding:6px 12px 12px; }
      .card{ background:var(--card); border-radius:calc(var(--radius) - 4px); padding:12px; box-sizing:border-box; }
      .top{ display:flex; align-items:flex-start; justify-content:space-between; gap:10px; }
      .who{ display:flex; gap:10px; align-items:center; min-width:0; }
      .avatar{ width:34px; height:34px; border-radius:999px; object-fit:cover; }
      .avatar.ph{ background:#ddd; }
      .meta{ min-width:0; }
      .name{ font-size:13px; font-weight:650; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:180px; }
      .sub{ font-size:12px; color:var(--muted); }
      .rating{ font-size:13px; letter-spacing:1px; color:var(--accent); white-space:nowrap; }
      .text{ margin-top:10px; font-size:13px; line-height:1.35; color:var(--text); }
      .text .full{ display:none; }
      .text.expanded{ }
      .text.expanded .full{ display:inline; }
      .more{ margin-top:8px; background:transparent; border:0; padding:0; color:var(--accent); cursor:pointer; font-size:13px; font-weight:600; }
      .sk{ min-height:120px; background:linear-gradient(90deg, #eee, #f7f7f7, #eee); background-size:200% 100%; animation: sk 1.2s infinite; }
      @keyframes sk{ 0%{ background-position: 200% 0; } 100%{ background-position: -200% 0; } }
    `;
  }

  function gridCss() {
    return `
      .grid{ display:grid; grid-template-columns: repeat(1, minmax(0,1fr)); gap:12px; }
      @media (min-width:520px){ .grid{ grid-template-columns: repeat(2, minmax(0,1fr)); } }
      @media (min-width:900px){ .grid{ grid-template-columns: repeat(3, minmax(0,1fr)); } }
    `;
  }

  function carouselCss() {
    return `
      .controls{ display:flex; gap:8px; }
      .btn{ width:32px; height:32px; border-radius:999px; border:1px solid rgba(0,0,0,.1); background:var(--bg); cursor:pointer; }
      .rail{ display:flex; gap:12px; overflow:auto; scroll-snap-type:x mandatory; -webkit-overflow-scrolling:touch; }
      .card{ min-width:280px; scroll-snap-align:start; }
    `;
  }

  function badgeCss() {
    return `
      .badge{ background:var(--bg); border-radius:var(--radius); padding:12px; border:1px solid rgba(0,0,0,.08); }
      .badgeTitle{ font-weight:700; font-size:14px; margin-bottom:6px; }
      .badgeRow{ display:flex; align-items:baseline; gap:10px; }
      .badgeStars{ letter-spacing:1px; color:var(--accent); font-size:14px; }
      .badgeMeta{ color:var(--muted); font-size:13px; }
    `;
  }

  if (!customElements.get("gr-widget")) {
    customElements.define("gr-widget", GRWidget);
  }
})();
