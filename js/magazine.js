// VRC Music Archive — StPageFlip Magazine
// Initializes StPageFlip, fetches data from Supabase, renders all pages.

const ARTISTS_PER_INDEX = 6;

// Default cover elements (fallback when no Supabase config)
const DEFAULT_COVER = {
  elements: [
    { id: 'mast-label', text: 'VRC Music', x: 32, y: 32, fontSize: 10, fontWeight: '900', fontFamily: 'DM Sans', color: '#1a1815', italic: false },
    { id: 'mast-title', text: 'ARCHIVE', x: 32, y: 46, fontSize: 34, fontWeight: '900', fontFamily: 'DM Sans', color: '#1a1815', italic: false },
    { id: 'issue', text: '01', x: 410, y: 30, fontSize: 36, fontWeight: '400', fontFamily: 'Instrument Serif', color: '#1a1815', italic: true },
    { id: 'date', text: '2026/03/30 定価600円', x: 358, y: 72, fontSize: 9, fontWeight: '400', fontFamily: 'DM Sans', color: '#6b6760', italic: false },
    { id: 'headline', text: 'VRChat生活圏から\n生まれた音楽を、\nはじめてURLとして\n記録する。', x: 32, y: 200, fontSize: 28, fontWeight: '900', fontFamily: 'Noto Sans JP', color: '#1a1815', italic: false },
    { id: 'sub', text: '70組以上のVRChat音楽クリエイターを\n体系的にアーカイブする初のWebカタログ。', x: 32, y: 430, fontSize: 12, fontWeight: '400', fontFamily: 'Noto Sans JP', color: '#6b6760', italic: false },
    { id: 'footer', text: 'Free & Open', x: 400, y: 612, fontSize: 9, fontWeight: '400', fontFamily: 'DM Sans', color: '#a09b94', italic: false },
  ],
  overlay: { color: '#000000', alpha: 0 },
};

// Admin canvas dimensions (for coordinate scaling)
const ADMIN_W = 480;
const ADMIN_H = 640;

