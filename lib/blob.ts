export function getBlobOptions() {
  const token = process.env.BLOB_READ_WRITE_TOKEN || process.env.NOTIF_READ_WRITE_TOKEN;
  const storeId = process.env.BLOB_STORE_ID || process.env.NOTIF_STORE_ID;
  const oidcToken = process.env.VERCEL_OIDC_TOKEN;

  if (token) {
    return { token };
  }

  if (storeId && oidcToken) {
    return { storeId, oidcToken };
  }

  if (storeId) {
    return { storeId };
  }

  return null;
}
