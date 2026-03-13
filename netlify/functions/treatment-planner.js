const path = require('path');
const {
  cors,
  json,
  normalizePayload,
  buildFinalReportMarkdown,
  buildRuleBasedTreatmentPlan,
  loadPromptFiles,
  callOpenRouter,
} = require('./_ceph-core');

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
  const finalReport = body.finalReport || buildFinalReportMarkdown(normalized, body.locale);
  const deterministicPlan = buildRuleBasedTreatmentPlan(normalized);

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return json(200, headers, {
      ok: true,
      mode: 'deterministic',
      text: deterministicPlan,
      finalReport,
      normalized,
      warning: 'OPENROUTER_API_KEY missing, returning deterministic treatment plan only.',
    });
  }

  const bundle = loadPromptFiles(path.join(__dirname, 'prompts', 'treatment_plan'));
  const prompt = [
    'SYSTEM:',
    bundle,
    '',
    'CASE LOCALE:',
    String(body.locale || 'English'),
    '',
    'DETERMINISTIC CEPH REPORT:',
    finalReport,
    '',
    'DETERMINISTIC TREATMENT DRAFT:',
    deterministicPlan,
    '',
    'ADDITIONAL USER INSTRUCTION:',
    String(body.extraInstruction || ''),
  ].join('\n');

  const model = process.env.MODEL_TEXT || 'google/gemma-3-12b-it:free';
  const fallbackModel = process.env.MODEL_TEXT_FALLBACK || 'google/gemma-3-4b-it:free';

  try {
    const ai = await callOpenRouter({
      apiKey,
      model,
      fallbackModel,
      prompt,
      referer: process.env.PUBLIC_APP_URL,
      title: 'Royal Ray Zone Treatment Planner',
    });
    return json(200, headers, {
      ok: true,
      mode: 'ai',
      text: ai.text || deterministicPlan,
      deterministicPlan,
      finalReport,
      normalized,
      model: ai.model,
    });
  } catch (e) {
    return json(200, headers, {
      ok: true,
      mode: 'deterministic_fallback',
      text: deterministicPlan,
      finalReport,
      normalized,
      warning: String(e.message || e),
    });
  }
};
