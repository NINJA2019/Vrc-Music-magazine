# VRC Music Archive — Updated Spec (v3: Scroll-Snap Edition)

## Pivot: StPageFlip → CSS Scroll-Snap

StPageFlipを完全に削除。ページめくりではなく**縦スクロール＋スナップ**で雑誌体験を作る。
各セクションが100vhのフルビューポートで、スクロールするとピタッと次のページに止まる。

**理由:** BRUTUSらしさの本質は「ページをめくる物理」ではなく「タイポグラフィと余白の美しさ」。
スクロールスナップなら外部ライブラリゼロ、レイアウトの自由度が最大化される。

## Tech Stack (simplified)

- **Frontend**: Vanilla HTML/CSS/JS（フレームワークなし）
- **Page transition**: CSS `scroll-snap-type: y mandatory`（ライブラリ不要）
- **Database**: Supabase (変更なし)
- **Hosting**: Netlify (変更なし)
- **Fonts**: Google Fonts — Noto Sans JP, DM Sans, Instrument Serif

**削除するもの:**
- `page-flip` npm package / CDN ← 完全削除
- StPageFlip関連のJS/CSS全て

## Core CSS (3行で完成する遷移)

```css
html {
  scroll-snap-type: y mandatory;
  overflow-y: scroll;
  scroll-behavior: smooth;
}

.section {
  height: 100vh;
  scroll-snap-align: start;
  overflow: hidden;
}
```

## Page Structure

各セクションは `<section class="section">` で、100vh固定。

### Section 1: Cover
- BRUTUSスタイルのマストヘッド
- レイアウトは Supabase `cover_configs` から読み込み
- 背景画像 + オーバーレイ
- 下部にスクロール誘導（↓ or "scroll" テキスト、opacity低め、パルスアニメーション）
- 右下に admin リンク（opacity: 0.3）

### Section 2: Table of Contents
- BRUTUS的な目次ページ
- クリックで該当セクションにスムースクロール（`element.scrollIntoView()`）
- イタリックセリフ体の号数 + サンセリフの項目名

### Section 3: Events
- 直近イベント一覧（Supabase `events` テーブルから）
- 出演者がDBにいればアーティストセクションへのリンク

### Section 4: Artist Index
- 3×2グリッドのアートワークカード
- CSS `:hover` でオーバーレイ表示（名前、ジャンル）
- クリックでそのアーティストのセクションにスクロール

### Section 5+: Artist Detail (×N)
- 左半分: フルブリードアートワーク + グラデーションオーバーレイ
- 右半分: エディトリアルテキスト
- 見出しの登場アニメーション（Intersection Observer で in-view 検出）
- 「Back to index」ボタン → Section 4 にスクロール

## Typography Design System (BRUTUS inspired)

ここが最も重要。タイポグラフィと余白で雑誌の質感を作る。

### Font assignments
- **Masthead / UI labels**: DM Sans, weight 900, letter-spacing: 5px, uppercase
- **Japanese body / headlines**: Noto Sans JP, weight 900 for headlines, 400 for body
- **Issue number / accents / section titles**: Instrument Serif, italic
- **Metadata / captions**: DM Sans, weight 400, letter-spacing: 2-3px, uppercase, 9-10px

### Spacing rules (BRUTUS density)
- Section padding: `clamp(32px, 6vh, 64px)` vertical, `clamp(28px, 5vw, 80px)` horizontal
- Headline → body gap: `clamp(12px, 2vh, 24px)`
- Section dividers: 1px solid rgba(0,0,0,0.08) — not bold, barely there
- Body line-height: 2.0 (Japanese text needs more air than English)

### Color palette
- Paper: `#f5f2eb`
- Ink: `#1a1815`
- Ink muted: `#6b6760`
- Ink dim: `#a09b94`
- Accent: `#c4371a`

## Scroll Indicator

各セクション下部にうっすらとしたスクロールインジケーター:
```css
.scroll-hint {
  position: absolute;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 9px;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: rgba(26, 24, 21, 0.2);
  animation: hintPulse 2.5s ease-in-out infinite;
}
```

最後のセクション（最後のアーティスト）ではインジケーター非表示。

## Intersection Observer for Animations

アーティスト詳細ページの見出し登場演出:
```javascript
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('in-view');
    }
  });
}, { threshold: 0.3 });

document.querySelectorAll('.animate-on-scroll').forEach(el => observer.observe(el));
```

```css
.animate-on-scroll {
  opacity: 0;
  transform: translateY(24px);
  transition: opacity 0.6s, transform 0.6s cubic-bezier(0.22, 1, 0.36, 1);
}
.animate-on-scroll.in-view {
  opacity: 1;
  transform: translateY(0);
}
/* Stagger children */
.animate-on-scroll:nth-child(2) { transition-delay: 0.1s; }
.animate-on-scroll:nth-child(3) { transition-delay: 0.2s; }
.animate-on-scroll:nth-child(4) { transition-delay: 0.3s; }
```

## Supabase Configuration (unchanged)

- Project: `rnlgcvrmkdysqvpvfmol`
- URL: `https://rnlgcvrmkdysqvpvfmol.supabase.co`
- Anon Key: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJubGdjdnJta2R5c3F2cHZmbW9sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NjI1NjAsImV4cCI6MjA5MDQzODU2MH0.VKTpIjUloWoqMDdQ8_S_J4qETOPrIpDBvzPiYunqj3k`
- Tables: `cover_configs`, `artists`, `events` (all already created)
- Storage: `artwork/`, `covers/` buckets (already created)

## Navigation Rules

- Cover → TOC → Events → Index: **順スクロール**（スナップで1セクションずつ）
- TOC items: **クリックで該当セクションにスムースクロール**
- Artist Index cards: **クリックでアーティストセクションにスクロール**
- Artist Detail: **「Back to index」ボタンでIndexセクションに戻る**
- キーボード: ↑↓矢印 or スクロールで遷移

## Files to modify

1. **index.html** — StPageFlip CDN script tag を削除、scroll-snap構造に書き換え
2. **css/magazine.css** — .stf__* 関連を全削除、scroll-snap + BRUTUS typography
3. **js/magazine.js** — St.PageFlip初期化を全削除、Supabaseデータ取得 + DOM生成 + Intersection Observer
4. **js/supabase.js** — 変更なし
5. **admin.html** — 変更なし

## PR Instructions

- `feature/scroll-snap` ブランチを新規作成（feature/stpageflipは放棄）
- main → feature/scroll-snap でPR
- コミットメッセージ: `refactor: replace StPageFlip with CSS scroll-snap, focus on editorial typography`
