// VRC Music Archive — Scroll-Snap Magazine
// Fetches Supabase data, builds sections, sets up Intersection Observer.

const ADMIN_W = 480;
const ADMIN_H = 640;

document.addEventListener('DOMContentLoaded', async () => {
  const sb = initSupabase();

  const [coverRes, artistsRes, eventsRes] = await Promise.all([
    sb.from('cover_configs').select('*').eq('is_active', true).limit(1).maybeSingle(),
    sb.from('artists').select('*').eq('is_published', true).order('sort_order'),
    sb.from('events').select('*').gte('start_at', new Date().toISOString()).order('start_at').limit(10),
  ]);

  const cover = coverRes.data;
  const artists = artistsRes.data || [];
  const events = eventsRes.data || [];

  const main = document.getElementById('main');

  // Build sections
  main.appendChild(buildCover(cover, artists.length));
  main.appendChild(buildToc(artists, events.length));
  main.appendChild(buildEvents(events, artists));
  main.appendChild(buildIndex(artists));
  artists.forEach((a, i) => main.appendChild(buildDetail(a, i, artists.length)));

  // Click delegation
  main.addEventListener('click', (e) => {
    const scrollTarget = e.target.closest('[data-scroll-to]');
    if (scrollTarget) {
      const el = document.getElementById(scrollTarget.dataset.scrollTo);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    const extLink = e.target.closest('.evt-link');
    if (extLink) return; // let default <a> behavior work
    e.target.closest('.art-lnk')?.addEventListener('click', ev => ev.preventDefault(), { once: true });
  });

  // Intersection Observer for scroll animations
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) entry.target.classList.add('in-view');
    });
  }, { threshold: 0.3 });
  document.querySelectorAll('.animate-on-scroll').forEach(el => observer.observe(el));

  // Hide loading
  document.getElementById('loading')?.classList.add('hide');
});

// ===== Section builders =====

function buildCover(coverData, artistCount) {
  const sec = makeSection('sec-cover', 'sec-cover');

  if (coverData && coverData.config && coverData.config.elements) {
    // Dynamic cover from Supabase
    if (coverData.background_url) {
      const bg = h('div', 'cov-bg');
      bg.style.backgroundImage = `url(${coverData.background_url})`;
      sec.appendChild(bg);
    }
    if (coverData.config.overlay) {
      const ov = h('div', 'cov-overlay');
      const { color, alpha } = coverData.config.overlay;
      if (color && alpha > 0) {
        const [r, g, b] = [color.slice(1,3), color.slice(3,5), color.slice(5,7)].map(x => parseInt(x, 16));
        ov.style.background = `rgba(${r},${g},${b},${alpha / 100})`;
      }
      sec.appendChild(ov);
    }
    const dynamic = h('div', 'cov-dynamic');
    coverData.config.elements.forEach(elem => {
      const d = h('div', 'cov-el');
      d.style.left = (elem.x / ADMIN_W * 100) + '%';
      d.style.top = (elem.y / ADMIN_H * 100) + '%';
      d.style.fontSize = `calc(${elem.fontSize / ADMIN_H * 100}vh)`;
      d.style.fontWeight = elem.fontWeight;
      d.style.fontFamily = elem.fontFamily + ', sans-serif';
      d.style.color = elem.color;
      if (elem.italic) d.style.fontStyle = 'italic';
      d.innerHTML = esc(elem.text).replace(/\n/g, '<br>');
      dynamic.appendChild(d);
    });
    sec.appendChild(dynamic);
  } else {
    // Fallback static cover
    const bar = h('div', 'cov-bar');
    sec.appendChild(bar);
    const content = h('div', 'cov-content');
    content.innerHTML = `
      <div class="cov-header">
        <div class="cov-mast">VRC Music<br><b>ARCHIVE</b></div>
        <div class="cov-issue"><i>01</i>March 2026<br>Tokyo — Virtual</div>
      </div>
      <div class="cov-body">
        <h1 class="cov-headline">VRChat生活圏から<br>生まれた音楽を、<br>はじめてURLとして<br>記録する。</h1>
        <p class="cov-sub">VRChat内で活動する70組以上の音楽クリエイターを体系的にアーカイブする、初のWebカタログ。路地裏のライブハウスに、表通りの看板を。</p>
        <div class="cov-accent-bar"></div>
      </div>
      <div class="cov-footer">
        <span>${artistCount} Artists Featured</span>
        <span>Free &amp; Open</span>
      </div>`;
    sec.appendChild(content);
  }

  sec.appendChild(scrollHint('scroll'));
  const admin = document.createElement('a');
  admin.href = 'admin.html';
  admin.className = 'admin-link';
  admin.textContent = 'admin';
  sec.appendChild(admin);
  return sec;
}

