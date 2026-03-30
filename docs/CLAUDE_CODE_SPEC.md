# VRC Music Archive — Implementation Spec for Claude Code

## Overview

VRChat音楽クリエイターのメタデータカタログサイト。BRUTUSライクな雑誌UIでページをめくって閲覧する。管理画面からWeb上で表紙・アーティストを編集し、Supabaseに即保存・即反映。

## Repository Structure (target)

```
vrc-music-archive/
├── index.html          # 公開用マガジン（StPageFlip）
├── admin.html          # 管理画面（表紙エディタ + アーティスト管理）
├── css/
│   └── magazine.css
├── js/
│   ├── magazine.js     # StPageFlip初期化 + ページ描画
│   ├── supabase.js     # Supabase client初期化
│   └── admin.js        # 管理画面ロジック
├── assets/
│   └── fonts/
├── netlify.toml
└── README.md
```

## Tech Stack

- **Frontend**: Vanilla HTML/CSS/JS（フレームワークなし）
- **Page flip**: StPageFlip (`page-flip` npm package, CDN: https://cdn.jsdelivr.net/npm/page-flip@2.0.7/dist/js/page-flip.browser.js)
- **Database**: Supabase (Postgres + Storage)
- **Hosting**: Netlify (static site)
- **Fonts**: Google Fonts — Noto Sans JP, DM Sans, Instrument Serif

## Supabase Configuration

### Project

- **Name**: `vrc-music-archive`
- **Project ID**: `rnlgcvrmkdysqvpvfmol`
- **Region**: `ap-northeast-1` (Tokyo)
- **URL**: `https://rnlgcvrmkdysqvpvfmol.supabase.co`
- **Anon Key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJubGdjdnJta2R5c3F2cHZmbW9sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NjI1NjAsImV4cCI6MjA5MDQzODU2MH0.VKTpIjUloWoqMDdQ8_S_J4qETOPrIpDBvzPiYunqj3k`

### Tables (already created)

#### `cover_configs`
| Column | Type | Notes |
|--------|------|-------|
| id | bigint (identity) | PK |
| name | text | default 'default' |
| config | jsonb | 表紙レイアウトJSON（elements配列、overlay設定） |
| background_url | text | Supabase Storage URL |
| is_active | boolean | 公開サイトはis_active=trueのみ表示 |
| created_at | timestamptz | |
| updated_at | timestamptz | auto-trigger |

#### `artists`
| Column | Type | Notes |
|--------|------|-------|
| id | bigint (identity) | PK |
| name | text | 日本語名 |
| name_en | text | 英語名 |
| genre | text | |
| bio | text | |
| artwork_url | text | Supabase Storage URL |
| links | jsonb | `["YouTube", "SoundCloud"]` |
| tracks | jsonb | `[{"t":"track name","d":"3:42"}]` |
| is_published | boolean | 公開サイトはis_published=trueのみ表示 |
| sort_order | int | 表示順 |
| created_at | timestamptz | |
| updated_at | timestamptz | auto-trigger |

#### `events`
| Column | Type | Notes |
|--------|------|-------|
| id | bigint (identity) | PK |
| title | text | |
| description | text | |
| start_at | timestamptz | |
| end_at | timestamptz | |
| venue | text | |
| genre | text | |
| performer_ids | bigint[] | artistsテーブルのID配列 |
| external_url | text | |
| gcal_event_id | text (unique) | Google Calendar連携用 |
| created_at | timestamptz | |
| updated_at | timestamptz | auto-trigger |

### Storage Buckets (already created)

- **`artwork/`** — アーティストアートワーク画像（public、5MB上限、image/jpeg,png,webp,gif）
- **`covers/`** — 表紙背景画像（public、10MB上限、image/jpeg,png,webp）

### RLS Policies (already created)

- SELECT: `is_active=true` / `is_published=true` / `start_at >= now() - 1 day`のみ公開
- INSERT/UPDATE/DELETE: anon role に開放済み（開発用。公開前にSupabase Authに移行する）

## Page Structure (公開マガジン: index.html)

StPageFlipを使ったフルビューポートのページめくり体験。

### Pages

1. **Cover** — BRUTUSスタイルのマストヘッド。レイアウトは`cover_configs`テーブルから読み込み。背景画像はSupabase Storageから。クリックで次ページへ。
2. **Table of Contents** — クリッカブルな目次。各セクションへのページジャンプリンク。
3. **Events** — 直近のイベント予定。`events`テーブルから。出演アーティストがDBにいればリンク付き。
4. **Artist Index** — 3×2グリッドのアートワークカード。ホバーで名前表示。クリックでそのアーティストのページへジャンプ。
5. **Artist Detail Pages (×N)** — 左半分アートワーク、右半分エディトリアルテキスト（名前、ジャンル、bio、ディスコグラフィ、外部リンク）。見出しはスタガードアニメーションで登場。

### Navigation Rules

- Cover → TOC → Events → Artist Index: **順番にページカール**（StPageFlipの通常ナビ）
- Artist Index → Artist Detail: **カードクリックのみ**（`pageFlip.flip(pageNumber)`で直接ジャンプ）
- Artist Detail → Artist Index: **戻るボタン**で`pageFlip.flip()`
- Artist Detailページ間の直接移動は不可（必ずIndexに戻る）

### StPageFlip Configuration

```javascript
const pageFlip = new St.PageFlip(document.getElementById('magazine'), {
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
```

### Data Fetching (公開サイト)

```javascript
// Supabase JS client (CDN)
const sb = supabase.createClient(SUPA_URL, SUPA_KEY);

// Cover config
const { data: cover } = await sb
  .from('cover_configs')
  .select('*')
  .eq('is_active', true)
  .limit(1)
  .single();

// Artists (published only)
const { data: artists } = await sb
  .from('artists')
  .select('*')
  .eq('is_published', true)
  .order('sort_order');

// Events (upcoming)
const { data: events } = await sb
  .from('events')
  .select('*')
  .gte('start_at', new Date().toISOString())
  .order('start_at')
  .limit(10);
```

## Admin App (admin.html)

2タブ構成の管理画面。

### Tab 1: Cover Editor

- 480×640pxのカバープレビュー領域
- テキスト要素をドラッグで配置、右下ハンドルでフォントサイズ変更
- ダブルクリックで直接テキスト編集
- プロパティパネル: text, x, y, fontSize, fontWeight, fontFamily, color, italic
- 背景画像: アップロード時にCanvas APIで1200px幅WebPに圧縮 → Supabase Storage `covers/`バケットへ
- オーバーレイ: 色＋不透明度
- 「Save to Supabase」で`cover_configs`テーブルにupsert（configカラムにJSON）
- 「Reload」で最新のis_active=trueレコードを取得して復元
- 日付フォーマット: `yyyy/mm/dd 定価600円`

### Tab 2: Artist Manager

- 左パネル: アーティスト一覧（サムネイル、名前、ジャンル、公開/下書きバッジ）
- 右パネル: 登録/編集フォーム
  - name, name_en, genre, bio
  - artwork: アップロード時にCanvas APIで800px幅WebPに圧縮 → Supabase Storage `artwork/`バケットへ
  - links: JSON配列 `["YouTube", "SoundCloud"]`
  - tracks: JSON配列 `[{"t":"track name","d":"3:42"}]`
  - is_published: チェックボックス
- Save: `artists`テーブルにinsert/update
- Delete: 確認ダイアログ後に削除

### Image Optimization (both tabs)

```javascript
async function resizeImage(file, maxW = 800) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      let w = img.width, h = img.height;
      if (w > maxW) { h = Math.round(h * (maxW / w)); w = maxW; }
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      c.toBlob(b => resolve(b), 'image/webp', 0.82);
    };
    img.src = URL.createObjectURL(file);
  });
}
```

## Design System

### Typography
- Masthead/UI: `DM Sans` (weight 300-900)
- Japanese body: `Noto Sans JP` (weight 300-900)
- Issue number/accents: `Instrument Serif` (italic)

### Cover Element Default Config

```json
[
  {"id":"mast-label","text":"VRC Music","x":32,"y":32,"fontSize":10,"fontWeight":"900","fontFamily":"DM Sans","color":"#1a1815","italic":false},
  {"id":"mast-title","text":"ARCHIVE","x":32,"y":46,"fontSize":34,"fontWeight":"900","fontFamily":"DM Sans","color":"#1a1815","italic":false},
  {"id":"issue","text":"01","x":410,"y":30,"fontSize":36,"fontWeight":"400","fontFamily":"Instrument Serif","color":"#1a1815","italic":true},
  {"id":"date","text":"2026/03/30 定価600円","x":358,"y":72,"fontSize":9,"fontWeight":"400","fontFamily":"DM Sans","color":"#6b6760","italic":false},
  {"id":"headline","text":"VRChat生活圏から\n生まれた音楽を、\nはじめてURLとして\n記録する。","x":32,"y":200,"fontSize":28,"fontWeight":"900","fontFamily":"Noto Sans JP","color":"#1a1815","italic":false},
  {"id":"sub","text":"70組以上のVRChat音楽クリエイターを\n体系的にアーカイブする初のWebカタログ。","x":32,"y":430,"fontSize":12,"fontWeight":"400","fontFamily":"Noto Sans JP","color":"#6b6760","italic":false},
  {"id":"footer","text":"Free & Open","x":400,"y":612,"fontSize":9,"fontWeight":"400","fontFamily":"DM Sans","color":"#a09b94","italic":false}
]
```

### Color Palette
- Paper: `#f5f2eb`
- Ink: `#1a1815`
- Ink (muted): `#6b6760`
- Ink (dim): `#a09b94`
- Accent (red): `#c4371a`
- Admin background: `#18171a`
- Admin surface: `#222126`
- Admin accent: `#7c6df0`

