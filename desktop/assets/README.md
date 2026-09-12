# Desktop Assets

Place the following icon files here before building:

- `icon.png`  — 512×512 PNG (used for Linux and as source)
- `icon.ico`  — Windows multi-size ICO (256×256, 128×128, 64×64, 32×32, 16×16)
- `icon.icns` — macOS ICNS

## Generating icons from a PNG

If you have `icon.png` (512×512), you can generate the other formats:

**macOS (using png2icns or sips):**
```bash
mkdir icon.iconset
sips -z 512 512 icon.png --out icon.iconset/icon_512x512.png
iconutil -c icns icon.iconset -o icon.icns
```

**Windows (using ImageMagick):**
```bash
magick convert icon.png -resize 256x256 icon.ico
```

The existing `waitnot-restaurant/Images/logo.jpg` can be used as the source image.
