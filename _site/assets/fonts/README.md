# Self-hosted fonts — instructions

The site uses two fonts:

- **Noto Serif** — body text (humanist serif, native on Android)
- **Source Sans 3** — UI labels (humanist sans-serif)

Loading them from Google's CDN would violate GDPR (Munich ruling).
We self-host them. Android users automatically use the system-installed
copy of Noto Serif (no download needed) thanks to the `local()` declaration.

## How to download

Use the Google Webfonts Helper at https://gwfh.mranftl.com/fonts

### Noto Serif

1. Search "Noto Serif"
2. Charset: **latin** (and **latin-ext** if you want fuller European coverage — Polish, Czech, etc.)
3. Styles to select:
   - regular (400)
   - regular italic (400 italic)
   - semi-bold (600)
   - semi-bold italic (600 italic)
4. Format: **Modern Browsers (.woff2 only)**
5. Download the .zip and extract
6. Rename the files and place them in this folder:
   - `noto-serif-v##-latin-regular.woff2` → `noto-serif-latin-400-normal.woff2`
   - `noto-serif-v##-latin-italic.woff2` → `noto-serif-latin-400-italic.woff2`
   - `noto-serif-v##-latin-600.woff2` → `noto-serif-latin-600-normal.woff2`
   - `noto-serif-v##-latin-600italic.woff2` → `noto-serif-latin-600-italic.woff2`

### Source Sans 3

1. Search "Source Sans 3"
2. Charset: **latin**
3. Styles to select:
   - regular (400) + italic
   - medium (500) + italic
   - semi-bold (600) + italic
4. Format: **Modern Browsers (.woff2 only)**
5. Download, extract, rename:
   - `source-sans-3-v##-latin-regular.woff2` → `source-sans-3-latin-400-normal.woff2`
   - `source-sans-3-v##-latin-italic.woff2` → `source-sans-3-latin-400-italic.woff2`
   - `source-sans-3-v##-latin-500.woff2` → `source-sans-3-latin-500-normal.woff2`
   - `source-sans-3-v##-latin-500italic.woff2` → `source-sans-3-latin-500-italic.woff2`
   - `source-sans-3-v##-latin-600.woff2` → `source-sans-3-latin-600-normal.woff2`
   - `source-sans-3-v##-latin-600italic.woff2` → `source-sans-3-latin-600-italic.woff2`

## Final file list in this folder

```
src/assets/fonts/
├── fonts.css
├── README.md
├── noto-serif-latin-400-normal.woff2
├── noto-serif-latin-400-italic.woff2
├── noto-serif-latin-600-normal.woff2
├── noto-serif-latin-600-italic.woff2
├── source-sans-3-latin-400-normal.woff2
├── source-sans-3-latin-400-italic.woff2
├── source-sans-3-latin-500-normal.woff2
├── source-sans-3-latin-500-italic.woff2
├── source-sans-3-latin-600-normal.woff2
└── source-sans-3-latin-600-italic.woff2
```

## Total size

Roughly 350–450 KB across all 10 files. On Android, only the 6 Source Sans
files are actually fetched (~220 KB) since Noto Serif is local.
