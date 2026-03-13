const { cors, json, normalizePayload, buildFinalReportMarkdown, callOpenRouter } = require('./_ceph-core');

exports.handler = async (event) => {
  const headers = cors(event.headers?.origin);
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return json(405, headers, { ok: false, error: 'Method Not Allowed' });

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return json(400, headers, { ok: false, error: 'Invalid JSON' });
  }

  const normalized = normalizePayload(body);
  const deterministic = buildFinalReportMarkdown(normalized, body.locale);

  if (body.polishWithAI === false) {
    return json(200, headers, { ok: true, mode: 'deterministic', report: deterministic, normalized });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return json(200, headers, {
      ok: true,
      mode: 'deterministic',
      report: deterministic,
      normalized,
      warning: 'OPENROUTER_API_KEY missing, returning deterministic report only.',
    });
  }

  const model = process.env.MODEL_TEXT || 'google/gemma-3-12b-it:free';
  const fallbackModel = process.env.MODEL_TEXT_FALLBACK || 'google/gemma-3-4b-it:free';
  const prompt = [
    'SYSTEM:',
    'You are a senior orthodontic reporting assistant.',
    'Rewrite the provided deterministic cephalometric report into cleaner, stronger clinical English or Arabic according to the requested locale.',
    'Do not change any numeric value. Do not invent any measurement. Preserve all scientific cautions.',
    '',
    'USER LOCALE:',
    String(body.locale || 'English'),
    '',
    'BASE REPORT:',
    deterministic,
  ].join('\n');

  try {
    const ai = await callOpenRouter({
      apiKey,
      model,
      fallbackModel,
      prompt,
      referer: process.env.PUBLIC_APP_URL,
      title: 'Royal Ray Zone Ceph Final Report',
    });
    return json(200, headers, { ok: true, mode: 'ai_polished', report: ai.text || deterministic, deterministic, normalized, model: ai.model });
  } catch (e) {
    return json(200, headers, {
      ok: true,
      mode: 'deterministic_fallback',
      report: deterministic,
      normalized,
      warning: String(e.message || e),
    });
  }
};
