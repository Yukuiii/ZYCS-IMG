const DEFAULT_OSS_HOST = 'https://qos-pic-temp.oss-cn-beijing.aliyuncs.com';

export async function onRequest({ request, env }) {
  const upstreamHost = (env?.OSS_ACCESS_HOST || DEFAULT_OSS_HOST).replace(/\/$/, '');
  const url = new URL(request.url);
  const relativePath = url.pathname.replace(/^\/v3/, '') || '/';
  const targetPath = relativePath.startsWith('/') ? relativePath : `/${relativePath}`;
  const targetUrl = `${upstreamHost}${targetPath}${url.search}`;

  const forwardRequest = new Request(targetUrl, request);
  return fetch(forwardRequest);
}
