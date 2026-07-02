# CLAUDE.md

inBiot documentation site, built on Mintlify. Deployed at docs.inbiotair.com.

## PDF generation pipeline

This repo auto-generates branded PDF downloads (datasheets, guides) from the docs content.

- `pdf-generator/pdfs.config.json` — defines each PDF: title, subtitle, version, doc_type (DATASHEET/GUIDE), and the ordered list of `.mdx` pages it's composed from. Supports `"page.mdx#section-slug"` to include only one section of a page. **This is the only file to edit when adding/changing PDFs.**
- `pdf-generator/generate.py` — converts the MDX pages to a branded PDF (WeasyPrint). Brand: Roboto, accent #009BE5, blue full-bleed cover with white logo (`pdf-generator/assets/logo-white.svg`), pill-style section banners, "Copyright © inBiot Monitoring SL" footer, blue back cover. Matches the design of the official MICA WELL V1.12 datasheet.
- `.github/workflows/generate-pdfs.yml` — on every push to main (except commits only touching `files/`), regenerates all PDFs and commits them to `files/`. Do NOT add `[skip ci]` to its commit message — it prevents Mintlify from deploying.

## Important constraints (learned the hard way)

- **Mintlify does NOT serve `.pdf` static files on our plan** (Enterprise-only feature) → "Asset not found". PDF links must use raw GitHub URLs instead:
  `https://raw.githubusercontent.com/grolandi/docs/main/files/<id>.pdf`
  This works because the repo is public; raw URLs always serve latest main (~5 min cache).
- PDF download links live on the Guides page: `downloads/hardware.mdx`.
- A link only works if a matching `id` exists in `pdfs.config.json` — otherwise 404.

## Pending / TODO

- Add config entries + links for: Sigfox Guide, Cellular IoT Guide, Ethernet Guide.
- Update Modbus/BACnet/datasheet links to raw GitHub URLs (only LoRaWAN done).
- Fix typos: "Sigxog" → "Sigfox", "Cellulat IoT" → "Cellular IoT", "Hardare" → "Hardware" (in `downloads/hardware.mdx` frontmatter), `downloads/plaform.mdx` → "platform".
- Most content pages are still "Coming soon" placeholders; PDFs regenerate automatically as content is filled in.
- PDF `version` field is bumped manually in the config (intentional — bump on meaningful content changes).