document.addEventListener('DOMContentLoaded', async () => {
  const sb = initSupabase();

  // Fetch all data in parallel
  const [coverRes, artistsRes, eventsRes] = await Promise.all([
    sb.from('cover_configs').select('*').eq('is_active', true).limit(1).maybeSingle(),
    sb.from('artists').select('*').eq('is_published', true).order('sort_order'),
    sb.from('events').select('*').gte('start_at', new Date().toISOString()).order('start_at').limit(10),
  ]);

  const cover = coverRes.data;
  const artists = artistsRes.data || [];
  const events = eventsRes.data || [];

  const container = document.getElementById('magazine');

  // --- Build pages ---

  // Page 0: Cover
  container.appendChild(buildCoverPage(cover, artists.length));

  // Page 1: TOC
  container.appendChild(buildTocPage(artists, events.length));

  // Page 2: Events
  container.appendChild(buildEventsPage(events, artists));

  // Pages 3+: Artist Index (6 per page)
  const indexPageCount = Math.max(1, Math.ceil(artists.length / ARTISTS_PER_INDEX));
  for (let p = 0; p < indexPageCount; p++) {
    const slice = artists.slice(p * ARTISTS_PER_INDEX, (p + 1) * ARTISTS_PER_INDEX);
    container.appendChild(buildIndexPage(slice, p, indexPageCount, artists.length));
  }

  // Artist Detail pages
  const FIRST_INDEX = 3;
  const LAST_INDEX = FIRST_INDEX + indexPageCount - 1;
  const FIRST_DETAIL = LAST_INDEX + 1;

  artists.forEach((artist, i) => {
    container.appendChild(buildDetailPage(artist, i, artists.length));
  });

  // --- Init StPageFlip ---
  const pageFlip = new St.PageFlip(container, {
    width: window.innerWidth,
    height: window.innerHeight,
    size: 'stretch',
    minWidth: 320,
    maxWidth: 1920,
    minHeight: 400,
    maxHeight: 1200,
    drawShadow: true,
    flippingTime: 800,
    usePortrait: true,
    startZIndex: 0,
    autoSize: true,
    maxShadowOpacity: 0.3,
    showCover: true,
    mobileScrollSupport: false,
    swipeDistance: 30,
    showPageCorners: true,
  });

  pageFlip.loadFromHTML(document.querySelectorAll('#magazine .page'));

  // --- Navigation control ---
  let jumping = false;
  let currentPage = 0;

  pageFlip.on('flip', (e) => {
    const dest = e.data;
    currentPage = dest;

    // Block unauthorized navigation to detail pages
    if (!jumping && dest > LAST_INDEX) {
      pageFlip.turnToPage(LAST_INDEX);
      currentPage = LAST_INDEX;
      return;
    }

    // Trigger stagger animation on detail pages
    if (dest >= FIRST_DETAIL) {
      const pages = document.querySelectorAll('#magazine .page');
      const page = pages[dest];
      if (page && page.classList.contains('pg-detail')) {
        page.classList.remove('entered');
        requestAnimationFrame(() => {
          requestAnimationFrame(() => page.classList.add('entered'));
        });
      }
    }
  });

  function jumpTo(pageNum) {
    jumping = true;
    pageFlip.flip(pageNum);
    // Reset flag after animation completes
    setTimeout(() => { jumping = false; }, 1200);
  }

  function turnTo(pageNum) {
    jumping = true;
    pageFlip.turnToPage(pageNum);
    currentPage = pageNum;
    jumping = false;
  }

  // --- Event delegation ---
  container.addEventListener('click', (e) => {
    // Cover click → next page
    if (e.target.closest('.pg-cover')) {
      pageFlip.flipNext();
      return;
    }

    // TOC section links
    const tocItem = e.target.closest('[data-goto]');
    if (tocItem) {
      const target = parseInt(tocItem.dataset.goto, 10);
      if (target >= FIRST_DETAIL) {
        jumpTo(target);
      } else {
        pageFlip.flip(target);
      }
      return;
    }

    // Index card clicks → jump to detail
    const card = e.target.closest('.idx-card');
    if (card) {
      const artistIdx = parseInt(card.dataset.artist, 10);
      const targetPage = FIRST_DETAIL + artistIdx;
      jumpTo(targetPage);
      return;
    }

    // Back button → return to first index page
    const backBtn = e.target.closest('.back-btn');
    if (backBtn) {
      // Remove entered class from current detail page
      const detailPage = backBtn.closest('.pg-detail');
      if (detailPage) detailPage.classList.remove('entered');
      jumpTo(FIRST_INDEX);
      return;
    }

    // Event performer click → jump to artist detail
    const performer = e.target.closest('.evt-performer.linked');
    if (performer) {
      const artistIdx = parseInt(performer.dataset.artist, 10);
      jumpTo(FIRST_DETAIL + artistIdx);
      return;
    }
  });

  // Store page map for TOC links (needs to be set after pages are built)
  document.querySelectorAll('[data-goto-section]').forEach(el => {
    const section = el.dataset.gotoSection;
    if (section === 'events') el.dataset.goto = '2';
    else if (section === 'index') el.dataset.goto = String(FIRST_INDEX);
  });
  document.querySelectorAll('[data-goto-artist]').forEach(el => {
    const idx = parseInt(el.dataset.gotoArtist, 10);
    el.dataset.goto = String(FIRST_DETAIL + idx);
  });

  // Hide loading
  const loading = document.getElementById('loading');
  if (loading) loading.classList.add('hide');
});

// ===== Page builders =====

