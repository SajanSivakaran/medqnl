module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN || "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(204).end();
  }
  if (req.method !== "POST") return res.status(405).json({error:"Method not allowed"});

  const origin = process.env.ALLOWED_ORIGIN || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({error:"OPENAI_API_KEY ontbreekt op de server."});
  }

  const body = req.body || {};
  const question = String(body.question || "").trim();
  const modelAnswer = String(body.modelAnswer || "").trim();
  const studentAnswer = String(body.studentAnswer || "").trim();
  const points = Number(body.points);
  const rubric = Array.isArray(body.rubric)
    ? body.rubric.map(function (x) { return String(x).trim(); }).filter(Boolean)
    : [];

  if (!question || !modelAnswer || !studentAnswer) {
    return res.status(400).json({error:"Vraag, modelantwoord en studentantwoord zijn verplicht."});
  }
  if (!Number.isFinite(points) || points <= 0 || points > 20) {
    return res.status(400).json({error:"Ongeldig maximum aantal punten."});
  }

  const rubricText = rubric.length ? rubric.map(function (x, i) {
    return (i + 1) + ". " + x;
  }).join("\n") : "Gebruik het modelantwoord als leidraad en verdeel de punten evenredig over de expliciet benoemde onderdelen.";

  const instructions = [
    "Je bent een beoordelaar van medische tentamenvragen.",
    "Beoordeel uitsluitend op inhoudelijke juistheid ten opzichte van de vraag, het modelantwoord en de rubric.",
    "Geef equivalente correcte formuleringen en synoniemen dezelfde punten.",
    "Geef geen punten voor informatie die niet in de rubric of het modelantwoord wordt ondersteund.",
    "Geef nooit meer punten dan het maximum.",
    "Spelling, stijl en taalniveau tellen alleen mee als ze de medische betekenis onbegrijpelijk maken.",
    "Bij twijfel kies de lagere score en benoem wat ontbreekt.",
    "Geef uitsluitend JSON zonder markdown: {points:number,feedback:string,missing:string[]}"
  ].join("\n");

  const input = [
    "VRAAG:\n" + question,
    "MODELANTWOORD:\n" + modelAnswer,
    "RUBRIC:\n" + rubricText,
    "MAXIMUM PUNTEN: " + points,
    "STUDENTANTWOORD:\n" + studentAnswer
  ].join("\n\n");

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + process.env.OPENAI_API_KEY
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-6-luna",
        instructions,
        input,
        store: false
      })
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({
        error: data && data.error && data.error.message
          ? data.error.message
          : "OpenAI API fout."
      });
    }

    const raw = typeof data.output_text === "string" ? data.output_text.trim() : "";
    let grade;
    try {
      grade = JSON.parse(raw);
    } catch (e) {
      const match = raw.match(/\{[\s\S]*\}/);
      grade = match ? JSON.parse(match[0]) : null;
    }

    if (!grade || typeof grade.points === "undefined") {
      return res.status(502).json({error:"AI gaf geen geldige beoordelingsstructuur terug."});
    }

    const awarded = Math.max(0, Math.min(points, Number(grade.points) || 0));
    return res.status(200).json({
      points: awarded,
      feedback: String(grade.feedback || ""),
      missing: Array.isArray(grade.missing)
        ? grade.missing.map(function (x) { return String(x); })
        : []
    });
  } catch (error) {
    return res.status(502).json({error:"AI-beoordeling kon niet worden uitgevoerd."});
  }
};
