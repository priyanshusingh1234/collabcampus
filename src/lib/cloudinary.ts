// Server-side Cloudinary helpers
import { v2 as cloudinary } from "cloudinary";

const CLOUD_NAME = (process.env.CLOUDINARY_CLOUD_NAME || "").trim();
const API_KEY = (process.env.CLOUDINARY_API_KEY || "").trim();
const API_SECRET = (process.env.CLOUDINARY_API_SECRET || "").trim();

// Configure once when this module is loaded (server only)
if (CLOUD_NAME && API_KEY && API_SECRET) {
  cloudinary.config({
    cloud_name: CLOUD_NAME,
    api_key: API_KEY,
    api_secret: API_SECRET,
    secure: true,
  });
}

export function getCloudinaryConfig() {
  return { cloudName: CLOUD_NAME, apiKey: API_KEY, hasSecret: !!API_SECRET };
}

export function signParams(params: Record<string, string | number>) {
  if (!API_SECRET) throw new Error("Cloudinary API secret not configured");
  // cloudinary.utils.api_sign_request expects a plain object with strings/numbers
  // It will sort and build the signature string internally
  const signature = cloudinary.utils.api_sign_request(
    params as Record<string, string>,
    API_SECRET
  );
  return signature;
}

// Helper useful for debugging, mirrors how Cloudinary builds the string-to-sign
export function buildStringToSign(params: Record<string, string | number>) {
  const sortable: Record<string, string> = {};
  Object.keys(params)
    .sort()
    .forEach((k) => {
      const v = params[k];
      if (v === undefined || v === null || v === "") return;
      sortable[k] = String(v);
    });
  return Object.entries(sortable)
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
}
