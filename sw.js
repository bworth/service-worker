const CACHE_NAME = 'cache-v1.2.1';
const PRECACHE_URLS = ['index.html', './', './?source=pwa'];

function responseFallback(title) {
	return `
		<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" stroke-linejoin="round">
			<title>${ title }</title>
			<path stroke="#ddd" stroke-width="25" d="M199 128L115 272h168z" />
			<path fill="#fff" stroke="#eee" stroke-width="17" d="M199 128L115 272h168z" />
			<g fill="#aaa">
				<path d="M191 180a9 9 0 0118 0l-5 50a4 4 0 01-8 0z" />
				<circle cx="200" cy="248" r="9" />
			</g>
		</svg>
	`;
}

function cacheMatchError(request, cacheName) {
	return new Error(`Unable to find ${ request.url } in ${ cacheName || 'caches' }`);
}

function networkStatusError(request, response) {
	return new Error(`${ request.url } responded with status ${ response.status }`);
}

function networkTimeoutError(request, timeout) {
	return new Error(`${ request.url } timed out after ${ timeout }ms`);
}

function deleteOldCaches(activeCacheNames) {
	return caches.keys()
		.then((cacheNames) => cacheNames.filter((cacheName) => !activeCacheNames.includes(cacheName)))
		.then((oldCacheNames) => Promise.all(oldCacheNames.map((oldCacheName) => caches.delete(oldCacheName))));
}

function fromCache(request, cacheName) {
	return (cacheName ? caches.open(cacheName).then((cache) => cache.match(request)) : caches.match(request))
		.then((cachedResponse) => cachedResponse || Promise.reject(cacheMatchError(request, cacheName)));
}

function fromNetwork(request, timeout) {
	return new Promise((fulfill, reject) => {
		const tid = timeout ? setTimeout(() => reject(networkTimeoutError(request, timeout)), timeout) : undefined;

		fetch(request).then((response) => {
			clearTimeout(tid);

			if (response.status < 500) {
				fulfill(response);
			} else {
				reject(networkStatusError(request, response));
			}
		}, reject);
	});
}

function precache(cacheName, requests) {
	return caches.open(cacheName).then((cache) => cache.addAll(requests));
}

function preferCache(request, cacheName) {
	return fromCache(request, cacheName).catch((error) => {
		console.warn(error);

		return fromNetwork(request).catch((error) => {
			console.warn(error);

			return useFallback('Network error');
		});
	});
}

// eslint-disable-next-line no-unused-vars
function preferNetwork(request, cacheName, timeout) {
	return fromNetwork(request, timeout)
		.then((response) => updateCache(cacheName, request, response))
		.catch((error) => {
			console.warn(error);

			return fromCache(request, cacheName).catch((error) => {
				console.warn(error);

				return useFallback('Cache match error');
			});
		});
}

function updateCache(cacheName, request, response) {
	if (response.ok) {
		return caches.open(cacheName).then((cache) => {
			cache.put(request, response.clone());
			return response;
		});
	} else {
		return response;
	}
}

function useFallback(title) {
	return new Response(responseFallback(title), { headers: { 'Content-Type': 'image/svg+xml' } });
}

self.addEventListener('install', (event) => {
	const requests = PRECACHE_URLS.map((url) => new Request(url, { cache: 'reload' }));

	self.skipWaiting();
	event.waitUntil(precache(CACHE_NAME, requests));
});

self.addEventListener('activate', (event) => {
	const activeCacheNames = [CACHE_NAME];

	event.waitUntil(self.clients.claim().then(() => deleteOldCaches(activeCacheNames)));
});

self.addEventListener('fetch', (event) => {
	const { request } = event;

	if (request.method === 'GET') {
		event.respondWith(preferCache(request, CACHE_NAME));
		event.waitUntil(caches.open(CACHE_NAME)
			.then((cache) => cache.add(request))
			.catch(() => console.warn)
		);
	}
});
