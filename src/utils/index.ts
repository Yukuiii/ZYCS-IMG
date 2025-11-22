// URL格式化
const formatURL = (props: any, v: any, key?: string) => {
  const filename = v?._vh_filename || '文件';
  const provider = v?._vh_provider || 'imgur';
  const ERROR_MSG = `${filename} 上传失败`;
  if (provider === 'oss') {
    const ossUrl = v?.data?.link || v?.url;
    if (!ossUrl) return ERROR_MSG;
    return key === 'md' ? `![${filename}](${ossUrl})` : ossUrl;
  }
  let FILE_ID = '';
  try {
    FILE_ID = v?.data?.link?.split('/')?.slice(-1)[0];
  } catch {
    FILE_ID = '';
  }
  if (!FILE_ID) return ERROR_MSG;
  const finalUrl = `${props.nodeHost}/v2/${FILE_ID}`;
  return key === 'md' ? `![${filename}](${finalUrl})` : finalUrl;
};

export { formatURL };
