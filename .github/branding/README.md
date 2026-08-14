# Branding assets

## social-preview.png (1280×640)

The image GitHub shows when a link to this repository is posted anywhere — Hacker News,
Reddit, Slack, Bluesky, LinkedIn, a messaging app. **Without it every one of those renders a
grey Octocat**, which is why it exists.

Upload it at **Settings → General → Social preview → Upload an image**. GitHub's limit is 1 MB;
this file is well under.

### Regenerating

`social-preview.html` is the source. It crops `docs/src/img/en/12-gates.png` directly — the
verification-gate screen, chosen because it shows the one thing no other notebook does: the
product refusing to seal. It references that file rather than keeping a copy here, because a
second copy is a second thing to keep in step.

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless --disable-gpu --allow-file-access-from-files --hide-scrollbars \
  --force-device-scale-factor=1 --window-size=1280,640 \
  --screenshot=social-preview.png social-preview.html
```

The design fonts (Barlow, Barlow Condensed — OFL) must be installed or the type falls back
and the layout shifts.

---

AAA-RNS · Developed by **Seung Ho Jung** · Apache-2.0 © 2026
