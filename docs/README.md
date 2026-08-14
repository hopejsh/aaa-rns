<p align="center"><b>Documentation</b> · 문서 · ドキュメント</p>

# AAA-RNS documentation

Click any **PDF** below and GitHub renders it in the browser — no download needed.
Markdown files render as pages. Nothing here is inside the distribution zip: the zip carries
only what is needed to run the software, and you take the documents you actually want from here.

이 문서들은 배포 zip에 들어 있지 않습니다 — zip에는 실행에 필요한 파일만 있습니다.
아래 **PDF** 를 클릭하면 GitHub 화면 안에서 바로 열립니다.

これらの文書は配布 zip には含まれていません — zip には実行に必要なファイルのみです。
下の **PDF** をクリックすると GitHub の画面内でそのまま開きます。

|  | 한국어 | English | 日本語 |
|---|---|---|---|
| **Installation & user guide**<br><sub>Every step, with real screen captures taken in that language</sub> | [설치·사용 가이드](ko/installation-guide.pdf) | [Installation & user guide](en/installation-guide.pdf) | [インストール・利用ガイド](ja/installation-guide.pdf) |
| **User manual**<br><sub>Reference for day-to-day use</sub> | [사용설명서](ko/user-manual.md) | [User manual](en/user-manual.md) | [利用マニュアル](ja/user-manual.md) |
| **Verification report**<br><sub>21 cycles · 2,446,015 simulation runs</sub> | [검증보고서](ko/verification-report.md) | [Verification report](en/verification-report.md) | [検証報告書](ja/verification-report.md) |
| **Training deck**<br><sub>For introducing the system to a new team</sub> | [교육용 발표자료](ko/training-deck.pdf) | [Training deck](en/training-deck.pdf) | [研修用スライド](ja/training-deck.pdf) |

The editable PowerPoint sources of the training decks live in [`src/decks/`](src/decks) and are
also attached to every [release](../../releases/latest) for convenience. GitHub cannot preview a
`.pptx` in any case — the PDFs above are the versions meant for reading in the browser.

## Screen captures are language-native

Each guide's screenshots were taken **in that language's own interface**, not translated
captions over Korean screens. What you see in the document is what you see on screen.

각 가이드의 화면 캡처는 **해당 언어 화면에서 직접 촬영**했습니다.
各ガイドのスクリーンショットは**その言語の画面から直接撮影**しています。

## Training decks

The decks were produced while this project was under the MIT license. Slide 29 (Legal notice)
and its speaker notes have been corrected to Apache License 2.0 in all three languages, in both
the PowerPoint sources under [`src/decks/`](src/decks) and the published PDFs.

To re-export after editing a deck, install the design fonts first — Barlow, Barlow Condensed,
IBM Plex Sans KR and Noto Sans JP, all OFL — or PowerPoint substitutes them silently.

## Regenerating

`src/build_guides.mjs` (guide PDFs) and `src/build_manuals.mjs` (manuals) generate all three
languages from **one structure with three language packs**, so a section cannot go missing from
one language without going missing from all of them.

```bash
node docs/src/build_guides.mjs     # → docs/src/{en,ko,ja}/guide.html
node docs/src/build_manuals.mjs    # → docs/{en,ko,ja}/user-manual.md
```

Screen captures live in `src/img/{en,ko,ja}/`. Deck sources are in `src/decks/` and currently
cannot be rebuilt — they reference an external design-system bundle that is not part of this
repository.

---

AAA-RNS v2.0 · Developed by **Seung Ho Jung** · Apache-2.0 © 2026
