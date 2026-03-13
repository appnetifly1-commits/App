Royal Panorama Netlify Package — Pending 3 Supervisely Sessions

Current temporary environment variables:
SUPERVISELY_SEGMENTATION_TASK_ID=pending
SUPERVISELY_DETECTION_TASK_ID_1=pending
SUPERVISELY_DETECTION_TASK_ID_2=pending
SUPERVISELY_API_TOKEN=your_token_here
OPENROUTER_API_KEY=your_key_here
MODEL_TEXT=google/gemma-3-12b-it:free

Intended final Supervisely workflow:
1) Segmentation project/session -> returns one segmentation image + segmentation JSON.
2) Detection project/session #1 -> returns part of the abnormalities/lesions + JSON.
3) Detection project/session #2 -> returns the rest of the abnormalities/lesions + JSON.
4) The Netlify function merges the two detection outputs and returns:
   - one segmentation image
   - one final merged detection image
   - one professional written report

Important:
- ceph-related Netlify functions were kept untouched.
- panorama/app.js was added so pano.html has a working frontend bridge.
- shared placeholder files were added to avoid missing-file errors in this package.
