const DEFAULT_OSS_HOST = 'https://qos-pic-temp.oss-cn-beijing.aliyuncs.com';

export async function onRequest({ request, env, params }) {
  const upstreamHost = (env?.OSS_ACCESS_HOST || DEFAULT_OSS_HOST).replace(/\/$/, '');
  const url = new URL(request.url);
  const relative = params?.path ? (Array.isArray(params.path) ? params.path.join('/') : params.path) : url.pathname.replace(/^\/v3/, '') || '';
  const normalizedPath = relative.startsWith('/') ? relative : `/${relative}`;
  const targetUrl = `${upstreamHost}${normalizedPath}${url.search}`;

  const forwardRequest = new Request(targetUrl, request);
  return fetch(forwardRequest);
}

