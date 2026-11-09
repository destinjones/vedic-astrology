---
"@vedic/web": minor
---

Video tutorial and promo: a chaptered video tour of the whole app for astrologers, recorded from the real app with captions, plays on the landing page and inside the app. The app has a Tutorial button (and a Quick switch command) that opens a player with chapter links, a written transcript of each chapter, and the place you stopped. A small "How this works" link follows the section on screen and opens the tour at that chapter; it can be hidden. The landing-page hero has a 40-second muted promo that plays on a loop (not with reduced motion or Save-Data, and it can be paused). Videos are not kept for offline use. `npm run videos` re-records both from a production build (needs ffmpeg).
