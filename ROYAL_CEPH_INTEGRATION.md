# Royal Ceph backend structure

## Added endpoints

- `/.netlify/functions/ceph-final-report`
- `/.netlify/functions/treatment-planner`

## Scientific design

1. **Deterministic first**: the backend normalizes cephalometric values and produces a rule-based ceph summary.
2. **AI second**: Gemma/OpenRouter rewrites or expands the deterministic draft, but is instructed not to change numbers.
3. **Fallback safe**: if the AI route fails, the app still gets a usable report/plan.

## Expected POST payload

```json
{
  "locale": "English",
  "patient": {
    "name": "Case 1",
    "age": 16,
    "sex": "F",
    "growthStatus": "possibly still growing"
  },
  "cephJson": {
    "SNA": 82,
    "SNB": 78,
    "ANB": 4,
    "Wits": 3,
    "GoGn-SN": 36,
    "U1-SN": 109,
    "IMPA": 98,
    "Interincisal angle": 118,
    "Lower lip to E-plane": 3
  }
}
```

## Front-end flow in `ceph.html`

### Final Report button

1. Ensure your cephalometric calculations are already complete in the browser.
2. Gather them into one normalized object.
3. Send that object to `/.netlify/functions/ceph-final-report`.
4. Render `data.report` inside your Final Report panel.

### Treatment Planner button

1. Reuse the same ceph object.
2. Optionally also send `finalReport` if already generated.
3. Send to `/.netlify/functions/treatment-planner`.
4. Render `data.text` inside the Treatment Planner panel.

## Example browser calls

```javascript
async function getCephFinalReport(cephJson, patient = {}) {
  const res = await fetch('/.netlify/functions/ceph-final-report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ locale: 'English', patient, cephJson })
  });
  return await res.json();
}

async function getTreatmentPlanner(cephJson, patient = {}, finalReport = '') {
  const res = await fetch('/.netlify/functions/treatment-planner', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ locale: 'English', patient, cephJson, finalReport })
  });
  return await res.json();
}
```

## Recommended front-end organization

Keep **all numeric cephalometric calculations inside `ceph.html`** and let the backend do interpretation/writing only.
That keeps the numbers deterministic and avoids model hallucination.