function buildCoverPage(coverData, artistCount) {
  const page = el('div', 'page pg-cover');

  if (coverData && coverData.config && coverData.config.elements) {
    // Dynamic cover from Supabase
    const cov = el('div', 'cov');

    // Background
    if (coverData.background_url) {
      const bg = el('div', 'cov-bg');
      bg.style.backgroundImage = `url(${coverData.background_url})`;
      cov.appendChild(bg);
    }

    // Overlay
    if (coverData.config.overlay) {
      const ov = el('div', 'cov-overlay');
      const { color, alpha } = coverData.config.overlay;
      if (color && alpha > 0) {
        const [r, g, b] = [color.slice(1, 3), color.slice(3, 5), color.slice(5, 7)].map(h => parseInt(h, 16));
        ov.style.background = `rgba(${r},${g},${b},${alpha / 100})`;
      }
      cov.appendChild(ov);
    }

    // Elements
    const dynamic = el('div', 'cov-dynamic');
    coverData.config.elements.forEach(elem => {
      const d = el('div', 'cov-el');
      d.style.left = (elem.x / ADMIN_W * 100) + '%';
      d.style.top = (elem.y / ADMIN_H * 100) + '%';
      d.style.fontSize = `calc(${elem.fontSize / ADMIN_H * 100}vh)`;
      d.style.fontWeight = elem.fontWeight;
      d.style.fontFamily = elem.fontFamily + ', sans-serif';
      d.style.color = elem.color;
      if (elem.italic) d.style.fontStyle = 'italic';
      d.style.lineHeight = '1.6';
      d.innerHTML = esc(elem.text).replace(/\n/g, '<br>');
      dynamic.appendChild(d);
    });
    cov.appendChild(dynamic);

    // Prompt
    const prompt = el('div', 'cov-prompt');
    prompt.innerHTML = 'Click to open &#8594;';
    cov.appendChild(prompt);

    page.appendChild(cov);
  } else {
    // Fallback: static cover layout
    page.innerHTML = `
      <div class="cov">
        <div class="bar"></div>
        <div class="cov-content">
          <div class="hd">
            <div class="m1">VRC Music<br><b>ARCHIVE</b></div>
            <div class="m2"><i>01</i>March 2026<br>Tokyo — Virtual</div>
          </div>
          <div class="bd">
            <h1>VRChat生活圏から<br>生まれた音楽を、<br>はじめてURLとして<br>記録する。</h1>
            <p class="sb">VRChat内で活動する70組以上の音楽クリエイターを体系的にアーカイブする、初のWebカタログ。路地裏のライブハウスに、表通りの看板を。</p>
            <div class="ab"></div>
          </div>
          <div class="ft">
            <span>${artistCount} Artists Featured</span>
            <span>Free &amp; Open</span>
          </div>
        </div>
        <div class="cov-prompt">Click to open &#8594;</div>
      </div>`;
  }
  return page;
}

function buildTocPage(artists, eventCount) {
  const page = el('div', 'page pg-toc');
  const artistList = artists.map((a, i) =>
    `<div class="toc-artist-item" data-goto-artist="${i}">
      <span class="toc-artist-num">${String(i + 1).padStart(2, '0')}</span>
      <span class="toc-artist-name">${esc(a.name)}</span>
    </div>`
  ).join('');

  page.innerHTML = `
    <div class="toc">
      <div class="toc-head">
        <div class="toc-label">Issue 01</div>
        <div class="toc-title">Contents</div>
      </div>
      <hr class="toc-divider">
      <div class="toc-sections">
        <div class="toc-item" data-goto-section="events">
          <span class="toc-num">01</span>
          <span class="toc-name">Events</span>
          <span class="toc-arrow">${eventCount} upcoming &#8594;</span>
        </div>
        <div class="toc-item" data-goto-section="index">
          <span class="toc-num">02</span>
          <span class="toc-name">Artist Index</span>
          <span class="toc-arrow">${artists.length} creators &#8594;</span>
        </div>
      </div>
      <hr class="toc-divider">
      <div class="toc-artists-label">Featured Artists</div>
      <div class="toc-artists">${artistList}</div>
      <div class="toc-footer">VRC Music Archive — Free &amp; Open</div>
    </div>`;
  return page;
}

function buildEventsPage(events, artists) {
  const page = el('div', 'page pg-events');

  let content = '';
  if (events.length === 0) {
    content = '<div class="evt-empty">No upcoming events</div>';
  } else {
    content = '<div class="evts-list">' + events.map(ev => {
      const date = new Date(ev.start_at);
      const dateStr = date.toLocaleDateString('ja-JP', { year: 'numeric', month: 'short', day: 'numeric' });
      const timeStr = date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });

      // Match performers to artists
      let performers = '';
      if (ev.performer_ids && ev.performer_ids.length > 0) {
        performers = '<div class="evt-performers">' +
          ev.performer_ids.map(pid => {
            const idx = artists.findIndex(a => a.id === pid);
            const artist = idx >= 0 ? artists[idx] : null;
            if (artist) {
              return `<span class="evt-performer linked" data-artist="${idx}">${esc(artist.name)}</span>`;
            }
            return '';
          }).filter(Boolean).join('') +
          '</div>';
      }

      let link = '';
      if (ev.external_url) {
        link = `<a class="evt-link" href="${esc(ev.external_url)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">Details &#8594;</a>`;
      }

      return `<div class="evt-card">
        <div class="evt-meta">
          <span class="evt-date">${dateStr} ${timeStr}</span>
          ${ev.venue ? `<span class="evt-venue">${esc(ev.venue)}</span>` : ''}
          ${ev.genre ? `<span class="evt-genre-badge">${esc(ev.genre)}</span>` : ''}
        </div>
        <div class="evt-title">${esc(ev.title)}</div>
        ${ev.description ? `<div class="evt-desc">${esc(ev.description)}</div>` : ''}
        ${performers}
        ${link}
      </div>`;
    }).join('') + '</div>';
  }

  page.innerHTML = `
    <div class="evts">
      <div class="evts-head">
        <div class="evts-title">Events</div>
        <div class="evts-count">${events.length} upcoming</div>
      </div>
      <hr class="toc-divider">
      ${content}
    </div>`;
  return page;
}

