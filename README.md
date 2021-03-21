# Service Worker

Simple service worker featuring precaching of required resources.

Further requests can either:
- prefer the cache and fall back to a network request
- prefer a network fetch, updating the cache with the result for potential offline use
