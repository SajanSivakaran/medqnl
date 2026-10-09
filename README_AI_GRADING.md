# AI-nakijken voor open Qbank-vragen

De Qbank ondersteunt open vragen met een modelantwoord, rubric en automatische puntenverdeling.

## Backend

De serverfunctie staat in `api/grade-open.js` en gebruikt de OpenAI Responses API. De API-key staat uitsluitend server-side.

Benodigde environment variable:

`OPENAI_API_KEY`

Optioneel:

`OPENAI_MODEL` (standaard `gpt-6-luna`)

Voor eenzelfde-origin deployment op Vercel is het endpoint:

`/api/grade-open`

De frontend verstuurt uitsluitend:
- de vraag
- het modelantwoord
- de rubric
- het maximum aantal punten
- het studentantwoord

De server geeft `points`, `feedback` en `missing` terug en begrenst de score tot het maximum.

## Deploy

Deploy de repository op een platform dat Node/Vercel serverless functies ondersteunt. Stel daar `OPENAI_API_KEY` in. Bij gebruik van de statische GitHub Pages-versie moet in MedQNL bij Instellingen het URL van de gedeployde `/api/grade-open` endpoint worden ingevuld.

Gebruik geen patiëntidentificeerbare gegevens in open antwoorden.
