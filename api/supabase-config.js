module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN || "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(204).end();
  }
  if (req.method !== "GET") return res.status(405).json({error:"Method not allowed"});
  const url = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const anonKey = String(process.env.SUPABASE_ANON_KEY || "");
  if (!url || !anonKey) {
    return res.status(500).json({error:"SUPABASE_URL en SUPABASE_ANON_KEY ontbreken op de server."});
  }
  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN || "*");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  return res.status(200).json({url, anonKey});
};