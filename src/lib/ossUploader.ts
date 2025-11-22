type OssToken = {
  AccessKeyId: string;
  AccessKeySecret: string;
  SecurityToken: string;
  BucketName: string;
  AccessHost: string;
  Expiration: string;
};

type StsResponse = {
  status_code: number;
  message?: string;
  result?: OssToken;
};

export type OssUploadResult = {
  url: string;
  objectName: string;
};

class OssUploader {
  private stsToken: OssToken | null = null;
  private readonly tokenRefreshBuffer = 300;
  private stsEndpoint: string;

  constructor(endpoint = '/oss/sts') {
    this.stsEndpoint = endpoint;
  }

  setEndpoint(endpoint: string) {
    if (!endpoint) {
      this.stsEndpoint = '/oss/sts';
      return;
    }
    this.stsEndpoint = endpoint.replace(/\/$/, '');
  }

  private async requestWithTimeout<T>(input: RequestInfo, init?: RequestInit, timeout = 10000): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(input, { ...init, signal: controller.signal });
      if (!response.ok) {
        throw new Error(`请求失败: ${response.status} ${response.statusText}`);
      }
      return (await response.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  }

  private validateStsToken(token: unknown): token is OssToken {
    if (!token || typeof token !== 'object') return false;
    const requiredFields: Array<keyof OssToken> = ['AccessKeyId', 'AccessKeySecret', 'SecurityToken', 'BucketName', 'AccessHost', 'Expiration'];
    return requiredFields.every((field) => Boolean((token as OssToken)[field]));
  }

  private isTokenExpired(): boolean {
    if (!this.stsToken) return true;
    try {
      const expirationTime = new Date(this.stsToken.Expiration.endsWith('Z') ? this.stsToken.Expiration : `${this.stsToken.Expiration}Z`);
      const remainingSeconds = (expirationTime.getTime() - Date.now()) / 1000;
      return remainingSeconds <= this.tokenRefreshBuffer;
    } catch {
      return true;
    }
  }

  private sanitizeFilename(filename: string): string {
    return filename.replace(/.*[\\/]/, '').replace(/[^a-zA-Z0-9.\-_]/g, '_');
  }

  private buildCanonicalHeaders(headers: Record<string, string>): string {
    return Object.keys(headers)
      .map((key) => key.toLowerCase())
      .sort()
      .map((key) => `${key}:${headers[key]}`)
      .join('\n')
      .concat('\n');
  }

  private generateObjectName(filename: string): string {
    const now = new Date();
    const timestamp = now.toISOString().replace(/[-:T]/g, '').split('.')[0];
    const datePath = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;
    const cleanFilename = this.sanitizeFilename(filename);
    return `${datePath}/${timestamp}_${cleanFilename}`;
  }

  private async hmacSha1(key: string, message: string): Promise<string> {
    const encoder = new TextEncoder();
    const cryptoKey = await crypto.subtle.importKey('raw', encoder.encode(key), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message));
    const bytes = Array.from(new Uint8Array(signature));
    return btoa(String.fromCharCode(...bytes));
  }

  private async generateSignature(params: { method: string; contentMd5: string; contentType: string; date: string; canonicalizedOssHeaders: string; canonicalizedResource: string }) {
    const { method, contentMd5, contentType, date, canonicalizedOssHeaders, canonicalizedResource } = params;
    const stringToSign = `${method}\n${contentMd5}\n${contentType}\n${date}\n${canonicalizedOssHeaders}${canonicalizedResource}`;
    return this.hmacSha1(this.stsToken!.AccessKeySecret, stringToSign);
  }

  private async ensureValidToken() {
    if (!this.isTokenExpired()) return;
    const data = await this.requestWithTimeout<StsResponse>(`${this.stsEndpoint}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Cache-Control': 'no-cache',
      },
    });
    if (data.status_code !== 0 || !this.validateStsToken(data.result)) {
      throw new Error(data.message || '获取STS凭证失败');
    }
    this.stsToken = data.result!;
  }

  async uploadFile(file: File): Promise<OssUploadResult> {
    await this.ensureValidToken();
    if (!this.stsToken) throw new Error('STS凭证无效');

    const objectName = this.generateObjectName(file.name);
    const date = new Date().toUTCString();
    const contentType = file.type || 'application/octet-stream';
    const canonicalizedOssHeaders = this.buildCanonicalHeaders({
      'x-oss-date': date,
      'x-oss-security-token': this.stsToken.SecurityToken,
    });
    const canonicalizedResource = `/${this.stsToken.BucketName}/${objectName}`;
    const signature = await this.generateSignature({
      method: 'PUT',
      contentMd5: '',
      contentType,
      date: '',
      canonicalizedOssHeaders,
      canonicalizedResource,
    });
    const authorization = `OSS ${this.stsToken.AccessKeyId}:${signature}`;
    const uploadUrl = `${this.stsToken.AccessHost}/${objectName}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60000);
    try {
      const response = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': contentType,
          Authorization: authorization,
          'x-oss-date': date,
          'x-oss-security-token': this.stsToken.SecurityToken,
        },
        body: file,
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`OSS上传失败: ${response.status} ${response.statusText}`);
      }
      return { url: uploadUrl, objectName };
    } finally {
      clearTimeout(timer);
    }
  }
}

export const ossUploader = new OssUploader();
