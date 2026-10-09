# AI-nakijken voor MedQNL

De Qbank stuurt open antwoorden naar `/api/grade-open`.

Benodigde servervariabelen:
- `OPENAI_API_KEY`: jouw eigen OpenAI API-key
- `OPENAI_MODEL`: optioneel; standaard `gpt-6-luna`
- `ALLOWED_ORIGIN`: optioneel; de origin van je website

De sleutel staat niet in `index.html`, localStorage of de repository.

De endpoint gebruikt de OpenAI Responses API en vraagt een score, korte feedback en ontbrekende beoordelingspunten terug. De server begrenst de score op het maximale aantal punten van de vraag.

Voor een statische GitHub Pages-hosting werkt `/api/grade-open` niet zelfstandig; deze functie moet op een backend/serverless platform worden uitgevoerd, bijvoorbeeld Vercel.
