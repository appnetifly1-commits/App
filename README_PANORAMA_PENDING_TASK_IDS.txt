
PANORAMA NETLIFY SETUP (PENDING TASK IDs)
=========================================

The project is currently prepared for Supervisely session-based inference.
Until training finishes, keep these Netlify Environment Variables as follows:

SUPERVISELY_SEGMENTATION_TASK_ID=pending
SUPERVISELY_DETECTION_TASK_ID=pending
SUPERVISELY_API_TOKEN=your_supervisely_token
MODEL_TEXT=google/gemma-3-12b-it:free
PUBLIC_APP_URL=https://your-site.netlify.app

What was added:
- netlify/functions/pano-analyze.js
- netlify/functions/prompts/panorama_report/*.txt

Current behavior:
- If either TASK ID is still pending, pano-analyze returns a clear JSON response
  explaining that inference is not configured yet.
- This lets you deploy the project now without breaking ceph functions.

After training finishes:
1) Start a serving app/session for the segmentation model in Supervisely.
2) Copy its Task ID into SUPERVISELY_SEGMENTATION_TASK_ID.
3) Start a serving app/session for the detection model in Supervisely.
4) Copy its Task ID into SUPERVISELY_DETECTION_TASK_ID.
5) Redeploy.