function buildIndexPage(artistSlice, pageIdx, totalPages, totalArtists) {
  const page = el('div', 'page pg-index');

  if (artistSlice.length === 0) {
    page.innerHTML = `
      <div class="idx">
        <div class="idx-head">
          <div class="idx-title">Featured Artists</div>
          <div class="idx-sub">Coming soon</div>
        </div>
        <div class="idx-empty">Artists coming soon</div>
      </div>`;
    return page;
  }

  const cards = artistSlice.map((a, i) => {
    const globalIdx = pageIdx * ARTISTS_PER_INDEX + i;
    const imgHtml = a.artwork_url
      ? `<img src="${esc(a.artwork_url)}" alt="${esc(a.name)}" loading="lazy">`
      : `<div class="placeholder"><span>${String(globalIdx + 1).padStart(2, '0')}</span></div>`;

    return `<div class="idx-card" data-artist="${globalIdx}">
      ${imgHtml}
      <div class="ov">
        <div class="g">${esc(a.genre || '')}</div>
        <div class="n">${esc(a.name)}</div>
        <div class="en">${esc(a.name_en || '')}</div>
        <div class="rd">Read feature &#8594;</div>
      </div>
    </div>`;
  }).join('');

  const pagination = totalPages > 1
    ? `<div class="idx-page-num">Page ${pageIdx + 1} / ${totalPages}</div>`
    : '';

  page.innerHTML = `
    <div class="idx">
      <div class="idx-head">
        <div class="idx-title">Featured Artists</div>
        <div class="idx-sub">Issue 01 — ${totalArtists} Creators</div>
      </div>
      <div class="idx-grid">${cards}</div>
      ${pagination}
    </div>`;
  return page;
}

function buildDetailPage(artist, idx, total) {
  const page = el('div', 'page pg-detail');
  const num = String(idx + 1).padStart(2, '0');

  const imgHtml = artist.artwork_url
    ? `<img src="${esc(artist.artwork_url)}" alt="${esc(artist.name)}" loading="lazy">`
    : `<div class="placeholder-art" style="background:linear-gradient(135deg,#1a1815,#3d3a35)">
        <span style="font-family:var(--serif);font-style:italic;font-size:80px;color:rgba(255,255,255,.06)">${num}</span>
      </div>`;

  // Tracks
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
        </li>`
      ).join('')}</ul>`;
  }

  // Links
  let linksHtml = '';
  const links = artist.links || [];
  if (links.length > 0) {
    linksHtml = `<hr class="art-div">
      <div class="art-sec">Links</div>
      <div class="art-lnks">${links.map(l =>
        `<a href="#" class="art-lnk" onclick="event.preventDefault();event.stopPropagation()">${esc(l)}</a>`
      ).join('')}</div>`;
  }

  page.innerHTML = `
    <div class="art-inner">
      <div class="art-vis">
        ${imgHtml}
        <div class="grad"></div>
        <div class="big-num">${num}</div>
        <div class="genre-v">${esc(artist.genre || '')}</div>
      </div>
      <div class="art-txt">
        <button class="back-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          Back to index
        </button>
        <div class="hl"><div class="art-lbl">Artist ${num} / ${String(total).padStart(2, '0')}</div></div>
        <div class="hl"><div class="art-nm">${esc(artist.name)}</div></div>
        <div class="hl"><div class="art-nm-en">${esc(artist.name_en || '')}</div></div>
        <div class="hl"><div class="art-lbl" style="color:var(--ink4);margin-top:4px">${esc(artist.genre || '')}</div></div>
        <div class="art-body">
          <hr class="art-div">
          <p class="art-bio">${esc(artist.bio || '')}</p>
          ${tracksHtml}
          ${linksHtml}
        </div>
      </div>
    </div>`;
  return page;
}

// ===== Utilities =====

function el(tag, className) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  return e;
}

function esc(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}
