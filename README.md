# Sonder: provider setup and playback notes

Copy `.env.example` to `.env.local`, fill in credentials, and restart `npm run dev`. Register the exact Spotify and Google callback URLs from the environment file in each developer console. Apple MusicKit uses a developer token signed server-side and a user authorization prompt; it does not use an OAuth redirect URI in this integration.

Playback notices cover YouTube embed-denied and unavailable/private/region-restricted errors, Spotify Premium-required responses, and Apple Music region/storefront or playback failures. When the current track fails, the player marks it unavailable for this run, displays a toast, and advances through the remaining queue entries to the next unfailed track. YouTube's iframe API does not expose a distinct, reliable region-lock error code, so unavailable/private/region-restricted errors share a clear user-facing message.

Provider playback remains subject to each service's account tier, region, licensing, and embed rules. The player does not bypass restrictions.
