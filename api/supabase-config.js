const SUPABASE_URL = "https://lwgbufaxwfrzqlonhmry.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_CYEpEZ_WZx9OvCT_yrH2Tg_7Oy77IL3";

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN || "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(204).end();
  }
  if (req.method !== "GET") return res.status(405).json({error:"Method not allowed"});
  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN || "*");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  return res.status(200).json({url:SUPABASE_URL,anonKey:SUPABASE_PUBLISHABLE_KEY});
};