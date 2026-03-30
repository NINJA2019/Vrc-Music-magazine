# VRC Music Archive

VRChat音楽クリエイターのメタデータカタログ。BRUTUSスタイルの雑誌UIでページをめくって閲覧。

## Setup

1. `git clone` this repo
2. Connect to Netlify (publish directory: `.`)
3. Supabase project: `vrc-music-archive` (ap-northeast-1)

## Development

- `index.html` — 公開マガジン（StPageFlip）
- `admin.html` — 管理画面（表紙エディタ + アーティスト管理）

## Architecture

- Frontend: Vanilla HTML/CSS/JS
- Page flip: StPageFlip (page-flip@2.0.7)
- Database: Supabase (Postgres + Storage)
- Hosting: Netlify (static)
