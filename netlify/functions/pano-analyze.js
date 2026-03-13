
const fs = require('fs');
const path = require('path');

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    },
    body: JSON.stringify(body)
  };
}

function readPromptBundle() {
  const dir = path.join(__dirname, 'prompts', 'panorama_report');
  if (!fs.existsSync(dir)) return '';
  return fs.readdirSync(dir)
    .filter((name) => name.endsWith('.txt'))
    .sort()
    .map((name) => fs.readFileSync(path.join(dir, name), 'utf8'))
    .join('\n\n');
}

function buildPendingResponse(payload, env) {
  const missing = [];
  if (!env.segmentationTaskId || env.segmentationTaskId === 'pending') missing.push('SUPERVISELY_SEGMENTATION_TASK_ID');
  if (!env.detectionTaskId1 || env.detectionTaskId1 === 'pending') missing.push('SUPERVISELY_DETECTION_TASK_ID_1');
  if (!env.detectionTaskId2 || env.detectionTaskId2 === 'pending') missing.push('SUPERVISELY_DETECTION_TASK_ID_2');
  if (!env.apiToken) missing.push('SUPERVISELY_API_TOKEN');

  return json(503, {
    ok: false,
    status: 'pending_configuration',
    error: 'Panorama inference is not configured yet.',
    missing,
    expected_env: {
      SUPERVISELY_SEGMENTATION_TASK_ID: env.segmentationTaskId,
      SUPERVISELY_DETECTION_TASK_ID_1: env.detectionTaskId1,
      SUPERVISELY_DETECTION_TASK_ID_2: env.detectionTaskId2,
      SUPERVISELY_API_TOKEN: env.apiToken ? '[set]' : '[missing]',
      MODEL_TEXT: env.modelText
    },
    desired_output_contract: {
      segmentation_image: 'one returned segmentation image',
      full_detection_image: 'one final merged detection image from the two detection projects',
      written_report: 'one professional written report generated from the merged JSON'
    },
    integration_plan: [
      'Send image once to segmentation serving session and receive segmentation image + segmentation JSON.',
      'Send image once to detection serving session 1 and receive partial detection image + JSON.',
      'Send image once to detection serving session 2 and receive partial detection image + JSON.',
      'Merge the two detection JSON payloads into one unified detection result set.',
      'Return only one full detection image to the UI.',
      'Pass the merged segmentation/detection JSON into Gemma/OpenAI report prompts to produce one professional written report.'
    ],
    note: 'Keep the TASK_ID values as pending until the three Supervisely model sessions are available.',
    received_keys: Object.keys(payload || {}),
    prompt_bundle_loaded: Boolean(env.promptBundle)
  });
}

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return json(405, { ok: false, error: 'Method not allowed' });
  }

  let payload = {};
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { ok: false, error: 'Invalid JSON body' });
  }

  const env = {
    segmentationTaskId: process.env.SUPERVISELY_SEGMENTATION_TASK_ID || 'pending',
    detectionTaskId1: process.env.SUPERVISELY_DETECTION_TASK_ID_1 || 'pending',
    detectionTaskId2: process.env.SUPERVISELY_DETECTION_TASK_ID_2 || 'pending',
    apiToken: process.env.SUPERVISELY_API_TOKEN || '',
    modelText: process.env.MODEL_TEXT || 'google/gemma-3-12b-it:free',
    promptBundle: readPromptBundle(),
  };

  const needsPending = [env.segmentationTaskId, env.detectionTaskId1, env.detectionTaskId2].includes('pending') || !env.apiToken;
  if (needsPending) {
    return buildPendingResponse(payload, env);
  }

  return json(501, {
    ok: false,
    status: 'awaiting_live_supervisely_session_mapping',
    error: 'The final live Supervisely session call should be wired after the three serving sessions are available.',
    expected_env: {
      SUPERVISELY_SEGMENTATION_TASK_ID: env.segmentationTaskId,
      SUPERVISELY_DETECTION_TASK_ID_1: env.detectionTaskId1,
      SUPERVISELY_DETECTION_TASK_ID_2: env.detectionTaskId2,
      SUPERVISELY_API_TOKEN: '[set]',
      MODEL_TEXT: env.modelText,
    },
    target_return_shape: {
      segmentation_image: '',
      full_detection_image: '',
      merged_json: {
        segmentation: {},
        detection_project_1: {},
        detection_project_2: {},
        merged_detection_findings: []
      },
      written_report: ''
    }
  });
};