### Artist Detail Page Layout
- 左半分: フルブリードアートワーク + グラデーションオーバーレイ + 大きい号数 + 縦書きジャンル
- 右半分: ラベル → 名前（スタガードアニメ） → name_en → ジャンル → divider → bio → divider → ディスコグラフィ（番号付きリスト） → divider → 外部リンク（ピル状ボタン）

## Netlify Configuration

```toml
[build]
  publish = "."

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
```

## PR Scope

### Files to create/modify

1. **index.html** — 公開マガジン。StPageFlipで全ページをレンダリング。Supabaseからデータ取得。
2. **admin.html** — 管理画面。表紙エディタ＋アーティスト管理。Supabase保存。
3. **netlify.toml** — ビルド設定
4. **README.md** — セットアップ手順

### Key Implementation Notes

- StPageFlipのCDN: `https://cdn.jsdelivr.net/npm/page-flip@2.0.7/dist/js/page-flip.browser.js`
- Supabase JS CDN: `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js`
- Google Fonts: `https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@300;400;500;700;900&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,700;0,9..40,900;1,9..40,400&family=Instrument+Serif:ital@0;1&display=swap`
- 全ページフルビューポート（`100vw × 100vh`）
- 画像は全てアップロード時にクライアントサイドでWebP圧縮（artwork: 800px幅、covers: 1200px幅）
- Artist Detailページの見出し: `transform: translateY(120%)` → `translateY(0)` のスタガードアニメーション（0.1秒刻み）
- ページめくりのカール表現はStPageFlipが担当（CSS 3D transformは不要）

## Security Note (TODO before production)

現在のRLSポリシーはanon roleで全テーブル書き込み可能（開発用）。公開前に:
1. Supabase Authでユーザー作成
2. RLSポリシーを`to authenticated`に変更
3. admin.htmlにログインフローを追加
