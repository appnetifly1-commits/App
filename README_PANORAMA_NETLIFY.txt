Royal Ray Zone Panorama — Netlify/Supervisely integration

Required Netlify environment variables:
SUPERVISELY_SEGMENTATION_URL=...
SUPERVISELY_DETECTION_URL=...
SUPERVISELY_API_TOKEN=...   (optional if your endpoints are already public)
SUPERVISELY_SEGMENTATION_MODE=auto   (or infer / analyze)
SUPERVISELY_DETECTION_MODE=auto      (or infer / analyze)
OPENROUTER_API_KEY=...
MODEL_TEXT=google/gemma-3-12b-it:free
PUBLIC_APP_URL=https://your-site.netlify.app

New function added:
netlify/functions/pano-analyze.js

This function:
1) receives panorama image from pano.html
2) sends it to segmentation endpoint
3) sends it to detection endpoint
4) returns one segmentation image and one detection image
5) converts returned JSON into a polished written report via Gemma/OpenRouter

Ceph functions were left intact.
