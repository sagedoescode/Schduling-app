import type { VercelRequest, VercelResponse } from "@vercel/node";

const CLIENT_ID = process.env.VITE_GOOGLE_CLIENT_ID!;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const TOKEN_URL = "https://oauth2.googleapis.com/token";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { action, code, refreshToken, redirectUri } = req.body || {};

  if (action === "exchange" && code && redirectUri) {
    // Exchange authorization code for access + refresh tokens
    const resp = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    const data = await resp.json();
    if (!resp.ok) return res.status(400).json({ error: data.error_description || data.error });
    return res.json({
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    });
  }

  if (action === "refresh" && refreshToken) {
    // Use refresh token to get a new access token
    const resp = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: "refresh_token",
      }),
    });
    const data = await resp.json();
    if (!resp.ok) return res.status(400).json({ error: data.error_description || data.error });
    return res.json({
      accessToken: data.access_token,
      expiresIn: data.expires_in,
    });
  }

  return res.status(400).json({ error: "Invalid action. Use 'exchange' or 'refresh'." });
}
