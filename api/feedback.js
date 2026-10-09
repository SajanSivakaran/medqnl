function env(name) {
  return String(process.env[name] || "").trim().replace(/\/$/, "");
}
function bearer(req) {
  const value = String((req.headers && (req.headers.authorization || req.headers.Authorization)) || "");
  return value.replace(/^Bearer\s+/i, "").trim();
}
async function supabaseFetch(path, options, token) {
  const base = env("SUPABASE_URL");
  const anon = String(process.env.SUPABASE_ANON_KEY || "");
  const headers = Object.assign({
    "Content-Type":"application/json",
    "apikey":anon
  }, options && options.headers ? options.headers : {});
  if (token) headers.Authorization = "Bearer " + token;
  return fetch(base + path, Object.assign({}, options || {}, {headers}));
}
async function requireUser(req, res) {
  const token = bearer(req);
  if (!token) {
    res.status(401).json({error:"Inloggen is vereist."});
    return null;
  }
  const r = await supabaseFetch("/auth/v1/user", {method:"GET"}, token);
  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data || !data.id) {
    res.status(401).json({error:"Sessie is verlopen. Log opnieuw in."});
    return null;
  }
  return data;
}
async function profileFor(user, serviceKey) {
  const r = await supabaseFetch(
    "/rest/v1/profiles?id=eq." + encodeURIComponent(user.id) + "&select=id,email,display_name,role&limit=1",
    {method:"GET", headers:{apikey:serviceKey, Authorization:"Bearer " + serviceKey}},
    ""
  );
  const data = await r.json().catch(() => []);
  return Array.isArray(data) && data[0] ? data[0] : null;
}
module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN || "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    return res.status(204).end();
  }
  if (["GET","POST","PATCH"].indexOf(req.method) < 0) return res.status(405).json({error:"Method not allowed"});
  if (!env("SUPABASE_URL") || !process.env.SUPABASE_ANON_KEY || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({error:"Supabase serverconfiguratie ontbreekt."});
  }
  const user = await requireUser(req, res);
  if (!user) return;
  const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "");
  const profile = await profileFor(user, serviceKey);
  if (!profile) return res.status(403).json({error:"Profiel ontbreekt."});

  try {
    if (req.method === "GET") {
      const admin = profile.role === "admin";
      const query = admin
        ? "/rest/v1/feedback?select=*&order=updated_at.desc"
        : "/rest/v1/feedback?student_id=eq." + encodeURIComponent(user.id) + "&select=*&order=updated_at.desc";
      const r = await supabaseFetch(query, {
        method:"GET",
        headers:{
          apikey:serviceKey,
          Authorization:"Bearer " + serviceKey
        }
      }, "");
      const data = await r.json().catch(() => []);
      if (!r.ok) return res.status(r.status).json({error:(data && data.message) || "Feedback ophalen mislukt."});
      return res.status(200).json({feedback:Array.isArray(data)?data:[]});
    }

    if (req.method === "POST") {
      if (profile.role !== "student") return res.status(403).json({error:"Alleen studenten kunnen feedback indienen."});
      const body = req.body || {};
      const record = {
        student_id:user.id,
        student_email:profile.email || user.email || null,
        student_name:profile.display_name || "Student",
        question_id:String(body.questionId || ""),
        question_title:String(body.questionTitle || ""),
        category:String(body.category || "Overig"),
        message:String(body.message || "").trim(),
        status:"open",
        response:"",
        responded_at:null
      };
      if (!record.message) return res.status(400).json({error:"Feedbackbericht is verplicht."});
      const r = await supabaseFetch("/rest/v1/feedback", {
        method:"POST",
        headers:{
          apikey:serviceKey,
          Authorization:"Bearer " + serviceKey,
          Prefer:"return=representation"
        },
        body:JSON.stringify(record)
      }, "");
      const data = await r.json().catch(() => []);
      if (!r.ok) return res.status(r.status).json({error:(data && data.message) || "Feedback opslaan mislukt."});
      return res.status(201).json({feedback:Array.isArray(data)?data[0]:data});
    }

    const body = req.body || {};
    if (profile.role !== "admin") return res.status(403).json({error:"Alleen admins kunnen feedback beantwoorden of oplossen."});
    const id = String(body.id || "").trim();
    if (!id) return res.status(400).json({error:"Feedback-ID ontbreekt."});
    const patch = {
      response:String(body.response || "").trim(),
      status:body.status === "resolved" ? "resolved" : "open",
      responded_at:new Date().toISOString()
    };
    const r = await supabaseFetch("/rest/v1/feedback?id=eq." + encodeURIComponent(id), {
      method:"PATCH",
      headers:{
        apikey:serviceKey,
        Authorization:"Bearer " + serviceKey,
        Prefer:"return=representation"
      },
      body:JSON.stringify(patch)
    }, "");
    const data = await r.json().catch(() => []);
    if (!r.ok) return res.status(r.status).json({error:(data && data.message) || "Feedback bijwerken mislukt."});
    return res.status(200).json({feedback:Array.isArray(data)?data[0]:data});
  } catch (error) {
    return res.status(502).json({error:"Supabase-aanroep mislukt."});
  }
};