function buildToc(artists, eventCount) {
  const sec = makeSection('sec-toc', 'sec-toc');
  const artistList = artists.map((a, i) =>
    `<div class="toc-artist-item" data-scroll-to="artist-${i}">
      <span class="toc-artist-num">${String(i + 1).padStart(2, '0')}</span>
      <span class="toc-artist-name">${esc(a.name)}</span>
    </div>`
  ).join('');

  sec.innerHTML = `
    <div class="toc-head">
      <div class="toc-label">Issue 01</div>
      <div class="toc-title">Contents</div>
    </div>
    <hr class="toc-divider">
    <div class="toc-sections">
      <div class="toc-item" data-scroll-to="sec-events">
        <span class="toc-num">01</span>
        <span class="toc-name">Events</span>
        <span class="toc-arrow">${eventCount} upcoming →</span>
      </div>
      <div class="toc-item" data-scroll-to="sec-index">
        <span class="toc-num">02</span>
        <span class="toc-name">Artist Index</span>
        <span class="toc-arrow">${artists.length} creators →</span>
      </div>
    </div>
    <hr class="toc-divider">
    <div class="toc-artists-label">Featured Artists</div>
    <div class="toc-artists">${artistList}</div>
    <div class="toc-footer">VRC Music Archive — Free &amp; Open</div>`;
  sec.appendChild(scrollHint('↓'));
  return sec;
}

function buildEvents(events, artists) {
  const sec = makeSection('sec-events', 'sec-events');
  let content;
  if (events.length === 0) {
    content = '<div class="evt-empty">No upcoming events</div>';
  } else {
    content = '<div class="evts-list">' + events.map(ev => {
      const date = new Date(ev.start_at);
      const dateStr = date.toLocaleDateString('ja-JP', { year: 'numeric', month: 'short', day: 'numeric' });
      const timeStr = date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
      let performers = '';
      if (ev.performer_ids && ev.performer_ids.length > 0) {
        performers = '<div class="evt-performers">' +
          ev.performer_ids.map(pid => {
            const idx = artists.findIndex(a => a.id === pid);
            if (idx >= 0) return `<span class="evt-performer linked" data-scroll-to="artist-${idx}">${esc(artists[idx].name)}</span>`;
            return '';
          }).filter(Boolean).join('') + '</div>';
      }
      const link = ev.external_url
        ? `<a class="evt-link" href="${esc(ev.external_url)}" target="_blank" rel="noopener">Details →</a>`
        : '';
      return `<div class="evt-card">
        <div class="evt-meta">
          <span class="evt-date">${dateStr} ${timeStr}</span>
          ${ev.venue ? `<span class="evt-venue">${esc(ev.venue)}</span>` : ''}
          ${ev.genre ? `<span class="evt-genre-badge">${esc(ev.genre)}</span>` : ''}
        </div>
        <div class="evt-title-text">${esc(ev.title)}</div>
        ${ev.description ? `<div class="evt-desc">${esc(ev.description)}</div>` : ''}
        ${performers}${link}
      </div>`;
    }).join('') + '</div>';
  }

  sec.innerHTML = `
    <div class="evts-head">
      <div class="evts-title">Events</div>
      <div class="evts-count">${events.length} upcoming</div>
    </div>
    <hr class="toc-divider">
    ${content}`;
  sec.appendChild(scrollHint('↓'));
  return sec;
}

