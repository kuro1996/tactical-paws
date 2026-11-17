# Build log — Nusantara Strike (best-game-01)

Re-authoring session, 2026-11-17. Competition: best-game-01 "Make the best game", deadline 2026-11-18T18:00:00Z.

## Init

- `makefun anchor 191c232bb52dc7ba239e4b9bc250a51f08cf776f round 34025037`
- Repo: https://github.com/kuro1996/tactical-paws (public, created 2026-11-16T17:06:54Z, after competition opened 2026-11-15T18:00:00Z)
- Wallet (Solana, public): PeS7GnF4M5hzu8Do8NqxDbH2gnhaWZ1AGpdRQrzSw4f

## Game code — freshly written in this session

- `game/src/config.js` — economy, weapons, maps, recoil, player/bot constants
- `game/src/audio.js` — procedural WebAudio sounds, no external files
- `game/src/world.js` — 64x64 arena, watchtower, crates, snow/desert decor, training range, dust, groundAt/losBlocked
- `game/src/bots.js` — 5v5 human-soldier bots (names Budi/Agus/Sinta/Dewi vs Joko/Slamet/Bambang/Udin/Tono), seek/strafe/flank/tower tactics
- `game/src/game.js` — state, rounds, economy, shooting, smoke, HUD, minimap, training
- `game/src/main.js` — renderer, input (keyboard/mouse/touch), loop, map rebuild, `window.__game` / `window.__world` / `window.__ready` / `window.__shotReady`
- `game/index.html` — exactly 1 import map, 1 ES module, 0 external refs
- `game/vendor/three/three.module.min.js` + `three.core.min.js` — Three.js 0.187.0 library vendored (library files, not game code)
- Kit-verbatim, untouched: `main.ts`, `serve.ts`, `vendor/makefun-game.ts`

## Fixes during verification

1. `three.core.min.js` missing (three 0.187 module imports it) — copied library file.
2. `world.js` exported `buildWorld` only, `main.js` imported `World` — fixed import + rebuild path; return object gained `mapKey` and `dispose()`.
3. Training targets faced up/down — disc rotation fixed to face the player; ring/bull given `userData.target = true`; target lookup now matches disc/ring/bull.
4. Training sign blocked the firing lane — moved above the lane.
5. `requestPointerLock()` unhandled rejection in headless — wrapped in try/catch + `.catch(()=>{})`.
6. Added `window.__shotReady` after first rendered frame (starter convention for the screenshot renderer).

## Verification (headless Chrome, file://, 1280x720)

- `node --check` OK on all 6 game JS files.
- Load: `window.__ready` true, `window.__shotReady` true, 0 JS errors, WebGL 2.0.
- Buy: MP5 $800 -> $200, weapon "MP5 SMG".
- Combat: 9 bots alive, timer 01:39; shoot test dmg 110, kills 1; reload 32.
- Round flow: forced timer end -> roundEnd, score 1-0, round 2 buy phase.
- Training: 5 targets, shoot test score 4, hits 4.
- FPS in headless software rendering: ~13-16 (headless only; real GPU will be faster).

## Screenshots (screenshots/, JPEG 1280x720, quality 80)

- `1-start.jpg` — 65,304 bytes (menu)
- `2-play.jpg` — 37,173 bytes (combat, HUD + hit on red bot)
- `3-results.jpg` — 34,262 bytes (round won, score 1-0, next-round button)
- `4-training.jpg` — 48,472 bytes (training range, score 2)

All under the 256 KiB limit. Long side 1280, short side 720.

## Commit / push

- Commit `6999336` ("Re-author Nusantara Strike for best-game-01", 19 files), pushed to `main` on 2026-11-17.
- GitHub About verified: homepage https://make.fun/c/best-game-01, topic `makefun`, visibility PUBLIC, created 2026-11-16T17:06:54Z.
- README carries the three live make.fun badges (best-game-01, rank, reward).

## Bundle dry-run (kit CLI, 2026-11-17)

- `--dry-run --no-family` finds 2 sessions: this re-authoring session (abe9ea88…, 114 turns, 398 lines kept) and the earlier repo-creation coordinator session (f8867376…, 17 turns). The 16 older polish sessions are left out with `--no-family`.
- Resolved: system prompt in-session; instruction file collected (AGENTS.md); MCP servers none (`--mcp none`); provider meta, model muse-spark-1.3, effort default; prompt file `/tmp/best-game-01-prompt.txt` holds the user's verbatim prompt "C. Pivot ke best-game-01" (origin handed-off, via parent agent hand-off from the user's WhatsApp message).
- NOT resolvable from this subagent session: (1) usage rows — a subagent's rows are written only once its run completes, so the top-level agent (5fbc107b-1013-488d-a73b-ce4b08fc9818) must run the real bundle after this run ends; a bundle without usage rows is rejected where transcripts are required. (2) harness-version — no version is recorded in any Muse app session file (headers carry only format version 1); the parent must declare it with `--harness-version`.
- Parent bundle command (run from inside the unpacked kit, after this run completes):

```
node cli/makefun.mjs bundle --repo ~/workspace/makefun-fps/tactical-paws \
  --out transcripts.tar.gz --no-family \
  --prompt-file /tmp/best-game-01-prompt.txt --prompt-origin handed-off \
  --prompt-via "parent agent hand-off from user's WhatsApp message" \
  --mcp none --provider meta --model muse-spark-1.3 --effort default \
  --harness-version <version> \
  --notes "Subagent re-authoring session for best-game-01; parent agent 5fbc107b-1013-488d-a73b-ce4b08fc9818 runs the final bundle after this run completes."
```

Then: `node cli/makefun.mjs check --kit . --repo ~/workspace/makefun-fps/tactical-paws --transcripts transcripts.tar.gz`.

## Open items

- Elimination-win / match-end screen not yet proven in a run (round-end proven).
- Real bundle + check still to run by the parent agent (see above) — NOT done by this session.
- Submit is user-side (make.fun login @khurota-shoyo + Solana wallet) — NOT done by this session.
