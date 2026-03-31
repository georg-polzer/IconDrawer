# IconDrawer

Local multi-library icon browser for generating transparent PNGs you can drag straight into Google Slides.

## Features

- Search across Tabler, Lucide, Phosphor, and Iconoir
- Filter results with a library multi-select dropdown
- Switch between `outline` and `filled` variants when available
- Pick colors with the native browser color input, including the built-in eyedropper on supported systems
- Export transparent PNGs at common square sizes
- Drag the large preview directly into Google Slides
- Download the generated PNG as a fallback

## Getting started

```bash
npm install
npm start
```

Open [http://127.0.0.1:4173](http://127.0.0.1:4173) in your browser.

## How to use it

1. Search for an icon by name.
2. Use the library dropdown to search one or several icon sets at once.
3. Choose `outline` or `filled` if the selected icon supports both.
4. Pick the icon color and output size.
5. Drag the preview into Google Slides, or click `Download PNG`.

## Notes

- The PNG stays transparent outside the icon itself.
- The exact eyedropper experience depends on your browser and OS because it comes from the native color input control.
- Direct drag-and-drop into Google Slides is browser-dependent, so the download button remains the fallback path.

## Development

```bash
npm test
```