function buildIndex(artists) {
  const sec = makeSection('sec-index', 'sec-index');
  if (artists.length === 0) {
    sec.innerHTML = `
      <div class="idx-head">
        <div class="idx-title">Featured Artists</div>
        <div class="idx-sub">Coming soon</div>
      </div>
      <div class="idx-empty">Artists coming soon</div>`;
    return sec;
  }

  const cards = artists.map((a, i) => {
    const img = a.artwork_url
      ? `<img src="${esc(a.artwork_url)}" alt="${esc(a.name)}" loading="lazy">`
      : `<div class="placeholder"><span>${String(i + 1).padStart(2, '0')}</span></div>`;
    return `<div class="idx-card" data-scroll-to="artist-${i}">
      ${img}
      <div class="ov">
        <div class="g">${esc(a.genre || '')}</div>
        <div class="n">${esc(a.name)}</div>
        <div class="en">${esc(a.name_en || '')}</div>
        <div class="rd">Read feature →</div>
      </div>
    </div>`;
  }).join('');

  sec.innerHTML = `
    <div class="idx-head">
      <div class="idx-title">Featured Artists</div>
      <div class="idx-sub">Issue 01 — ${artists.length} Creators</div>
    </div>
    <div class="idx-grid">${cards}</div>`;
  sec.appendChild(scrollHint('↓'));
  return sec;
}

function buildDetail(artist, idx, total) {
  const sec = makeSection('sec-detail', `artist-${idx}`);
  const num = String(idx + 1).padStart(2, '0');
  const isLast = idx === total - 1;

  const img = artist.artwork_url
    ? `<img src="${esc(artist.artwork_url)}" alt="${esc(artist.name)}" loading="lazy">`
    : `<div class="placeholder-art" style="background:linear-gradient(135deg,#1a1815,#3d3a35)">
        <span style="font-family:var(--serif);font-style:italic;font-size:80px;color:rgba(255,255,255,.06)">${num}</span>
      </div>`;

  let tracksHtml = '';
  const tracks = artist.tracks || [];
  if (tracks.length > 0) {
    tracksHtml = `<hr class="art-div">
      <div class="art-sec">Discography</div>
      <ul class="art-tl">${tracks.map((t, j) =>
        `<li class="art-tr">
          <span class="art-tr-n">${j + 1}</span>
          <span class="art-tr-t">${esc(t.t || '')}</span>
          <span class="art-tr-d">${esc(t.d || '')}</span>
        </li>`).join('')}</ul>`;
  }

  let linksHtml = '';
  const links = artist.links || [];
  if (links.length > 0) {
    linksHtml = `<hr class="art-div">
      <div class="art-sec">Links</div>
      <div class="art-lnks">${links.map(l =>
        `<a href="#" class="art-lnk" onclick="event.preventDefault()">${esc(l)}</a>`
      ).join('')}</div>`;
  }

  sec.innerHTML = `
    <div class="art-inner">
      <div class="art-vis">
        ${img}
        <div class="grad"></div>
        <div class="big-num">${num}</div>
        <div class="genre-v">${esc(artist.genre || '')}</div>
      </div>
      <div class="art-txt">
        <button class="back-btn" data-scroll-to="sec-index">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          Back to index
        </button>
        <div class="animate-on-scroll"><div class="art-lbl">Artist ${num} / ${String(total).padStart(2, '0')}</div></div>
        <div class="animate-on-scroll"><div class="art-nm">${esc(artist.name)}</div></div>
        <div class="animate-on-scroll"><div class="art-nm-en">${esc(artist.name_en || '')}</div></div>
        <div class="animate-on-scroll"><div class="art-detail-genre">${esc(artist.genre || '')}</div></div>
        <div class="animate-on-scroll">
          <hr class="art-div">
          <p class="art-bio">${esc(artist.bio || '')}</p>
          ${tracksHtml}
          ${linksHtml}
        </div>
      </div>
    </div>`;

  if (!isLast) sec.appendChild(scrollHint('↓'));
  return sec;
}

// ===== Helpers =====

function makeSection(className, id) {
  const s = document.createElement('section');
  s.className = 'section ' + className;
  if (id) s.id = id;
  return s;
}

function scrollHint(text) {
  const d = document.createElement('div');
  d.className = 'scroll-hint';
  d.textContent = text;
  return d;
}

function h(tag, className) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  return e;
}

function esc(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}
