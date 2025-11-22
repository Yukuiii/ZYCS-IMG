const STS_URL = 'https://www.qiqucn.com/oss/get_sts?reset=1&type=image';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const jsonResponse = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });

const sanitizeFilename = (name = 'upload.bin') => name.replace(/.*[\\/]/, '').replace(/[^a-zA-Z0-9.\-_]/g, '_');

const generateObjectName = (filename) => {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[-:T]/g, '').split('.')[0];
  const datePath = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;
  return `${datePath}/${timestamp}_${sanitizeFilename(filename)}`;
};

const buildCanonicalHeaders = (headers) =>
  Object.keys(headers)
    .map((key) => key.toLowerCase())
    .sort()
    .map((key) => `${key}:${headers[key]}`)
    .join('\n')
    .concat('\n');

const hmacSha1 = async (key, message) => {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey('raw', encoder.encode(key), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message));
  const bytes = new Uint8Array(signature);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
};

const buildSignature = async ({ token, method, contentType, date, canonicalHeaders, resource }) => {
  const stringToSign = `${method}\n\n${contentType}\n${date}\n${canonicalHeaders}${resource}`;
  return hmacSha1(token.AccessKeySecret, stringToSign);
};

const fetchStsToken = async () => {
  const response = await fetch(STS_URL, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'Cache-Control': 'no-cache',
    },
  });
  if (!response.ok) throw new Error(`STS获取失败: ${response.status} ${response.statusText}`);
  const data = await response.json();
  if (data.status_code !== 0 || !data.result) throw new Error(data.message || 'STS响应异常');
  return data.result;
};

export async function onRequest({ request }) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (request.method !== 'POST') {
    return jsonResponse({ status_code: -1, message: 'Method Not Allowed' }, 405);
  }

  const formData = await request.formData();
  const file = formData.get('file');
  if (!file || typeof file === 'string') {
    return jsonResponse({ status_code: -1, message: '缺少文件' }, 400);
  }

  try {
    const token = await fetchStsToken();
    const objectName = generateObjectName(file.name || 'upload.bin');
    const uploadUrl = `${token.AccessHost}/${objectName}`;
    const date = new Date().toUTCString();
    const contentType = file.type || 'application/octet-stream';
    const canonicalHeaders = buildCanonicalHeaders({
      'x-oss-security-token': token.SecurityToken,
    });
    const resource = `/${token.BucketName}/${objectName}`;
    const signature = await buildSignature({
      token,
      method: 'PUT',
      contentType,
      date,
      canonicalHeaders,
      resource,
    });
    const authorization = `OSS ${token.AccessKeyId}:${signature}`;

    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
        Date: date,
        'x-oss-security-token': token.SecurityToken,
        Authorization: authorization,
      },
      body: file.stream(),
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      return jsonResponse(
        {
          status_code: uploadResponse.status,
          message: `OSS上传失败: ${errorText}`,
        },
        uploadResponse.status,
      );
    }

    return jsonResponse({
      success: true,
      data: {
        link: uploadUrl,
        objectName,
      },
    });
  } catch (error) {
    return jsonResponse(
      {
        status_code: -1,
        message: error?.message || '上传失败',
      },
      500,
    );
  }
}
