import { createHmac, timingSafeEqual } from "node:crypto";

// After an application is saved, its documents are uploaded one by one (each request stays
// under the hosting limit). A short-lived signed token proves the uploader is the person
// who just submitted that application.

const TOKEN_SECONDS = 60 * 60;

function sign(secret: string, id: number, expires: number): string {
  return createHmac("sha256", secret)
    .update(`admission-upload:${id}:${expires}`)
    .digest("base64url");
}

export function createUploadToken(
  secret: string,
  applicationId: number,
  nowSeconds = Math.floor(Date.now() / 1000),
): string {
  const expires = nowSeconds + TOKEN_SECONDS;
  return `${applicationId}.${expires}.${sign(secret, applicationId, expires)}`;
}

/** The application id when the token is genuine and not expired; otherwise null. */
export function verifyUploadToken(
  secret: string,
  token: unknown,
  nowSeconds = Math.floor(Date.now() / 1000),
): number | null {
  if (typeof token !== "string") return null;
  const m = /^([1-9][0-9]{0,15})\.([0-9]{1,12})\.([A-Za-z0-9_-]{43})$/.exec(
    token,
  );
  if (!m) return null;
  const id = Number(m[1]);
  const expires = Number(m[2]);
  if (expires < nowSeconds) return null;
  const expected = Buffer.from(sign(secret, id, expires));
  const given = Buffer.from(m[3]!);
  return expected.length === given.length && timingSafeEqual(expected, given)
    ? id
    : null;
}
