# Tháp Hà Nội — Stack Tower

Game web "Stack Tower" lấy chủ đề phố cổ Hà Nội. Người chơi canh thời điểm thả các tầng nhà đang di chuyển ngang sao cho khớp với tầng dưới; lệch bị "gọt", trượt là Game Over. Tháp càng cao càng khó (tốc độ tăng, có gió, có power-up).

## Stack

- **Phaser 3** + **TypeScript** + **Vite** (strict mode, path aliases)
- **Howler.js** — audio cross-browser, graceful fallback khi thiếu file
- **i18next** — VI / EN
- **vite-plugin-pwa** — installable + offline
- **Vitest** — unit tests cho logic thuần (slicing, scoring, RNG, achievements)

## Tính năng

- **2 chế độ chơi**: Classic và Daily Challenge (seed theo ngày, deterministic cho mọi người)
- **4 power-up**: Mở rộng `↔`, Chậm lại `⏱`, Nam châm `★`, Hồi phục `♥`
- **3 theme**: Hà Nội (default), Sài Gòn (mở @ tầng 50), Huế (mở @ tầng 100)
- **19 achievements** (4 categories: milestone / skill / collection / daily)
- **Combo system**: x2/x3/x4/x5 multiplier, slow-mo @ combo ≥3, restore width @ combo 5
- **Juiciness**: particle bursts, camera shake calibrated, haptic feedback, parallax sky
- **PWA**: cài lên homescreen, chơi offline
- **i18n**: VI/EN switch instant
- **Tutorial** lần đầu chơi
- **Settings**: BGM/SFX sliders, haptic toggle, language, reset data
- **Local leaderboard**: top 10 cho Classic + Daily
- **Share**: Web Share API + clipboard fallback (kèm screenshot canvas)

## Chạy local

```bash
npm install
npm run dev       # mở http://localhost:5173
```

### Scripts

| Lệnh | Tác dụng |
|---|---|
| `npm run dev` | Vite dev server với HMR |
| `npm run build` | Production build → `dist/` |
| `npm run preview` | Serve build production để test PWA |
| `npm test` | Vitest run-once |
| `npm run test:watch` | Vitest watch mode |
| `npm run lint` | ESLint |
| `npm run format` | Prettier write |

### Debug flags

- `?fps=1` — hiện FPS counter ở góc trái dưới HUD
- `?unlock=1` — dev mode: mở khoá hết themes + achievements (URL param, ưu tiên cho test)
- `VITE_DEV_UNLOCK_ALL=true` — env var build-time, cùng tác dụng `?unlock=1`

## Cấu trúc project

```
src/
├── config/              Phaser config, atlas mapping, tuning constants
├── scenes/              Boot / Preload / MainMenu / Tutorial / Game / HUD / Pause / GameOver / Settings / Achievements
├── objects/             Block, FallingDebris, BlockPool, Tower, ParallaxBackground, FxEmitter
├── systems/             Score, Difficulty, PowerUp, Save, Audio, Haptic, Camera FX,
│                        DailyChallenge, Achievement, Theme, I18n, Analytics
├── ui/                  Reusable UI (Toast, ScorePopup, FpsMeter)
├── utils/               math (sliceBlock), seededRandom (mulberry32), shareScore
├── i18n/                vi.json, en.json
├── types/               SaveData schema
├── pwa.ts               Service worker registration + update prompt
└── main.ts              Entry point
```

## Asset pipeline

- Sprite sheet: `public/assets/images/sprites/sprites-2.png` (1536×1024, RGBA)
- Atlas mapping curated in `src/config/atlas.ts` (45 frames)
- Audio: drop in `public/assets/audio/{drop,thud,slice,perfect,gameover,click,bgm}.{ogg,mp3}` — game chạy im lặng nếu thiếu

### Third-party assets

- **SFX** — [Kenney audio pack](https://kenney.nl/assets/category:Audio) — CC0
- **Sky decorations** (clouds, sun, moon) — [Kenney Background Elements](https://kenney.nl/assets/background-elements) — CC0
- **Street shophouses** (shop_brick_1/2, shop_yellow_1/2) and distant skyline silhouette — [2D Pixel City Pack by Jeronimo](https://opengameart.org/content/2d-pixel-city-pack) — CC-BY 4.0 (credit required)

### Re-mapping sprite sheet

```bash
python3 scripts/analyze_sprites.py    # auto-detect bounding boxes
python3 scripts/preview_atlas.py      # generate _atlas_preview.png to verify
python3 scripts/inspect_sections.py   # crop sections with pixel grid for manual tuning
python3 scripts/generate_pwa_icons.py # regen PWA icons from sprite sheet
```

## Deploy

### Vercel

```bash
npm i -g vercel
vercel       # follow prompts
vercel --prod
```

`vercel.json` đã cấu hình SPA rewrite + immutable cache cho `/assets/*` + no-cache cho `sw.js`.

### Netlify / GitHub Pages

Build artifact ở `dist/`. SPA fallback rewrite cần được cấu hình ở host (Netlify: `_redirects` với `/* /index.html 200`).

CI trên `.github/workflows/ci.yml` — lint, test, build, upload `dist/` artifact mỗi PR.

## Testing

```bash
npm test
```

Coverage hiện tại: 41 tests cho pure logic (slicing math, scoring/combo, difficulty curve, seeded RNG, power-up roll, daily determinism, achievement unlock, leaderboard sort, theme unlock).

## License

MIT.
