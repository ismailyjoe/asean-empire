# ASEAN Empire
A browser trading strategy game across ASEAN markets. Made by IBJ.

## Play
GitHub Pages is intended to serve https://ismailyjoe.github.io/asean-empire/ once enabled and deployed.

- Start with RM 10,000 and trade through a 30-day campaign.
- Enter a whole-number quantity for each product, then Buy or Sell. Buy Max respects cash and free cargo space; Sell All sells the entire holding.
- Finish the campaign, register a public player name and submit the final net worth.
- Global Top 25 ranks completed campaigns by net worth, with earlier submissions first for tied scores. Each campaign can be submitted once; the same player name can appear for multiple campaigns.
- Progress and the remembered player name stay on the current device. Rankings need internet; gameplay works offline after the first successful service-worker installation.

## Hosting
This is a buildless static site; no Node dependencies are required to play.
In repository Settings → Pages, select **Deploy from a branch**, **main**, **/(root)** and Save.
All game assets use relative URLs to work at the /asean-empire/ project path. The service worker is scoped to that path.

## Shared leaderboard
The public Supabase Project URL and publishable key are in config.js. They are intended for browser use. Never add a database password, service-role key or secret key.
Run supabase/schema.sql once in your project's SQL Editor. The script enables row-level security, denies clients direct table access, and exposes only a Top 25 read function and a validated, immutable score-submission function.
Results are self-reported by the browser: this is a casual leaderboard, not a cheat-resistant competition. Database checks and duplicate prevention do not prove a campaign was honestly played. A competitive version would need server-authoritative gameplay and abuse controls.
Names and scores submitted to the leaderboard are public. No email, password or personal account is requested from players.

## Verification
Run `node --test tests/game.test.cjs`. Tests cover quantity validation, cash/cargo limits, cost basis, completed-game protection, score submissions, retries, rendered names and Top 25 handling.

© 2026 IBJ. All rights reserved. Made by IBJ.
