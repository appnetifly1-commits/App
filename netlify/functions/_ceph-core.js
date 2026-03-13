const fs = require('fs');
const path = require('path');

function cors(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

function json(statusCode, headers, payload) {
  return {
    statusCode,
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  };
}

function normalizeKey(key) {
  return String(key || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function flattenObject(obj, prefix = '', out = {}) {
  if (obj == null) return out;
  if (Array.isArray(obj)) {
    obj.forEach((v, i) => flattenObject(v, `${prefix}${prefix ? '_' : ''}${i}`, out));
    return out;
  }
  if (typeof obj !== 'object') {
    out[prefix] = obj;
    return out;
  }
  for (const [k, v] of Object.entries(obj)) {
    const next = `${prefix}${prefix ? '_' : ''}${k}`;
    if (v && typeof v === 'object' && !Array.isArray(v)) flattenObject(v, next, out);
    else out[next] = v;
  }
  return out;
}

function toNumber(v) {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const m = v.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
    if (m) return Number(m[0]);
  }
  return null;
}

function pickNumber(flat, aliases) {
  const normalized = Object.entries(flat).map(([k, v]) => [normalizeKey(k), v]);
  for (const alias of aliases) {
    const a = normalizeKey(alias);
    const exact = normalized.find(([k]) => k === a);
    if (exact) {
      const n = toNumber(exact[1]);
      if (n != null) return n;
    }
  }
  for (const alias of aliases) {
    const a = normalizeKey(alias);
    const partial = normalized.find(([k]) => k.includes(a));
    if (partial) {
      const n = toNumber(partial[1]);
      if (n != null) return n;
    }
  }
  return null;
}

function inferLanguage(locale) {
  const s = String(locale || '').toLowerCase();
  if (s.includes('ar')) return 'ar';
  return 'en';
}

function loadPromptFiles(dirAbs) {
  if (!fs.existsSync(dirAbs)) return '';
  const files = fs.readdirSync(dirAbs).filter(f => f.endsWith('.txt')).sort();
  return files.map(f => fs.readFileSync(path.join(dirAbs, f), 'utf8').trim()).filter(Boolean).join('\n\n');
}

function normalizePayload(body) {
  const primary = body.cephJson || body.analysis || body.measurements || body.payload || body || {};
  const flat = flattenObject(primary);

  const m = {
    sna: pickNumber(flat, ['SNA']),
    snb: pickNumber(flat, ['SNB']),
    anb: pickNumber(flat, ['ANB']),
    wits: pickNumber(flat, ['Wits', 'WitsAppraisal']),
    sn_mp: pickNumber(flat, ['SN_MP', 'SN-MP', 'GoGn-SN', 'GoGnSN', 'SN mandibular plane', 'SN to mandibular plane']),
    fma: pickNumber(flat, ['FMA', 'Frankfort mandibular plane angle']),
    y_axis: pickNumber(flat, ['Y-axis', 'Y_axis', 'Yaxis']),
    facial_axis: pickNumber(flat, ['Facial axis', 'FacialAxis']),
    convexity: pickNumber(flat, ['Angle of convexity', 'Convexity', 'NAPog', 'N-A-Pog']),
    occlusal_cant: pickNumber(flat, ['Cant of occlusal plane', 'Cant of occlussal plane', 'Occlusal plane cant']),
    u1_sn: pickNumber(flat, ['U1-SN', 'U1_SN', 'Upper incisor to SN', 'UI-SN']),
    u1_na_deg: pickNumber(flat, ['U1-NA', 'U1_NA', 'U1 to NA deg', 'Upper incisor to NA degree']),
    u1_na_mm: pickNumber(flat, ['U1-NA mm', 'U1_NA_mm', 'Upper incisor to NA mm']),
    impa: pickNumber(flat, ['IMPA', 'L1-MP', 'L1_MP', 'Lower incisor to mandibular plane']),
    l1_nb_deg: pickNumber(flat, ['L1-NB', 'L1_NB', 'L1 to NB deg', 'Lower incisor to NB degree']),
    l1_nb_mm: pickNumber(flat, ['L1-NB mm', 'L1_NB_mm', 'Lower incisor to NB mm']),
    interincisal: pickNumber(flat, ['Interincisal', 'Interincisal angle']),
    fmia: pickNumber(flat, ['FMIA']),
    jarabak: pickNumber(flat, ['Jarabak ratio', 'Jarabak', 'Facial height index', 'FHI']),
    gonial: pickNumber(flat, ['Gonial angle', 'Gonial']),
    overjet: pickNumber(flat, ['Overjet']),
    overbite: pickNumber(flat, ['Overbite']),
    upper_lip_e: pickNumber(flat, ['Upper lip to E-plane', 'UpperLipToEPlane', 'UL to E']),
    lower_lip_e: pickNumber(flat, ['Lower lip to E-plane', 'LowerLipToEPlane', 'LL to E']),
    nasolabial: pickNumber(flat, ['Nasolabial angle', 'Nasolabial']),
    age: toNumber(body?.patient?.age) ?? pickNumber(flat, ['Age']),
  };

  const patient = {
    name: body?.patient?.name || body?.meta?.patientName || '',
    age: m.age,
    sex: body?.patient?.sex || '',
    growthStatus: body?.patient?.growthStatus || body?.meta?.growthStatus || '',
  };

  const summary = classifyMeasurements(m, patient);
  return { raw: primary, flat, measurements: m, patient, summary };
}

function classifyMeasurements(m, patient) {
  const notes = [];
  let sagittal = 'undetermined';
  let sagittalBasis = [];

  if (m.anb != null) {
    sagittalBasis.push(`ANB ${fmt(m.anb)}°`);
    if (m.anb < 0) sagittal = 'skeletal Class III tendency';
    else if (m.anb > 4) sagittal = 'skeletal Class II tendency';
    else sagittal = 'skeletal Class I tendency';
  }
  if (m.wits != null) {
    sagittalBasis.push(`Wits ${fmt(m.wits)} mm`);
    if (sagittal === 'undetermined') {
      if (m.wits < -2) sagittal = 'skeletal Class III tendency';
      else if (m.wits > 2) sagittal = 'skeletal Class II tendency';
      else sagittal = 'skeletal Class I tendency';
    }
  }

  let vertical = 'undetermined';
  let verticalBasis = [];
  if (m.sn_mp != null) {
    verticalBasis.push(`SN-MP/GoGn-SN ${fmt(m.sn_mp)}°`);
    if (m.sn_mp > 37) vertical = 'hyperdivergent tendency';
    else if (m.sn_mp < 28) vertical = 'hypodivergent tendency';
    else vertical = 'average vertical pattern';
  } else if (m.fma != null) {
    verticalBasis.push(`FMA ${fmt(m.fma)}°`);
    if (m.fma > 30) vertical = 'hyperdivergent tendency';
    else if (m.fma < 22) vertical = 'hypodivergent tendency';
    else vertical = 'average vertical pattern';
  }
  if (m.jarabak != null) {
    verticalBasis.push(`Jarabak ratio ${fmt(m.jarabak)}%`);
    if (m.jarabak < 59) notes.push('Jarabak ratio supports a long-face / clockwise growth tendency.');
    else if (m.jarabak > 65) notes.push('Jarabak ratio supports a short-face / counter-clockwise growth tendency.');
  }

  let upperInc = 'undetermined';
  if (m.u1_sn != null) {
    if (m.u1_sn > 106) upperInc = 'upper incisors proclined';
    else if (m.u1_sn < 100) upperInc = 'upper incisors relatively retroclined';
    else upperInc = 'upper incisor inclination near conventional norm';
  } else if (m.u1_na_deg != null) {
    if (m.u1_na_deg > 24) upperInc = 'upper incisors proclined';
    else if (m.u1_na_deg < 18) upperInc = 'upper incisors relatively retroclined';
    else upperInc = 'upper incisor inclination near conventional norm';
  }

  let lowerInc = 'undetermined';
  if (m.impa != null) {
    if (m.impa > 95) lowerInc = 'lower incisors proclined';
    else if (m.impa < 85) lowerInc = 'lower incisors relatively retroclined';
    else lowerInc = 'lower incisor inclination near conventional norm';
  } else if (m.l1_nb_deg != null) {
    if (m.l1_nb_deg > 28) lowerInc = 'lower incisors proclined';
    else if (m.l1_nb_deg < 20) lowerInc = 'lower incisors relatively retroclined';
    else lowerInc = 'lower incisor inclination near conventional norm';
  }

  let softTissue = [];
  if (m.lower_lip_e != null) {
    if (m.lower_lip_e > 2) softTissue.push('lower lip appears protrusive to E-plane');
    else if (m.lower_lip_e < -2) softTissue.push('lower lip appears retrusive to E-plane');
  }
  if (m.upper_lip_e != null) {
    if (m.upper_lip_e > -2) softTissue.push('upper lip appears relatively full/protrusive to E-plane');
    else if (m.upper_lip_e < -6) softTissue.push('upper lip appears retrusive to E-plane');
  }
  if (m.nasolabial != null) {
    if (m.nasolabial < 95) softTissue.push('nasolabial angle is relatively acute');
    else if (m.nasolabial > 115) softTissue.push('nasolabial angle is relatively obtuse');
  }

  const growthStatus = String(patient.growthStatus || '').trim() || inferGrowthStatus(patient.age);

  if (m.convexity != null) {
    notes.push('Angle of convexity interpretation may depend on the sign convention used by the software; keep the displayed numeric value unchanged and interpret against the app convention.');
  }
  if (m.anb != null) {
    notes.push('ANB should be interpreted alongside Wits and clinical findings, especially when jaw rotations or landmark position may distort ANB alone.');
  }

  return {
    sagittal,
    sagittalBasis,
    vertical,
    verticalBasis,
    upperInc,
    lowerInc,
    softTissue,
    growthStatus,
    notes,
  };
}

function inferGrowthStatus(age) {
  if (age == null || !Number.isFinite(age)) return 'not stated';
  if (age < 12) return 'likely growing';
  if (age < 16) return 'possibly still growing';
  if (age < 18) return 'late adolescent / growth may be limited';
  return 'likely nongrowing';
}

function fmt(n) {
  return Number(n).toFixed(Math.abs(n) >= 10 ? 1 : 2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
}

function buildMeasurementDigest(m) {
  const rows = [];
  const push = (label, value, unit = '') => { if (value != null) rows.push(`- **${label}:** ${fmt(value)}${unit}`); };
  push('SNA', m.sna, '°');
  push('SNB', m.snb, '°');
  push('ANB', m.anb, '°');
  push('Wits appraisal', m.wits, ' mm');
  push('SN-MP / GoGn-SN', m.sn_mp, '°');
  push('FMA', m.fma, '°');
  push('U1-SN', m.u1_sn, '°');
  push('U1-NA', m.u1_na_deg, '°');
  push('U1-NA', m.u1_na_mm, ' mm');
  push('IMPA', m.impa, '°');
  push('L1-NB', m.l1_nb_deg, '°');
  push('L1-NB', m.l1_nb_mm, ' mm');
  push('Interincisal angle', m.interincisal, '°');
  push('FMIA', m.fmia, '°');
  push('Jarabak ratio', m.jarabak, '%');
  push('Angle of convexity', m.convexity, '°');
  push('Cant of occlusal plane', m.occlusal_cant, '°');
  push('Overjet', m.overjet, ' mm');
  push('Overbite', m.overbite, ' mm');
  push('Upper lip to E-plane', m.upper_lip_e, ' mm');
  push('Lower lip to E-plane', m.lower_lip_e, ' mm');
  push('Nasolabial angle', m.nasolabial, '°');
  return rows.join('\n');
}

function buildFinalReportMarkdown(normalized, locale = 'en') {
  const { patient, measurements: m, summary: s } = normalized;
  const nameLine = patient.name ? `**Patient:** ${patient.name}` : '**Patient:** Unnamed case';
  const ageBits = [];
  if (patient.age != null) ageBits.push(`Age ${patient.age}`);
  if (patient.sex) ageBits.push(patient.sex);
  if (s.growthStatus) ageBits.push(`Growth status: ${s.growthStatus}`);

  const steiner = [];
  if (m.sna != null || m.snb != null || m.anb != null || m.u1_na_deg != null || m.l1_nb_deg != null || m.u1_sn != null || m.impa != null) {
    if (m.sna != null) steiner.push(`SNA suggests ${m.sna > 84 ? 'maxillary prognathic tendency' : m.sna < 80 ? 'maxillary retrusive tendency' : 'maxillary position near conventional norm'}.`);
    if (m.snb != null) steiner.push(`SNB suggests ${m.snb > 82 ? 'mandibular prognathic tendency' : m.snb < 78 ? 'mandibular retrusive tendency' : 'mandibular position near conventional norm'}.`);
    if (m.anb != null) steiner.push(`ANB supports ${s.sagittal}.`);
    if (m.u1_na_deg != null || m.u1_sn != null) steiner.push(`Upper incisor assessment: ${s.upperInc}.`);
    if (m.l1_nb_deg != null || m.impa != null) steiner.push(`Lower incisor assessment: ${s.lowerInc}.`);
  }

  const downs = [];
  if (m.y_axis != null) downs.push(`Y-axis = ${fmt(m.y_axis)}°, interpreted in conjunction with vertical pattern.`);
  if (m.facial_axis != null) downs.push(`Facial axis = ${fmt(m.facial_axis)}°, useful for growth direction appraisal.`);
  if (m.convexity != null) downs.push('Angle of convexity reported as displayed; interpretation depends on the sign convention adopted by the software.');
  if (m.occlusal_cant != null) downs.push(`Occlusal plane cant = ${fmt(m.occlusal_cant)}°.`);

  const tweed = [];
  if (m.fma != null) tweed.push(`FMA = ${fmt(m.fma)}°, consistent with ${s.vertical}.`);
  if (m.impa != null) tweed.push(`IMPA = ${fmt(m.impa)}°, indicating ${s.lowerInc}.`);
  if (m.fmia != null) tweed.push(`FMIA = ${fmt(m.fmia)}°.`);

  const jarabak = [];
  if (m.jarabak != null) jarabak.push(`Jarabak ratio = ${fmt(m.jarabak)}%.`);
  if (m.gonial != null) jarabak.push(`Gonial angle = ${fmt(m.gonial)}°.`);
  if (s.vertical !== 'undetermined') jarabak.push(`Overall Jarabak/vertical impression: ${s.vertical}.`);

  const eastman = [];
  if (m.wits != null) eastman.push(`Wits appraisal supports ${s.sagittal}.`);
  if (m.overjet != null) eastman.push(`Overjet = ${fmt(m.overjet)} mm.`);
  if (m.overbite != null) eastman.push(`Overbite = ${fmt(m.overbite)} mm.`);
  if (m.upper_lip_e != null || m.lower_lip_e != null || m.nasolabial != null) {
    eastman.push(s.softTissue.length ? `Soft tissue profile: ${s.softTissue.join('; ')}.` : 'Soft tissue values are available and should be correlated with profile photographs and smile analysis.');
  }

  const integrated = [];
  if (s.sagittal !== 'undetermined') integrated.push(`Sagittal skeletal impression: **${s.sagittal}** (${s.sagittalBasis.join(', ')}).`);
  if (s.vertical !== 'undetermined') integrated.push(`Vertical skeletal impression: **${s.vertical}** (${s.verticalBasis.join(', ')}).`);
  if (s.upperInc !== 'undetermined') integrated.push(`Upper incisor position: **${s.upperInc}**.`);
  if (s.lowerInc !== 'undetermined') integrated.push(`Lower incisor position: **${s.lowerInc}**.`);
  if (s.softTissue.length) integrated.push(`Soft tissue impression: ${s.softTissue.join('; ')}.`);
  integrated.push('This cephalometric synthesis should be integrated with clinical examination, study casts/digital models, photographs, periodontal status, crowding/space analysis, and TMJ/airway considerations before a definitive treatment plan is chosen.');

  return [
    '# Final Cephalometric Report',
    nameLine,
    ageBits.length ? `**Case context:** ${ageBits.join(' | ')}` : '',
    '',
    '## Consolidated Measurement Digest',
    buildMeasurementDigest(m) || '- No numeric cephalometric values were found in the payload.',
    '',
    steiner.length ? ['## Steiner Analysis', ...steiner.map(x => `- ${x}`)].join('\n') : '',
    '',
    downs.length ? ['## Downs Analysis', ...downs.map(x => `- ${x}`)].join('\n') : '',
    '',
    tweed.length ? ['## Tweed Analysis', ...tweed.map(x => `- ${x}`)].join('\n') : '',
    '',
    jarabak.length ? ['## Jarabak Analysis', ...jarabak.map(x => `- ${x}`)].join('\n') : '',
    '',
    eastman.length ? ['## Eastman Analysis', ...eastman.map(x => `- ${x}`)].join('\n') : '',
    '',
    '## Integrated Final Report',
    ...integrated.map(x => `- ${x}`),
    '',
    '## Notes / Cautions',
    ...s.notes.map(x => `- ${x}`),
  ].filter(Boolean).join('\n');
}

function buildRuleBasedTreatmentPlan(normalized) {
  const { patient, measurements: m, summary: s } = normalized;
  const lines = [];
  const objectives = [];
  const plan = [];
  const alternatives = [];
  const checks = [];

  objectives.push('Confirm the chief complaint, facial esthetic priorities, and smile goals.');
  objectives.push('Achieve stable occlusion with controlled incisor position and periodontal safety.');
  if (s.sagittal !== 'undetermined') objectives.push(`Address the underlying ${s.sagittal.toLowerCase()}.`);
  if (s.vertical !== 'undetermined') objectives.push(`Maintain or improve ${s.vertical.replace(' tendency', '')} control.`);

  const growth = s.growthStatus.toLowerCase();

  if (s.sagittal.includes('Class II')) {
    if (growth.includes('growing') || growth.includes('possibly')) {
      plan.push('Primary pathway: growth-modification oriented Class II correction if the clinical exam confirms a growing patient and mandibular retrusion pattern.');
      plan.push('Consider functional/Class II orthopedic mechanics or headgear-based mechanics according to the actual maxillary-vs-mandibular etiology and patient compliance.');
      plan.push('Delay irreversible extraction decisions until growth response, arch length analysis, and soft-tissue impact are reviewed.');
    } else {
      plan.push('Primary adult/nongrowing pathway: camouflage orthodontics versus combined orthodontic-surgical approach according to severity, profile, and incisor compensation limits.');
      if ((m.impa != null && m.impa > 95) || (m.lower_lip_e != null && m.lower_lip_e > 2)) {
        plan.push('Lower incisor proclination / lip protrusion suggests that non-extraction camouflage should be chosen cautiously.');
      }
      if (m.overjet != null && m.overjet > 6) {
        plan.push('Marked overjet increases the need to evaluate anchorage requirements and the realism of non-extraction correction.');
      }
    }
  } else if (s.sagittal.includes('Class III')) {
    if (growth.includes('growing') || growth.includes('possibly')) {
      plan.push('Primary pathway: early/interceptive Class III management if clinical examination confirms a growing patient and the discrepancy is suitable for orthopedic intervention.');
      plan.push('Evaluate maxillary protraction / expansion strategies only after confirming the skeletal etiology clinically and radiographically.');
    } else {
      plan.push('Primary adult/nongrowing pathway: distinguish carefully between camouflage and orthognathic-surgical management.');
      if ((m.wits != null && m.wits < -4) || (m.anb != null && m.anb < -3)) {
        plan.push('More negative sagittal indicators increase the likelihood that a surgical consultation should be presented as a main option rather than a footnote.');
      }
      if ((m.impa != null && m.impa < 85) || (m.interincisal != null && m.interincisal > 135)) {
        plan.push('Retroclined lower incisors / large interincisal angle may indicate existing dental compensation, which weakens further camouflage potential.');
      }
    }
  } else if (s.sagittal.includes('Class I')) {
    plan.push('Primary pathway: comprehensive orthodontic alignment with emphasis on crowding, protrusion, vertical control, and soft-tissue balance rather than sagittal skeletal correction.');
    if ((m.lower_lip_e != null && m.lower_lip_e > 2) || (m.overjet != null && m.overjet > 4)) {
      plan.push('If protrusion is clinically significant, extraction-based space management should remain on the table rather than assuming expansion/proclination only.');
    }
  } else {
    plan.push('Primary pathway cannot be finalized because the key sagittal metrics were incomplete; gather verified ANB/Wits and clinical records first.');
  }

  if (s.vertical.includes('hyperdivergent')) {
    plan.push('Biomechanics should emphasize vertical control, avoiding unnecessary molar extrusion and uncontrolled incisor proclination.');
  } else if (s.vertical.includes('hypodivergent')) {
    plan.push('Deep-bite mechanics and smile arc considerations may become more important than posterior vertical restraint alone.');
  }

  if (s.upperInc.includes('proclined') || s.lowerInc.includes('proclined')) {
    plan.push('Incisor torque control should be a stated objective from the beginning, not an end-stage adjustment.');
  }
  if (s.softTissue.length) {
    plan.push('Soft-tissue response should be discussed explicitly with the patient because profile goals may change the extraction/non-extraction decision.');
  }

  alternatives.push('Alternative pathway 1: non-extraction / arch-development approach if crowding is limited, profile is acceptable, and incisor position remains within a safe envelope.');
  alternatives.push('Alternative pathway 2: extraction-based camouflage if crowding/protrusion or incisor compensation limits make non-extraction less stable or less esthetic.');
  alternatives.push('Alternative pathway 3: orthodontic-surgical consultation when skeletal discrepancy dominates and dental camouflage would compromise esthetics or incisor position.');

  checks.push('Clinical exam, photographs, smile analysis, and model/space analysis are mandatory before final commitment.');
  checks.push('If the app and another software use different sign conventions for ANB or angle of convexity, preserve the raw displayed numbers and resolve the convention explicitly in the report.');
  checks.push('Treatment planning should also consider periodontal phenotype, root position, airway/TMJ symptoms, asymmetry, and patient compliance.');

  lines.push('# Treatment Planner');
  lines.push(`**Working growth status:** ${s.growthStatus}`);
  if (patient.name) lines.push(`**Patient:** ${patient.name}`);
  lines.push('');
  lines.push('## Working Diagnosis');
  if (s.sagittal !== 'undetermined') lines.push(`- ${s.sagittal}.`);
  if (s.vertical !== 'undetermined') lines.push(`- ${s.vertical}.`);
  if (s.upperInc !== 'undetermined') lines.push(`- ${s.upperInc}.`);
  if (s.lowerInc !== 'undetermined') lines.push(`- ${s.lowerInc}.`);
  if (s.softTissue.length) lines.push(`- Soft tissue: ${s.softTissue.join('; ')}.`);
  lines.push('');
  lines.push('## Treatment Objectives');
  objectives.forEach(x => lines.push(`- ${x}`));
  lines.push('');
  lines.push('## Preferred Planning Pathway');
  plan.forEach(x => lines.push(`- ${x}`));
  lines.push('');
  lines.push('## Reasonable Alternatives');
  alternatives.forEach(x => lines.push(`- ${x}`));
  lines.push('');
  lines.push('## Items Requiring Confirmation Before Final Approval');
  checks.forEach(x => lines.push(`- ${x}`));
  return lines.join('\n');
}

async function callOpenRouter({ apiKey, model, fallbackModel, prompt, referer, title }) {
  async function once(chosenModel) {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': referer || 'https://example.netlify.app',
        'X-Title': title || 'Royal Ray Zone',
      },
      body: JSON.stringify({
        model: chosenModel,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.15,
        max_tokens: 1500,
      }),
    });
    const raw = await res.text();
    if (!res.ok) {
      const err = new Error(`OpenRouter ${res.status}: ${raw}`);
      err.status = res.status;
      throw err;
    }
    const data = JSON.parse(raw);
    return { model: chosenModel, text: data?.choices?.[0]?.message?.content || '', raw: data };
  }

  try {
    return await once(model);
  } catch (e) {
    if (!fallbackModel || fallbackModel === model) throw e;
    return await once(fallbackModel);
  }
}

module.exports = {
  cors,
  json,
  normalizePayload,
  buildFinalReportMarkdown,
  buildRuleBasedTreatmentPlan,
  loadPromptFiles,
  callOpenRouter,
  fmt,
};
