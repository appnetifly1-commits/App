ROYAL CEPH + NETLIFY FULL PACKAGE
=================================

Contents:
- ceph.html                     -> final integrated file to use in your app/project
- ceph_original_backup.html     -> original backup before integration
- netlify.toml                  -> Netlify config (functions = netlify/functions)
- netlify/functions/*           -> backend functions and prompts
- .env.example                  -> required environment variables example
- ROYAL_CEPH_INTEGRATION.md     -> integration notes

Required functions in this package:
- netlify/functions/ceph-final-report.js
- netlify/functions/treatment-planner.js
- netlify/functions/_ceph-core.js
- netlify/functions/prompts/treatment_plan/*.txt

What the integrated ceph.html now does:
1) Final Report button:
   - keeps the existing cephalometric final report flow inside ceph.html
   - also requests a stronger narrative report from /.netlify/functions/ceph-final-report

2) Treatment Planner button:
   - opens the Treatment Planner panel
   - automatically sends the current ceph analysis/final report to /.netlify/functions/treatment-planner
   - displays the returned treatment planning text in the Treatment Planner panel

Deployment steps:
1. Put all files in your project root.
2. Ensure the folder path is exactly:
     netlify/functions/
3. In Netlify site environment variables, set:
     OPENROUTER_API_KEY
     MODEL_TEXT
     MODEL_TEXT_FALLBACK
     PUBLIC_APP_URL
4. Deploy the site.

Notes:
- The app keeps your existing ceph calculations in the frontend.
- The backend is used only for final narrative reporting and treatment planning.
- If OPENROUTER_API_KEY is missing, the backend returns deterministic fallback text.
