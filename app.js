/* ══════════════════════════════════════════════════════════
   CLINSTRUX PATIENT PARAMETER ENGINE v1.0
   All reasoning logic is client-side and parameter-driven.
   No chatbot. No AI summary. Pure clinical rule engine.
══════════════════════════════════════════════════════════ */

/* ════════════════════════════════════════════════════════════
   SECTION 1 — PATIENT STATE
════════════════════════════════════════════════════════════ */

var P = {
  egfr:   58,
  gi:     'ulcer',          // none | dyspepsia | ulcer | ulcer-recent | bleed
  bp:     128,
  cv:     'mod',            // low | mod | high | very-high
  pain:   6,
  age:    68,
  failed: '2nsaid',         // none | physio | apap | 1nsaid | 2nsaid | multi
  adh:    'partial',        // good | partial | poor | unknown
  sed:    'high',           // none | mod | high | fall
  intol:  'both-nsaid'      // none | gi-nsaid | bp-nsaid | both-nsaid | apap | multi
};


/* ════════════════════════════════════════════════════════════
   SECTION 2 — NAVIGATION & UI TABS
════════════════════════════════════════════════════════════ */

function showSection(id, btn) {
  document.querySelectorAll('.dp-section').forEach(function(s) { s.classList.remove('active'); });
  document.querySelectorAll('.dp-nav-item').forEach(function(b) { b.classList.remove('active'); });
  document.getElementById('section-' + id).classList.add('active');
  btn.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showNoteTab(id, btn) {
  document.querySelectorAll('.cn-panel').forEach(function(p) { p.classList.remove('active'); });
  document.querySelectorAll('.cn-tab').forEach(function(t) { t.classList.remove('active'); });
  document.getElementById('cn-panel-' + id).classList.add('active');
  btn.classList.add('active');
}

function setEvFilter(btn) {
  document.querySelectorAll('.ev-filter-btn').forEach(function(b) { b.classList.remove('active'); });
  btn.classList.add('active');
}


/* ════════════════════════════════════════════════════════════
   SECTION 3 — POPOVER SYSTEM
════════════════════════════════════════════════════════════ */

var _activePopover = null;

// Maps each param key to its DOM input id and type
var POPOVER_INPUTS = {
  egfr:  { id: 'rng-egfr',    type: 'range', valId: 'rng-egfr-val' },
  bp:    { id: 'rng-bp',      type: 'range', valId: 'rng-bp-val'   },
  pain:  { id: 'rng-pain',    type: 'range', valId: 'rng-pain-val' },
  age:   { id: 'rng-age',     type: 'range', valId: 'rng-age-val'  },
  gi:    { id: 'sel-gi',      type: 'select' },
  cv:    { id: 'sel-cv',      type: 'select' },
  failed:{ id: 'sel-failed',  type: 'select' },
  adh:   { id: 'sel-adh',     type: 'select' },
  sed:   { id: 'sel-sed',     type: 'select' },
  intol: { id: 'sel-intol',   type: 'select' }
};

function openPopover(key, evt) {
  evt.stopPropagation();
  if (_activePopover) closePopover(_activePopover);

  // Sync current P value into the popover input
  var cfg = POPOVER_INPUTS[key];
  if (cfg) {
    var el = document.getElementById(cfg.id);
    if (el) {
      el.value = P[key];
      if (cfg.type === 'range' && cfg.valId) {
        document.getElementById(cfg.valId).textContent = P[key];
      }
    }
  }

  var pop = document.getElementById('pop-' + key);
  var trigger = evt.currentTarget;
  var rect = trigger.getBoundingClientRect();

  pop.style.display = 'block';
  pop.classList.add('open');

  var top = rect.bottom + 6;
  var left = rect.left;
  if (left + 240 > window.innerWidth - 10) left = window.innerWidth - 250;
  if (top + 200 > window.innerHeight) top = rect.top - 200 - 6;
  pop.style.top  = top  + 'px';
  pop.style.left = left + 'px';

  _activePopover = key;
}

function closePopover(key) {
  var pop = document.getElementById('pop-' + key);
  if (pop) { pop.classList.remove('open'); pop.style.display = 'none'; }
  _activePopover = null;
}

document.addEventListener('click', function(e) {
  if (_activePopover && !e.target.closest('.ip-popover') && !e.target.closest('.ip-param')) {
    closePopover(_activePopover);
  }
});

function applyParam(key) {
  var cfg = POPOVER_INPUTS[key];
  if (!cfg) return;
  var el = document.getElementById(cfg.id);
  if (!el) return;
  P[key] = cfg.type === 'range' ? parseInt(el.value) : el.value;
  closePopover(key);
  runReasoningEngine();
  updateHandoffMeta();
  updatePolypharmacyPanel();
}

function dismissUpdateBanner() {
  document.getElementById('ip-update-banner').classList.remove('visible');
}


/* ════════════════════════════════════════════════════════════
   SECTION 4 — SCORING & RISK HELPERS
════════════════════════════════════════════════════════════ */

function egfrRisk() {
  if (P.egfr >= 60) return 'low';
  if (P.egfr >= 45) return 'mild';
  if (P.egfr >= 30) return 'moderate';
  return 'severe';
}

function giRisk() {
  var m = { none: 'low', dyspepsia: 'low', ulcer: 'high', 'ulcer-recent': 'very-high', bleed: 'very-high' };
  return m[P.gi] || 'high';
}

function bpControl() {
  if (P.bp < 130) return 'controlled';
  if (P.bp < 150) return 'mildly-elevated';
  if (P.bp < 170) return 'elevated';
  return 'uncontrolled';
}

function ageFlag()             { return P.age >= 65; }
function apapContraindicated() { return P.intol === 'apap' || P.intol === 'multi'; }
function multimodalFailure()   { return P.failed === 'multi'; }
function acetaminophenFailed() { return P.failed === 'apap' || P.failed === 'multi'; }

function nsaidContraindicated() {
  return giRisk() === 'very-high' ||
    giRisk() === 'high' ||
    egfrRisk() === 'severe' ||
    (egfrRisk() === 'moderate' && P.intol !== 'none') ||
    bpControl() === 'uncontrolled' ||
    P.intol === 'both-nsaid' || P.intol === 'gi-nsaid' || P.intol === 'bp-nsaid' || P.intol === 'multi';
}

function opioidAvoidable() {
  return P.sed === 'high' || P.sed === 'fall' || (ageFlag() && P.sed !== 'none');
}

function computeComplexity() {
  var score = 0;
  if      (P.egfr < 30) score += 20;
  else if (P.egfr < 45) score += 15;
  else if (P.egfr < 60) score += 8;

  if      (P.gi === 'bleed')        score += 20;
  else if (P.gi === 'ulcer-recent') score += 18;
  else if (P.gi === 'ulcer')        score += 12;
  else if (P.gi === 'dyspepsia')    score += 5;

  if      (P.bp >= 170) score += 15;
  else if (P.bp >= 150) score += 10;
  else if (P.bp >= 130) score += 5;

  if      (P.cv === 'very-high') score += 12;
  else if (P.cv === 'high')      score += 8;
  else if (P.cv === 'mod')       score += 4;

  if      (P.pain >= 9) score += 8;
  else if (P.pain >= 7) score += 5;

  if      (P.age >= 80) score += 8;
  else if (P.age >= 65) score += 5;

  if      (P.failed === 'multi') score += 10;
  else if (P.failed === 'apap')  score += 8;
  else if (P.failed === '2nsaid')score += 5;

  if (P.adh === 'poor') score += 5;

  if      (P.sed === 'fall') score += 5;
  else if (P.sed === 'high') score += 3;

  return Math.min(score, 100);
}


/* ════════════════════════════════════════════════════════════
   SECTION 5 — LABEL & CSS-CLASS HELPERS
════════════════════════════════════════════════════════════ */

// -- Label maps --
var GI_LABELS = {
  none:          'No GI history',
  dyspepsia:     'Dyspepsia only',
  ulcer:         'Prior peptic ulcer',
  'ulcer-recent':'Active / recent ulcer',
  bleed:         'Prior GI bleed'
};

var GI_RISK_LABELS = {
  none:          'Baseline risk',
  dyspepsia:     'Low-moderate risk',
  ulcer:         'High risk',
  'ulcer-recent':'Very high risk',
  bleed:         'Very high risk'
};

var CV_LABELS      = { low:'Low', mod:'Moderate', high:'High', 'very-high':'Very high' };
var CV_RISK_LABELS = { low:'No major factors', mod:'Hypertension', high:'Multiple risk factors', 'very-high':'Established CVD' };

var FAILED_LABELS = {
  none:'No prior therapies', physio:'Physio only', apap:'Acetaminophen failed',
  '1nsaid':'1 NSAID failed', '2nsaid':'2 NSAIDs failed', multi:'Multiple classes failed'
};
var FAILED_RISK_LABELS = {
  none:'Treatment naive', physio:'Analgesic naive', apap:'Core option exhausted',
  '1nsaid':'Intolerance documented', '2nsaid':'Intolerance documented', multi:'Multimodal failure'
};

var ADH_LABELS      = { good:'Good adherence', partial:'Inconsistent PRN', poor:'Poor adherence', unknown:'Adherence unknown' };
var ADH_RISK_LABELS = { good:'Low concern', partial:'Concern noted', poor:'High concern', unknown:'Assess at next visit' };

var SED_LABELS      = { none:'No concern', mod:'Mild preference', high:'High concern', fall:'Fall risk active' };
var SED_RISK_LABELS = { none:'Accepts sedation', mod:'Prefers non-sedating', high:'Patient refuses sedation', fall:'Sedation contraindicated' };

var INTOL_LABELS = {
  none:'None documented', 'gi-nsaid':'NSAIDs: GI only', 'bp-nsaid':'NSAIDs: BP only',
  'both-nsaid':'NSAIDs: GI + BP', apap:'Acetaminophen', multi:'Multiple classes'
};
var INTOL_RISK_LABELS = {
  none:'No intolerance', 'gi-nsaid':'Documented × 1', 'bp-nsaid':'Documented × 1',
  'both-nsaid':'Documented × 2', apap:'Key option affected', multi:'Multiple affected'
};

// -- Label functions --
function egfrLabel() {
  var r = egfrRisk();
  if (r === 'low') return 'Normal / mild';
  if (r === 'mild') return 'Mild impairment';
  if (r === 'moderate') return 'Moderate CKD';
  return 'Severe — high risk';
}

function giLabel()       { return GI_LABELS[P.gi]; }
function giRiskLabel()   { return GI_RISK_LABELS[P.gi]; }
function bpLabel()       { return P.bp + ' mmHg systolic'; }
function bpRiskLabel() {
  var c = bpControl();
  if (c === 'controlled')      return 'Controlled';
  if (c === 'mildly-elevated') return 'Mildly elevated';
  if (c === 'elevated')        return 'Elevated — monitor';
  return 'Uncontrolled — flag';
}
function cvLabel()       { return CV_LABELS[P.cv]; }
function cvRiskLabel()   { return CV_RISK_LABELS[P.cv]; }
function painLabel()     { return P.pain + ' / 10'; }
function painRiskLabel() {
  if (P.pain <= 3) return 'Mild';
  if (P.pain <= 6) return 'Moderate';
  if (P.pain <= 8) return 'Severe';
  return 'Very severe';
}
function ageLabel()      { return P.age + ' years'; }
function ageRiskLabel()  { return ageFlag() ? '≥65 flag active' : 'No age flag'; }
function failedLabel()   { return FAILED_LABELS[P.failed]; }
function failedRiskLabel(){ return FAILED_RISK_LABELS[P.failed]; }
function adhLabel()      { return ADH_LABELS[P.adh]; }
function adhRiskLabel()  { return ADH_RISK_LABELS[P.adh]; }
function sedLabel()      { return SED_LABELS[P.sed]; }
function sedRiskLabel()  { return SED_RISK_LABELS[P.sed]; }
function intolLabel()    { return INTOL_LABELS[P.intol]; }
function intolRiskLabel(){ return INTOL_RISK_LABELS[P.intol]; }

// -- CSS class helpers --
function egfrClass()      { var r = egfrRisk(); return r==='low'?'ip-val-ok': r==='mild'?'ip-val-warning':'ip-val-danger'; }
function giClass()        { return giRisk()==='low' ? 'ip-val-ok' : 'ip-val-danger'; }
function bpClass()        { var c = bpControl(); return c==='controlled'?'ip-val-ok': c==='uncontrolled'?'ip-val-danger':'ip-val-warning'; }
function egfrParamClass() { var r = egfrRisk(); return r==='low'?'': r==='mild'?'ip-warning':'ip-danger'; }
function giParamClass()   { return giRisk()==='low' ? '' : 'ip-danger'; }
function bpParamClass()   { var c = bpControl(); return c==='controlled'?'': c==='uncontrolled'?'ip-danger':'ip-warning'; }
function egfrRiskClass()  { var r = egfrRisk(); return r==='low'?'r-low':'r-mod'; }
function giRiskClass()    { var r = giRisk(); return r==='low'?'r-low': r==='high'||r==='very-high'?'r-high':'r-mod'; }
function bpRiskClass()    { var c = bpControl(); return c==='controlled'?'r-low': c==='uncontrolled'?'r-high':'r-mod'; }


/* ════════════════════════════════════════════════════════════
   SECTION 6 — REASONING BUILDERS
   (buildPrimaryRec, buildNsaidReasoning, buildOpioidReasoning,
    buildFollowupUrgency)
════════════════════════════════════════════════════════════ */

function buildPrimaryRec() {
  var drug, state, rationale, confPct, confLabel, confDesc;

  if (apapContraindicated()) {
    if (!nsaidContraindicated() && P.cv !== 'very-high') {
      drug     = 'Low-dose NSAID\n+ PPI cover';
      state    = 'Escalation Required';
      confPct  = 55; confLabel = 'Moderate confidence';
      confDesc = 'Acetaminophen intolerance shifts first-line pathway · Close GI monitoring';
      rationale = 'Acetaminophen contraindicated or failed — documented intolerance shifts the first-line recommendation. Low-dose NSAID with mandatory PPI cover is the next appropriate option. Intensive GI and renal monitoring required given patient profile. This represents a high-risk therapeutic pathway.';
    } else {
      drug     = 'Specialist Review\nRequired';
      state    = 'Escalation — No Safe First-Line';
      confPct  = 38; confLabel = 'Low confidence — complex case';
      confDesc = 'Acetaminophen and NSAID pathways both compromised · Specialist input needed';
      rationale = 'Both primary analgesic pathways are compromised in this patient. Acetaminophen intolerance and NSAID contraindications leave limited safe pharmacological options for this severity of pain. Specialist rheumatology or pain medicine referral is recommended before initiating further pharmacotherapy.';
    }
  } else if (nsaidContraindicated()) {
    drug     = 'Acetaminophen\n(Paracetamol)';
    state    = 'Preferred · First-line';
    confPct  = 82; confLabel = 'High confidence';
    confDesc = 'Supported by ACR/EULAR guidelines · Multiple RCTs';
    var r = 'Best safety balance for this patient profile: avoids NSAID-related complications while providing adequate pain control.';
    if (giRisk() === 'very-high') r += ' Recent or active GI bleeding history makes NSAID initiation a critical safety risk.';
    else if (giRisk() === 'high') r += ' High GI risk (prior peptic ulcer) substantially elevates NSAID-related bleeding probability.';
    if (P.egfr < 45) r += ' Moderate-to-severe renal impairment (eGFR ' + P.egfr + ') makes NSAID use unsafe — significant prostaglandin-dependent perfusion dependency.';
    else if (P.egfr < 60) r += ' Baseline renal impairment (eGFR ' + P.egfr + ') further strengthens NSAID avoidance.';
    if (ageFlag()) r += ' Age ' + P.age + ' activates Beers Criteria NSAID exclusion.';
    if (bpControl() === 'uncontrolled') r += ' Uncontrolled hypertension (' + P.bp + ' mmHg) makes NSAID initiation unsafe — significant BP elevation risk.';
    if (P.intol === 'both-nsaid') r += ' Both GI and BP NSAID intolerances are documented in this patient.';
    rationale = r;
  } else if (P.pain >= 8 && P.failed !== 'none' && P.failed !== 'physio') {
    drug     = 'Acetaminophen\n+ Topical NSAID';
    state    = 'Combination · First-line';
    confPct  = 70; confLabel = 'Moderate-High confidence';
    confDesc = 'Combination approach for severe pain with prior monotherapy failure';
    rationale = 'Severe pain (' + P.pain + '/10) combined with prior analgesic failures supports combination first-line approach. Acetaminophen provides systemic baseline analgesia; topical NSAID provides localized anti-inflammatory effect with lower systemic exposure. Monitor renal and GI parameters.';
  } else {
    drug     = 'Acetaminophen\n(Paracetamol)';
    state    = 'Preferred · First-line';
    confPct  = 78; confLabel = 'High confidence';
    confDesc = 'ACR guideline aligned · Multiple RCT support';
    rationale = 'Acetaminophen remains the safest first-line analgesic for this patient given current risk profile. Pain severity (' + P.pain + '/10) is appropriate for acetaminophen monotherapy at this stage.';
  }

  // Complexity and adherence confidence adjustments
  var complexity = computeComplexity();
  if (complexity > 75) confPct = Math.max(confPct - 10, 35);
  if (P.adh === 'poor') confPct = Math.max(confPct - 5, 35);

  var confBand = '';
  var uncertaintyQualifier = '';

  if (P.adh === 'partial' || P.adh === 'unknown') {
    confPct = Math.max(confPct - 5, 35);
    confBand = ' ±6%';
    uncertaintyQualifier = 'Adherence history unverified — outcome confidence is reduced until fixed-schedule use is confirmed at Week 2.';
  }
  if (P.adh === 'poor') {
    confBand = ' ±8%';
    uncertaintyQualifier = 'Poor and unverified adherence significantly limits treatment response predictability. Efficacy assessment requires confirmed adherence.';
  }
  if (P.egfr >= 50 && P.egfr <= 62) {
    confPct = Math.max(confPct - 4, 35);
    if (!confBand) confBand = ' ±5%';
    if (!uncertaintyQualifier) uncertaintyQualifier = 'Borderline eGFR (G2/G3a) without trend data — renal trajectory direction is unconfirmed. Escalation window may narrow if declining.';
    else uncertaintyQualifier += ' Renal trajectory also unconfirmed at this stage.';
  }

  return { drug, state, rationale, confPct, confLabel, confDesc, confBand, uncertaintyQualifier };
}

function buildNsaidReasoning() {
  var reasons = [];
  var state, reason;

  if (nsaidContraindicated()) {
    state = 'Avoid';
    if (giRisk() === 'very-high') {
      reason = 'Multiple absolute contraindications make NSAID use clinically unsafe in this patient.';
      reasons.push({ id: 'dyn-nsaid-gi', text: P.gi === 'bleed'
        ? 'Active or prior GI bleed — NSAID initiation carries high probability of re-bleeding. Absolute contraindication.'
        : 'Recent peptic ulcer (&lt;1yr) substantially elevates NSAID-related GI complication risk. Contraindicated.' });
    } else if (giRisk() === 'high') {
      reason = 'Compound contraindication profile renders NSAIDs inappropriate as analgesic pathway.';
      reasons.push({ id: 'dyn-nsaid-gi', text: 'Elevated GI bleeding risk — prior peptic ulcer + documented NSAID-induced GI intolerance ('
        + (P.intol === 'both-nsaid' || P.intol === 'gi-nsaid' ? 'ibuprofen, diclofenac both failed' : 'intolerance documented') + ')' });
    } else {
      reason = 'NSAIDs deprioritized due to safety profile in this patient context.';
      reasons.push({ id: 'dyn-nsaid-gi', text: 'GI risk present — careful monitoring would be required if NSAID pathway considered in future' });
    }

    if (bpControl() === 'uncontrolled') {
      reasons.push({ id: 'dyn-nsaid-bp', text: 'Hypertension uncontrolled (' + P.bp + ' mmHg systolic) — NSAID initiation carries clinically significant risk of further BP elevation' });
    } else if (P.intol === 'bp-nsaid' || P.intol === 'both-nsaid') {
      reasons.push({ id: 'dyn-nsaid-bp', text: 'BP elevation documented with prior NSAID use — previous diclofenac caused +18 mmHg systolic; amlodipine efficacy may be compromised' });
    } else {
      reasons.push({ id: 'dyn-nsaid-bp', text: 'CV monitoring required if NSAID pathway ever initiated — controlled hypertension present' });
    }

    if (P.egfr < 30) {
      reasons.push({ id: 'dyn-nsaid-renal', text: 'Severe renal impairment (eGFR ' + P.egfr + ') — NSAIDs absolutely contraindicated; prostaglandin-dependent renal perfusion at high risk' });
    } else if (P.egfr < 45) {
      reasons.push({ id: 'dyn-nsaid-renal', text: 'Moderate renal impairment (eGFR ' + P.egfr + ') — NSAIDs impair renal perfusion significantly at this eGFR; avoid unless absolutely necessary' });
    } else {
      reasons.push({ id: 'dyn-nsaid-renal', text: 'Renal monitoring concern — eGFR ' + P.egfr + '; NSAIDs impair renal perfusion and cannot be safely initiated without close monitoring' });
    }

    if (ageFlag()) {
      reasons.push({ id: 'dyn-nsaid-age', text: 'Age ' + P.age + ' — Beers Criteria (AGS 2023) recommends against NSAIDs in adults ≥65 unless all alternatives exhausted' });
    } else {
      reasons.push({ id: 'dyn-nsaid-age', text: 'Patient age (' + P.age + ') does not trigger Beers Criteria flag — age is not the primary contraindication driver in this profile' });
    }
  } else {
    state  = 'Conditional';
    reason = 'NSAIDs are not absolutely contraindicated in this updated profile, but remain a secondary option to acetaminophen due to residual risk factors.';
    reasons.push({ id: 'dyn-nsaid-gi',    text: 'GI risk remains present — ' + giLabel().toLowerCase() + '. Low-dose with PPI cover required.' });
    reasons.push({ id: 'dyn-nsaid-bp',    text: 'BP status: ' + bpRiskLabel() + ' (' + P.bp + ' mmHg) — monitor BP closely if NSAID initiated' });
    reasons.push({ id: 'dyn-nsaid-renal', text: 'Renal function: eGFR ' + P.egfr + ' — baseline monitoring required at 2 and 6 weeks if NSAID started' });
    reasons.push({ id: 'dyn-nsaid-age',   text: ageFlag()
      ? 'Age ' + P.age + ' — Beers Criteria flag remains active; use lowest effective dose and shortest duration'
      : 'Age ' + P.age + ' — no Beers flag; standard dosing considerations apply' });
  }

  return { state, reason, reasons };
}

function buildOpioidReasoning() {
  var avoidable  = opioidAvoidable();
  var multimodal = multimodalFailure();

  if (multimodal && !avoidable) {
    return {
      state: 'Escalation Option',
      reason: 'Multimodal pharmacotherapy failure noted — low-dose opioid may be considered with specialist oversight and careful fall-risk assessment.'
    };
  }

  var reason;
  if (P.sed === 'fall') {
    reason = 'Active fall risk combined with opioid sedation potential makes this pathway contraindicated without specialist oversight.';
  } else if (P.sed === 'high') {
    reason = 'Patient explicitly refuses sedating agents — opioid pathway not clinically appropriate at this stage.';
  } else if (ageFlag() && P.sed !== 'none') {
    reason = 'Age ' + P.age + ' with sedation concern — opioid metabolite clearance and fall-risk profile make opioids an unfavorable choice.';
  } else {
    reason = 'Opioid pathway remains a last-resort escalation. Current pain severity and stage of multimodal management do not support opioid initiation.';
  }

  return { state: avoidable ? 'Avoid' : 'Last Resort', reason };
}

function buildFollowupUrgency() {
  var complexity = computeComplexity();
  if (complexity >= 75) return { wk2: 'Week 1', wk4: 'Week 2–3', tone: 'Compress follow-up intervals — high complexity profile requires accelerated reassessment.' };
  if (P.pain >= 8)      return { wk2: 'Week 2', wk4: 'Week 3–4', tone: 'Severe pain warrants early reassessment checkpoint.' };
  return { wk2: 'Week 2', wk4: 'Week 4', tone: 'Standard follow-up intervals appropriate for this risk profile.' };
}


/* ════════════════════════════════════════════════════════════
   SECTION 7 — DOM UPDATE HELPERS
   (flashElement, setText, setInnerHTML on single element)
════════════════════════════════════════════════════════════ */

function flashElement(id) {
  var el = document.getElementById(id);
  if (el) { el.classList.remove('dynamic-updated'); void el.offsetWidth; el.classList.add('dynamic-updated'); }
}

function setEl(id, text) {
  var el = document.getElementById(id);
  if (el) el.textContent = text;
}

function setElHtml(id, html) {
  var el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

function setElClass(id, cls) {
  var el = document.getElementById(id);
  if (el) el.className = cls;
}


/* ════════════════════════════════════════════════════════════
   SECTION 8 — PARAM TILE UPDATES
════════════════════════════════════════════════════════════ */

function updateParamTiles() {
  function setTile(id, valText, riskText, valClass, riskClass, paramClass) {
    var el    = document.getElementById('ip-' + id);
    var valEl = document.getElementById('ip-val-' + id);
    var rskEl = document.getElementById('ip-risk-' + id);
    if (valEl) { valEl.textContent = valText; valEl.className = 'ip-param-value ' + valClass; }
    if (rskEl) { rskEl.textContent = riskText; rskEl.className = 'ip-param-risk ' + riskClass; }
    if (el)    el.className = 'ip-param ' + paramClass;
  }

  setTile('egfr', P.egfr + ' mL/min', egfrLabel(),
    egfrClass(),
    egfrRisk()==='low'?'r-low': egfrRisk()==='mild'?'r-mod':'r-high',
    egfrParamClass());

  setTile('gi', giLabel(), giRiskLabel(),
    P.gi==='none'?'ip-val-ok':'ip-val-danger',
    giRiskClass(),
    giParamClass());

  setTile('bp', P.bp + ' mmHg', bpRiskLabel(),
    bpClass(), bpRiskClass(), bpParamClass());

  setTile('cv', cvLabel(), cvRiskLabel(),
    P.cv==='low'?'ip-val-ok': P.cv==='mod'?'ip-val-warning':'ip-val-danger',
    P.cv==='low'?'r-low': P.cv==='mod'?'r-mod':'r-high',
    P.cv==='very-high'?'ip-danger': P.cv==='high'?'ip-warning':'');

  setTile('pain', P.pain + ' / 10', painRiskLabel(),
    P.pain<=4?'ip-val-ok': P.pain<=7?'ip-val-warning':'ip-val-danger',
    P.pain<=4?'r-low': P.pain<=7?'r-mod':'r-high',
    P.pain>=8?'ip-danger': P.pain>=6?'ip-warning':'');

  setTile('age', P.age + ' years', ageRiskLabel(),
    ageFlag()?'ip-val-warning':'ip-val-ok',
    ageFlag()?'r-mod':'r-low',
    ageFlag()?'ip-warning':'');

  setTile('failed', failedLabel(), failedRiskLabel(),
    P.failed==='none'||P.failed==='physio'?'ip-val-ok': P.failed==='multi'?'ip-val-danger':'ip-val-warning',
    P.failed==='none'||P.failed==='physio'?'r-low': P.failed==='multi'?'r-high':'r-mod',
    P.failed==='multi'?'ip-danger': P.failed==='apap'||P.failed==='2nsaid'?'ip-warning':'');

  setTile('adh', adhLabel(), adhRiskLabel(),
    P.adh==='good'?'ip-val-ok': P.adh==='poor'?'ip-val-danger':'ip-val-warning',
    P.adh==='good'?'r-low': P.adh==='poor'?'r-high':'r-mod',
    P.adh==='poor'?'ip-warning':'');

  setTile('sed', sedLabel(), sedRiskLabel(),
    P.sed==='none'?'ip-val-ok': P.sed==='fall'?'ip-val-danger':'ip-val-warning',
    P.sed==='none'?'r-low': P.sed==='fall'?'r-high':'r-mod',
    P.sed==='fall'?'ip-danger': P.sed==='high'?'ip-warning':'');

  setTile('intol', intolLabel(), intolRiskLabel(),
    P.intol==='none'?'ip-val-ok': P.intol==='multi'||P.intol==='apap'?'ip-val-danger':'ip-val-warning',
    P.intol==='none'?'r-low': P.intol==='multi'||P.intol==='apap'?'r-high':'r-mod',
    P.intol==='multi'||P.intol==='apap'?'ip-danger': P.intol!=='none'?'ip-warning':'');
}


/* ════════════════════════════════════════════════════════════
   SECTION 9 — COMPLEXITY BAR
════════════════════════════════════════════════════════════ */

function updateComplexityBar() {
  var score  = computeComplexity();
  var fill   = document.getElementById('ip-complexity-fill');
  var scoreEl = document.getElementById('ip-complexity-score');
  var descEl  = document.getElementById('ip-complexity-desc');

  if (fill)    fill.style.width = score + '%';
  if (scoreEl) scoreEl.textContent = score;

  var color, desc;
  if      (score >= 80) { color = 'var(--red)';   desc = '— Critical complexity. Multiple active absolute contraindications. Specialist input likely required.'; }
  else if (score >= 60) { color = 'var(--amber)';  desc = '— High-complexity multifactorial profile. Multiple active contraindications.'; }
  else if (score >= 35) { color = 'var(--blue)';   desc = '— Moderate complexity. Careful monitoring required. Standard escalation pathways available.'; }
  else                  { color = 'var(--green)';  desc = '— Lower complexity. Straightforward analgesic pathway available.'; }

  if (fill)    { fill.style.background = color; }
  if (scoreEl) { scoreEl.style.color = color; }
  if (descEl)  { descEl.textContent = desc; }
}


/* ════════════════════════════════════════════════════════════
   SECTION 10 — MONITORING CONTRAINDICATIONS
════════════════════════════════════════════════════════════ */

function updateContraindications() {
  var renalEl = document.getElementById('dyn-contra-renal');
  var bpEl    = document.getElementById('dyn-contra-bp');
  var sedEl   = document.getElementById('dyn-contra-sed');

  if (renalEl) {
    if (P.egfr < 30) {
      renalEl.innerHTML = '<span class="mn-contra-x">✕</span> <strong>Active warning:</strong> eGFR ' + P.egfr + ' — NSAIDs absolutely contraindicated. Acetaminophen dose reduction required. Nephrology referral threshold approaching.';
      renalEl.style.color = 'var(--red)'; renalEl.style.fontWeight = '600';
    } else if (P.egfr < 45) {
      renalEl.innerHTML = '<span class="mn-contra-x">✕</span> <strong>Elevated risk:</strong> eGFR ' + P.egfr + ' (moderate CKD) — NSAIDs unsafe at this renal function. Monitor closely. Avoid escalation without nephrology input.';
      renalEl.style.color = 'var(--amber)'; renalEl.style.fontWeight = '600';
    } else {
      renalEl.innerHTML = '<span class="mn-contra-x">✕</span> eGFR &lt;30 — avoid NSAIDs entirely; acetaminophen dose reduction required. Current eGFR ' + P.egfr + ' — monitor trajectory.';
      renalEl.style.color = ''; renalEl.style.fontWeight = '';
    }
  }

  if (bpEl) {
    if (bpControl() === 'uncontrolled') {
      bpEl.innerHTML = '<span class="mn-contra-x">✕</span> <strong>Active flag:</strong> BP ' + P.bp + ' mmHg — NSAID initiation contraindicated. Review amlodipine dose. Do not escalate to NSAID until BP &lt;150 mmHg.';
      bpEl.style.color = 'var(--red)'; bpEl.style.fontWeight = '600';
    } else {
      bpEl.innerHTML = '<span class="mn-contra-x">✕</span> Uncontrolled hypertension (SBP &gt;160) — avoid NSAIDs until BP controlled. Current BP: ' + P.bp + ' mmHg (' + bpRiskLabel() + ')';
      bpEl.style.color = bpControl() === 'elevated' ? 'var(--amber)' : '';
      bpEl.style.fontWeight = bpControl() === 'elevated' ? '600' : '';
    }
  }

  if (sedEl) {
    if (P.sed === 'fall') {
      sedEl.innerHTML = '<span class="mn-contra-x">✕</span> <strong>Active fall risk:</strong> Sedating agents (opioids, duloxetine, gabapentinoids) are contraindicated without formal fall risk assessment and specialist sign-off.';
      sedEl.style.color = 'var(--red)'; sedEl.style.fontWeight = '600';
    } else if (P.sed === 'high') {
      sedEl.innerHTML = '<span class="mn-contra-x">✕</span> Patient expressly refuses sedating agents — sedation concern documented. All neuromodulators require explicit patient consent and counselling on sedation risk before initiation.';
      sedEl.style.color = 'var(--amber)'; sedEl.style.fontWeight = '600';
    } else if (P.sed === 'none') {
      sedEl.innerHTML = '<span class="mn-contra-x">✕</span> Sedation tolerance documented — patient accepts sedating agents if benefit is explained. Standard sedation monitoring applies.';
      sedEl.style.color = 'var(--green)'; sedEl.style.fontWeight = '';
    } else {
      sedEl.innerHTML = '<span class="mn-contra-x">✕</span> Sedating agents (opioids, high-dose duloxetine) without fall-risk assessment — patient prefers non-sedating agents; discussion required before initiating.';
      sedEl.style.color = ''; sedEl.style.fontWeight = '';
    }
  }
}


/* ════════════════════════════════════════════════════════════
   SECTION 11 — RENAL DOSING BLOCK
════════════════════════════════════════════════════════════ */

function updateRenalDosingBlock() {
  var apapVal  = document.getElementById('dyn-rd-apap-val');
  var apapNote = document.getElementById('dyn-rd-apap-note');
  var nsaidVal = document.getElementById('dyn-rd-nsaid-val');
  var nsaidNote = document.getElementById('dyn-rd-nsaid-note');
  var opioidVal = document.getElementById('dyn-rd-opioid-val');
  var opioidNote = document.getElementById('dyn-rd-opioid-note');
  var trajNote  = document.getElementById('dyn-rd-trajectory-note');
  if (!apapVal) return;

  // Acetaminophen ceiling
  if (P.egfr < 30) {
    apapVal.style.color = 'var(--red)'; apapVal.textContent = '2 g/day max (eGFR ' + P.egfr + ')';
    apapNote.textContent = 'Severe CKD — reduce to 2 g/day, extend dosing interval to every 6–8 hours. Monitor LFTs. Nephrology input mandatory.';
  } else if (P.egfr < 45) {
    apapVal.style.color = 'var(--red)'; apapVal.textContent = '2.5 g/day max (eGFR ' + P.egfr + ')';
    apapNote.textContent = 'Moderate CKD — max 2.5 g/day. Consider every 6-hour dosing intervals. Monitor LFTs at 4 weeks.';
  } else if (P.egfr < 60) {
    apapVal.style.color = 'var(--amber)'; apapVal.textContent = '3 g/day max (eGFR ' + P.egfr + ')';
    apapNote.textContent = 'Older adult + G3a CKD ceiling. Reduce to 2 g/day if eGFR drops below 30. Monitor trajectory 6-weekly.';
  } else {
    apapVal.style.color = 'var(--green)'; apapVal.textContent = '3–4 g/day (age-adjusted)';
    apapNote.textContent = 'eGFR ≥60 — renal function not dose-limiting. Older adult ceiling (3 g/day) applies based on age ' + P.age + '.';
  }

  // NSAID status
  if (P.egfr < 30) {
    nsaidVal.style.color = 'var(--red)'; nsaidVal.textContent = 'Absolutely contraindicated';
    nsaidNote.textContent = 'Severe renal impairment — all oral and topical NSAIDs contraindicated. Prostaglandin inhibition at this eGFR is nephrotoxic. No exceptions.';
  } else if (P.egfr < 45) {
    nsaidVal.style.color = 'var(--red)'; nsaidVal.textContent = 'Contraindicated (eGFR ' + P.egfr + ')';
    nsaidNote.textContent = 'NSAIDs unsafe at eGFR <45 — meaningful impairment of autoregulatory renal perfusion. Risk of AKI. Topical NSAIDs: monitor closely.';
  } else if (nsaidContraindicated()) {
    nsaidVal.style.color = 'var(--red)'; nsaidVal.textContent = 'Avoid (intolerance + risk)';
    nsaidNote.textContent = 'eGFR ' + P.egfr + ' permits conditional NSAID use on renal grounds, but documented GI and BP intolerance make NSAIDs unsafe. Renal concern adds to contraindication stack.';
  } else {
    nsaidVal.style.color = 'var(--amber)'; nsaidVal.textContent = 'Conditional (eGFR ' + P.egfr + ')';
    nsaidNote.textContent = 'eGFR ≥' + P.egfr + ' — NSAID use conditionally permissible with close monitoring. eGFR recheck at 2 and 6 weeks if initiated. Stop if eGFR falls ≥15%.';
  }

  // Opioid/adjunct risk
  if (P.egfr < 30) {
    opioidVal.style.color = 'var(--red)'; opioidVal.textContent = 'High accumulation risk';
    opioidNote.textContent = 'Active morphine-6-glucuronide accumulation. Gabapentinoids require severe dose reduction. Specialist guidance mandatory.';
  } else if (P.egfr < 45) {
    opioidVal.style.color = 'var(--red)'; opioidVal.textContent = 'Moderate accumulation risk';
    opioidNote.textContent = 'M6G accumulation begins. Opioids require dose reduction and extended intervals. Gabapentinoids need CrCl-based dose adjustment.';
  } else if (P.egfr < 60) {
    opioidVal.style.color = 'var(--amber)'; opioidVal.textContent = 'Emerging risk (eGFR ' + P.egfr + ')';
    opioidNote.textContent = 'eGFR 58 — approaching M6G accumulation threshold. Avoid opioids unless unavoidable. Gabapentin/pregabalin dose reduction required at eGFR <60.';
  } else {
    opioidVal.style.color = 'var(--muted)'; opioidVal.textContent = 'Standard monitoring';
    opioidNote.textContent = 'eGFR ≥60 — no opioid metabolite accumulation concern on renal grounds. Sedation risk (patient-reported) remains the primary opioid barrier.';
  }

  // Trajectory note
  if (trajNote) {
    var threshEgfr = Math.round(P.egfr * 0.85);
    if (P.egfr < 45) {
      trajNote.textContent = 'eGFR ' + P.egfr + ' — actively monitoring for further decline. Nephrology co-management threshold approaching. Next check: 4 weeks.';
    } else if (P.egfr < 60) {
      trajNote.textContent = 'Current eGFR ' + P.egfr + ' (G3a range). A 15% decline from baseline would bring eGFR to approximately ' + threshEgfr + ' mL/min — crossing into G3b, tightening all dose thresholds. Next eGFR check due at 6 weeks.';
    } else {
      trajNote.textContent = 'eGFR ' + P.egfr + ' currently above G3a threshold. Annual monitoring appropriate unless clinical deterioration. Renal dose adjustments become relevant if eGFR falls below 60 mL/min.';
    }
  }
}


/* ════════════════════════════════════════════════════════════
   SECTION 12 — MAIN REASONING ENGINE
════════════════════════════════════════════════════════════ */

function runReasoningEngine() {
  updateParamTiles();
  updateComplexityBar();
  updateClinicalStatusSummary();
  updateClinicalImpression();

  var rec    = buildPrimaryRec();
  var nsaidR = buildNsaidReasoning();

  // 1. Primary recommendation
  var primaryDrugEl = document.getElementById('dyn-primary-drug');
  if (primaryDrugEl) { primaryDrugEl.innerHTML = rec.drug.replace('\n', '<br>'); flashElement('dyn-primary-drug'); }
  var stateEl = document.getElementById('dyn-primary-state');
  if (stateEl) { stateEl.textContent = rec.state; flashElement('dyn-primary-state'); }
  var ratEl = document.getElementById('dyn-primary-rationale');
  if (ratEl) { ratEl.textContent = rec.rationale; flashElement('dyn-primary-rationale'); }

  // 2. Confidence strip
  var pctEl = document.getElementById('dyn-conf-pct');
  if (pctEl) {
    var bandEl = document.getElementById('dyn-conf-band');
    if (bandEl) bandEl.textContent = rec.confBand || '';
    pctEl.childNodes[0].textContent = rec.confPct + '%';
    flashElement('dyn-conf-pct');
  }
  setEl('dyn-conf-label', rec.confLabel);
  setEl('dyn-conf-desc', rec.confDesc);

  var barEl = document.getElementById('dyn-conf-bar');
  if (barEl) barEl.style.width = rec.confPct + '%';

  var qualEl = document.getElementById('dyn-conf-qualifier');
  if (qualEl) {
    if (rec.uncertaintyQualifier) {
      qualEl.textContent = rec.uncertaintyQualifier;
      qualEl.style.display = 'flex';
    } else {
      qualEl.style.display = 'none';
    }
  }

  if (pctEl) {
    if      (rec.confPct >= 70) pctEl.style.color = 'rgba(80,210,145,0.95)';
    else if (rec.confPct >= 55) pctEl.style.color = 'rgba(230,165,50,0.9)';
    else                        pctEl.style.color = 'rgba(255,120,100,0.9)';
  }

  // 3. Decision drivers summary
  var drivers = [];
  if (giRisk() !== 'low')       drivers.push(giRisk()==='very-high' ? 'Critical GI risk' : 'High GI risk');
  if (ageFlag())                 drivers.push('Age ' + P.age + ' (≥65 flag)');
  if (P.intol !== 'none')        drivers.push('Documented drug intolerance');
  if (egfrRisk() !== 'low')      drivers.push('Renal impairment (eGFR ' + P.egfr + ')');
  if (bpControl() !== 'controlled') drivers.push('BP management (' + P.bp + ' mmHg)');
  if (P.pain >= 8)               drivers.push('Severe pain (' + P.pain + '/10)');
  if (P.failed === 'multi')      drivers.push('Multimodal failure');
  if (P.adh === 'poor')          drivers.push('Adherence concern');
  drivers.push('Long-term management goal');

  var driversEl = document.getElementById('dyn-drivers-summary');
  if (driversEl) { driversEl.textContent = drivers.join(' · '); flashElement('dyn-drivers-summary'); }

  // 4. NSAID why-not
  var nsaidState = document.getElementById('dyn-nsaid-state');
  if (nsaidState) {
    nsaidState.textContent = nsaidR.state;
    nsaidState.className = 'wn-col-state ' + (nsaidR.state === 'Avoid' ? 'avoid' : 'cond');
  }
  var nsaidReason = document.getElementById('dyn-nsaid-reason');
  if (nsaidReason) { nsaidReason.textContent = nsaidR.reason; flashElement('dyn-nsaid-reason'); }
  nsaidR.reasons.forEach(function(r) {
    var el = document.getElementById(r.id);
    if (el) el.innerHTML = r.text;
  });

  // 5. Opioid reasoning
  var opioidR = buildOpioidReasoning();
  var opioidState = document.getElementById('dyn-opioid-state');
  if (opioidState) {
    opioidState.textContent = opioidR.state;
    opioidState.className = 'wn-col-state ' + (opioidR.state === 'Avoid' ? 'avoid' : 'esc');
  }
  setEl('dyn-opioid-reason', opioidR.reason);

  // 6. Opioid renal note
  var opioidRenal = document.getElementById('dyn-opioid-renal');
  if (opioidRenal) {
    if      (P.egfr < 30) opioidRenal.textContent = 'Severe renal impairment (eGFR ' + P.egfr + ') — opioid metabolite accumulation is a critical safety concern; morphine-6-glucuronide clearance severely compromised';
    else if (P.egfr < 45) opioidRenal.textContent = 'Moderate renal impairment (eGFR ' + P.egfr + ') — opioid metabolite clearance significantly reduced; dose reduction mandatory if ever initiated';
    else                  opioidRenal.textContent = 'Renal metabolite clearance — eGFR ' + P.egfr + ' limits elimination of opioid metabolites (esp. morphine-6-glucuronide)';
  }

  // 7. Opioid stage note
  var opioidStage = document.getElementById('dyn-opioid-stage');
  if (opioidStage) {
    if (multimodalFailure())    opioidStage.textContent = 'Multimodal failure documented — low-dose opioid may warrant specialist consideration if patient sedation profile changes';
    else if (P.failed === 'apap') opioidStage.textContent = 'Acetaminophen failed — escalation pathway narrows; opioids remain deprioritized pending topical NSAID and duloxetine trial (if sedation concern resolved)';
    else                        opioidStage.textContent = 'No clinical indication at this stage — pain severity (' + P.pain + '/10) and prior treatment history do not yet justify opioid pathway';
  }

  // 8. Monitoring contraindications + renal dosing block
  updateContraindications();
  updateRenalDosingBlock();

  // 9. Evidence badge
  var evBadge = document.querySelector('.dp-evidence-badge');
  if (evBadge) {
    var complexity = computeComplexity();
    var shieldSvg = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> ';
    if (complexity >= 75) {
      evBadge.style.background = 'rgba(184,50,41,0.07)';
      evBadge.style.color = 'var(--red)';
      evBadge.style.borderColor = 'rgba(184,50,41,0.2)';
      evBadge.innerHTML = shieldSvg + 'Evidence: Moderate — Complex';
    } else if (complexity >= 50) {
      evBadge.style.background = 'rgba(184,122,0,0.07)';
      evBadge.style.color = 'var(--amber)';
      evBadge.style.borderColor = 'rgba(184,122,0,0.2)';
      evBadge.innerHTML = shieldSvg + 'Evidence: Moderate';
    } else {
      evBadge.style.background = '';
      evBadge.style.color = 'var(--green)';
      evBadge.style.borderColor = '';
      evBadge.innerHTML = shieldSvg + 'Evidence: High';
    }
  }

  // 10. Update banner
  var banner = document.getElementById('ip-update-banner');
  if (banner) {
    var msgs = [];
    msgs.push(nsaidContraindicated() ? 'NSAID pathway: contraindicated' : 'NSAID pathway: conditional');
    if (apapContraindicated()) msgs.push('Acetaminophen: affected');
    msgs.push('Confidence: ' + rec.confPct + '%');
    setEl('ip-update-text', 'Reasoning updated — ' + msgs.join(' · '));
    banner.classList.add('visible');
  }

  // 11. Stale indicator on downstream sections
  ['section-summary', 'section-drivers', 'section-monitoring'].forEach(function(id) {
    var sec = document.getElementById(id);
    if (sec) {
      sec.classList.add('reason-stale');
      setTimeout(function() { sec.classList.remove('reason-stale'); }, 3000);
    }
  });

  // 12. Clinical reasoning panel
  updateClinicalReasoningPanel(rec, nsaidR);

  // 13. Review Objective Banner
  updateReviewObjectiveBanner(rec);

  // 14. Pharmacist Intervention Panel
  updateInterventionPanel(rec);
}


/* ════════════════════════════════════════════════════════════
   SECTION 13 — CLINICAL REASONING PANEL
════════════════════════════════════════════════════════════ */

var _isFirstRun = true;

// Snapshot of previous state for change detection
var _prev = {
  recDrug:       null,
  nsaidState:    null,
  nsaidWasContra:null,
  egfr:          null,
  gi:            null,
  bp:            null,
  pain:          null,
  adh:           null,
  giRisk:        null,
  bpControl:     null,
  apapContra:    null,
  multimodal:    null,
  complexity:    null
};

function setCrSignal(signalId, sevClass, valId, valText, subId, subText) {
  var signal = document.getElementById(signalId);
  if (signal) {
    signal.className = 'cr-signal ' + sevClass;
    signal.classList.add('cr-updated');
    setTimeout(function() { if (signal) signal.classList.remove('cr-updated'); }, 800);
    var dot = signal.querySelector('.cr-signal-label-dot');
    if (dot) {
      dot.className = 'cr-signal-label-dot';
      if      (sevClass === 'sev-red')   dot.classList.add('dot-red');
      else if (sevClass === 'sev-amber') dot.classList.add('dot-amber');
      else if (sevClass === 'sev-green') dot.classList.add('dot-green');
      else                               dot.classList.add('dot-blue');
    }
  }
  setEl(valId, valText);
  if (subId) setEl(subId, subText);
}

function updateClinicalReasoningPanel(rec, nsaidR) {
  var changed = !_isFirstRun && (
    rec.drug    !== _prev.recDrug    ||
    nsaidR.state !== _prev.nsaidState ||
    P.egfr !== _prev.egfr || P.gi !== _prev.gi ||
    P.bp   !== _prev.bp   || P.pain !== _prev.pain ||
    P.adh  !== _prev.adh
  );

  // 1. Primary Clinical Concern
  var concernVal, concernSub, concernSev;
  if (giRisk() === 'very-high') {
    concernVal = 'Active / recent GI bleeding risk';
    concernSub = 'Absolute contraindication to NSAIDs · Immediate GI monitoring priority';
    concernSev = 'sev-red';
  } else if (P.egfr < 30) {
    concernVal = 'Severe renal impairment (eGFR ' + P.egfr + ')';
    concernSub = 'Narrows entire analgesic pathway · Opioid metabolite accumulation risk';
    concernSev = 'sev-red';
  } else if (giRisk() === 'high' && egfrRisk() !== 'low') {
    concernVal = 'Compound GI + renal risk';
    concernSub = 'Prior peptic ulcer · eGFR ' + P.egfr + ' · NSAID intolerance ×' + (P.intol === 'none' ? '0' : P.intol === 'multi' || P.intol === 'both-nsaid' ? '2' : '1');
    concernSev = 'sev-red';
  } else if (giRisk() === 'high') {
    concernVal = 'GI bleeding risk — primary NSAID barrier';
    concernSub = 'Prior peptic ulcer · Documented NSAID-induced GI intolerance';
    concernSev = 'sev-red';
  } else if (P.pain >= 8 && multimodalFailure()) {
    concernVal = 'Severe pain + multimodal failure';
    concernSub = 'Limited safe escalation options remain · Specialist input may be needed';
    concernSev = 'sev-red';
  } else if (apapContraindicated() && nsaidContraindicated()) {
    concernVal = 'Both primary analgesic pathways compromised';
    concernSub = 'Acetaminophen + NSAID both contraindicated · Requires specialist review';
    concernSev = 'sev-red';
  } else if (P.pain >= 8) {
    concernVal = 'Severe pain (' + P.pain + '/10) — analgesic adequacy';
    concernSub = 'Pain severity strains available non-opioid options · Monitor response closely';
    concernSev = 'sev-amber';
  } else if (ageFlag() && P.adh === 'poor') {
    concernVal = 'Age ≥65 + poor adherence';
    concernSub = 'Subtherapeutic dosing probable · Outcomes assessment unreliable at Week 4';
    concernSev = 'sev-amber';
  } else {
    concernVal = 'Moderate pain with manageable risk profile';
    concernSub = 'GI risk present but controlled · Standard monitoring applies';
    concernSev = 'sev-amber';
  }
  setCrSignal('crs-primary-concern', concernSev, 'crs-concern-val', concernVal, 'crs-concern-sub', concernSub);

  // 2. Highest Monitoring Priority
  var monitorVal, monitorSub, monitorSev;
  if (P.egfr < 30) {
    monitorVal = 'eGFR — severe impairment requires weekly review';
    monitorSub = 'Opioid metabolite accumulation · All renally-cleared drugs at risk';
    monitorSev = 'sev-red';
  } else if (P.egfr < 45) {
    monitorVal = 'eGFR — moderate impairment (eGFR ' + P.egfr + ')';
    monitorSub = 'Review at 2 weeks · Flag any further decline ≥5 mL/min';
    monitorSev = 'sev-red';
  } else if (giRisk() === 'very-high') {
    monitorVal = 'GI symptoms — active/recent bleed history';
    monitorSub = 'Any new GI symptoms require immediate reassessment · Hold analgesic pathway';
    monitorSev = 'sev-red';
  } else if (bpControl() === 'uncontrolled') {
    monitorVal = 'Blood pressure (' + P.bp + ' mmHg) — uncontrolled';
    monitorSub = 'Recheck before any analgesic initiation · Target &lt;140/90 before escalation';
    monitorSev = 'sev-red';
  } else if (P.egfr < 60) {
    monitorVal = 'Renal function (eGFR ' + P.egfr + ')';
    monitorSub = 'Check at 2 and 6 weeks · Flag if eGFR drops &gt;10%';
    monitorSev = 'sev-amber';
  } else if (P.adh === 'poor') {
    monitorVal = 'Medication adherence — inconsistent use documented';
    monitorSub = 'Confirm PRN vs. scheduled dosing · NRS response unreliable without regular dosing';
    monitorSev = 'sev-amber';
  } else if (giRisk() === 'high') {
    monitorVal = 'GI status — prior peptic ulcer';
    monitorSub = 'Monitor for dyspepsia, dark stool, abdominal pain · Annual endoscopy if on long-term analgesics';
    monitorSev = 'sev-amber';
  } else {
    monitorVal = 'Pain response at Week 2 (NRS)';
    monitorSub = 'Failure to reach NRS ≤4 opens escalation pathway review';
    monitorSev = 'sev-green';
  }
  setCrSignal('crs-monitor-priority', monitorSev, 'crs-monitor-val', monitorVal, 'crs-monitor-sub', monitorSub);

  // 3. Main Treatment Constraint
  var constraintVal, constraintSub, constraintSev;
  if (apapContraindicated() && nsaidContraindicated()) {
    constraintVal = 'Both NSAID and acetaminophen pathways closed';
    constraintSub = 'No safe first-line pharmacological option available · Specialist referral required';
    constraintSev = 'sev-red';
  } else if (nsaidContraindicated()) {
    var constraintReasons = [];
    if (giRisk() !== 'low') constraintReasons.push('GI risk');
    if (bpControl() !== 'controlled' || P.intol === 'bp-nsaid' || P.intol === 'both-nsaid') constraintReasons.push('BP intolerance');
    if (ageFlag()) constraintReasons.push('age ≥65 (Beers)');
    if (P.egfr < 45) constraintReasons.push('eGFR ' + P.egfr);
    constraintVal = 'NSAID pathway closed';
    constraintSub = constraintReasons.join(' + ') || 'Multiple converging contraindications';
    constraintSev = 'sev-red';
  } else if (opioidAvoidable()) {
    constraintVal = 'Opioid pathway: avoid — sedation + renal risk';
    constraintSub = 'Patient refuses sedation · eGFR ' + P.egfr + ' limits metabolite clearance';
    constraintSev = 'sev-amber';
  } else if (P.sed === 'fall') {
    constraintVal = 'Sedation agents contraindicated';
    constraintSub = 'High fall risk · Patient explicitly refuses · Duloxetine and opioids deprioritized';
    constraintSev = 'sev-amber';
  } else if (apapContraindicated()) {
    constraintVal = 'Acetaminophen pathway affected';
    constraintSub = 'Documented intolerance · NSAID fallback applies with caution';
    constraintSev = 'sev-amber';
  } else {
    constraintVal = 'No absolute constraint — pathway open';
    constraintSub = 'Acetaminophen first-line available · Monitor per standard protocol';
    constraintSev = 'sev-green';
  }
  setCrSignal('crs-constraint', constraintSev, 'crs-constraint-val', constraintVal, 'crs-constraint-sub', constraintSub);

  // 4. Most Significant Escalation Trigger
  var triggerVal, triggerSub, triggerSev;
  if (multimodalFailure()) {
    triggerVal = 'Multimodal failure — escalation pathway active';
    triggerSub = 'All non-opioid options exhausted · Specialist review required for next step';
    triggerSev = 'sev-red';
  } else if (P.pain >= 8) {
    triggerVal = 'Severe pain already present (NRS ' + P.pain + '/10)';
    triggerSub = 'Combination therapy threshold met · Consider topical NSAID adjunct now';
    triggerSev = 'sev-amber';
  } else if (P.failed === 'apap') {
    triggerVal = 'Acetaminophen failed — escalation needed';
    triggerSub = 'Move to topical NSAID + consider duloxetine if neuropathic features present';
    triggerSev = 'sev-amber';
  } else if (P.failed === '2nsaid') {
    triggerVal = '2 NSAIDs failed — limited escalation options';
    triggerSub = 'Combination acetaminophen + topical NSAID · Duloxetine if neuropathic component';
    triggerSev = 'sev-amber';
  } else {
    var triggerItems = [];
    if (P.pain < 8) triggerItems.push('NRS ≥8');
    triggerItems.push('acetaminophen failure at Week 4');
    triggerVal = triggerItems.join(' or ');
    triggerSub = 'Would open topical NSAID ' + (nsaidContraindicated() ? '' : 'or low-dose systemic NSAID ') + 'combination pathway';
    triggerSev = 'sev-amber';
  }
  setCrSignal('crs-escalation-trigger', triggerSev, 'crs-trigger-val', triggerVal, 'crs-trigger-sub', triggerSub);

  // 5. Key Longitudinal Concern
  var longVal, longSub, longSev;
  if (P.adh === 'poor') {
    longVal = 'Adherence — poor, inconsistent use documented';
    longSub = 'Subtherapeutic exposure expected · Week 4 NRS response unreliable · Reframe adherence plan';
    longSev = 'sev-red';
  } else if (P.egfr < 45) {
    longVal = 'Progressive renal decline — long-term analgesic access';
    longSub = 'eGFR ' + P.egfr + ' · Further decline may close additional pathways · Annual nephrology review';
    longSev = 'sev-red';
  } else if (P.adh === 'mod') {
    longVal = 'Adherence — inconsistent PRN dosing pattern';
    longSub = 'Subtherapeutic use limits outcome assessment at Week 4';
    longSev = 'sev-amber';
  } else if (ageFlag() && P.egfr < 60) {
    longVal = 'Age ≥65 + baseline renal impairment';
    longSub = 'Renal function likely to decline over time · Annual eGFR review · Analgesic pathway may narrow';
    longSev = 'sev-amber';
  } else if (giRisk() !== 'low') {
    longVal = 'GI status — prior peptic ulcer history';
    longSub = 'Long-term analgesic use requires annual GI reassessment';
    longSev = 'sev-amber';
  } else {
    longVal = 'Mobility and function — primary patient goal';
    longSub = 'Track NRS, stair-climbing capacity, and walking distance at each review';
    longSev = 'sev-blue';
  }
  setCrSignal('crs-longitudinal', longSev, 'crs-longitudinal-val', longVal, 'crs-longitudinal-sub', longSub);

  // 6. Current Risk Balance
  var balanceVal, balancePill, balancePillClass, balanceSev;
  var complexity = computeComplexity();
  if (apapContraindicated() && nsaidContraindicated()) {
    balanceVal = 'Unfavorable — no safe standard pathway';
    balancePill = 'Specialist referral required';
    balancePillClass = 'cr-risk-balance rb-unfavorable';
    balanceSev = 'sev-red';
  } else if (complexity >= 75) {
    balanceVal = 'Caution — high-complexity profile';
    balancePill = 'Acetaminophen: best available option';
    balancePillClass = 'cr-risk-balance rb-caution';
    balanceSev = 'sev-amber';
  } else if (nsaidContraindicated()) {
    balanceVal = 'Manageable — within acetaminophen pathway';
    balancePill = 'NSAID risk exceeds benefit · Acetaminophen favorable';
    balancePillClass = 'cr-risk-balance rb-favorable';
    balanceSev = 'sev-green';
  } else {
    balanceVal = 'Favorable — within safe pathway';
    balancePill = 'Acetaminophen: low systemic risk';
    balancePillClass = 'cr-risk-balance rb-favorable';
    balanceSev = 'sev-green';
  }
  setCrSignal('crs-risk-balance', balanceSev, 'crs-balance-val', balanceVal, null, null);
  var pillEl = document.getElementById('crs-balance-pill');
  if (pillEl) { pillEl.textContent = balancePill; pillEl.className = balancePillClass; }

  // 7. Change detection & causality
  var changeRow  = document.getElementById('cr-change-row');
  var changeText = document.getElementById('cr-change-text');
  if (changed && changeRow && changeText) {
    var changeMsg = '';
    var triggerNote = '';
    var changeFactors = [];

    if (rec.drug !== _prev.recDrug) {
      if (nsaidContraindicated() && !_prev.nsaidWasContra) {
        changeFactors.push('NSAID pathway newly contraindicated — recommendation locked to acetaminophen');
        if      (giRisk() === 'very-high' && _prev.giRisk !== 'very-high')   triggerNote = 'GI risk escalated to very-high — NSAIDs are now an absolute contraindication. NSAID escalation has been removed from the pathway entirely.';
        else if (bpControl() === 'uncontrolled' && _prev.bpControl !== 'uncontrolled') triggerNote = 'BP rose to uncontrolled range (' + P.bp + ' mmHg) — NSAID initiation is now unsafe. Amlodipine efficacy would be further compromised. NSAID pathway closed.';
        else if (P.egfr < 30 && _prev.egfr >= 30)  triggerNote = 'eGFR dropped below 30 — NSAIDs are absolutely contraindicated at this renal function. Prostaglandin-dependent renal perfusion is critically impaired.';
        else if (P.egfr < 45 && _prev.egfr >= 45)  triggerNote = 'eGFR crossed below 45 — moderate renal impairment now makes NSAID use clinically unsafe. Renal pathway risk now outweighs any analgesic benefit.';
        else                                         triggerNote = 'Combined contraindication profile has closed the NSAID pathway. GI risk + renal + BP factors are now compounding.';
      } else if (!nsaidContraindicated() && _prev.nsaidWasContra) {
        changeFactors.push('NSAID pathway reopened — risk profile has improved');
        triggerNote = 'Contraindication profile has partially resolved. NSAIDs are no longer absolutely contraindicated, but remain a secondary option due to residual risk factors.';
      } else if (apapContraindicated() && !_prev.apapContra) {
        changeFactors.push('Acetaminophen intolerance newly documented — recommendation pathway shifted');
        triggerNote = 'Acetaminophen intolerance documented. This eliminates the primary first-line option. The workflow has shifted to the NSAID or specialist pathway.';
      } else if (P.pain >= 8 && _prev.pain < 8) {
        changeFactors.push('Pain crossed severe threshold (NRS ' + P.pain + '/10) — combination pathway activated');
        triggerNote = 'Pain severity crossed the severe threshold. Acetaminophen monotherapy is now insufficient at this intensity. Combination with topical NSAID is now the recommended first-line approach.';
      } else if (multimodalFailure() && !_prev.multimodal) {
        changeFactors.push('Multimodal failure documented — escalation protocol applies');
        triggerNote = 'All non-opioid pathways have been exhausted. Specialist referral is now the appropriate next step before any further pharmacotherapy is initiated.';
      }
      changeMsg = changeFactors.join('. ') || 'Treatment pathway shifted based on updated patient parameters.';
    } else {
      var shiftFactors = [];
      if (P.egfr  !== _prev.egfr)  shiftFactors.push('eGFR: ' + _prev.egfr + ' → ' + P.egfr + ' mL/min (renal risk ' + (P.egfr < _prev.egfr ? 'worsened' : 'improved') + ')');
      if (P.gi    !== _prev.gi)    shiftFactors.push('GI risk reclassified: ' + giLabel());
      if (P.bp    !== _prev.bp)    shiftFactors.push('BP updated: ' + P.bp + ' mmHg (' + bpRiskLabel() + ')');
      if (P.pain  !== _prev.pain)  shiftFactors.push('Pain NRS: ' + _prev.pain + ' → ' + P.pain);
      if (P.adh   !== _prev.adh)   shiftFactors.push('Adherence pattern: ' + adhLabel());
      changeMsg = shiftFactors.length
        ? 'Recommendation unchanged — constraint weighting updated. ' + shiftFactors.join('; ') + '. Review monitoring priorities.'
        : 'Pathway risk profile updated — monitoring requirements and escalation triggers have been recalculated.';
    }

    changeText.textContent = changeMsg;
    changeRow.classList.add('visible');

    var triggerNoteEl   = document.getElementById('ds-trigger-note');
    var triggerNoteText = document.getElementById('ds-trigger-note-text');
    if (triggerNoteEl && triggerNoteText) {
      if (triggerNote && rec.drug !== _prev.recDrug) {
        triggerNoteText.textContent = triggerNote;
        triggerNoteEl.classList.add('visible');
      } else {
        triggerNoteEl.classList.remove('visible');
      }
    }

    buildCausalityPanel();

    var updInd = document.getElementById('cr-updated-indicator');
    if (updInd) {
      updInd.classList.add('visible');
      setTimeout(function() { updInd.classList.remove('visible'); }, 4000);
    }
  } else if (!changed && !_isFirstRun) {
    if (changeRow) changeRow.classList.remove('visible');
    var tnEl = document.getElementById('ds-trigger-note');
    if (tnEl) tnEl.classList.remove('visible');
    var cpEl = document.getElementById('cr-causality-panel');
    if (cpEl) cpEl.classList.remove('visible');
  }

  updateTradeoffStrip();
  updateEscalationTags();

  // Save state snapshot
  _prev.nsaidWasContra = nsaidContraindicated();
  _prev.recDrug        = rec.drug;
  _prev.nsaidState     = nsaidR.state;
  _prev.egfr           = P.egfr;
  _prev.gi             = P.gi;
  _prev.bp             = P.bp;
  _prev.pain           = P.pain;
  _prev.adh            = P.adh;
  _prev.giRisk         = giRisk();
  _prev.bpControl      = bpControl();
  _prev.apapContra     = apapContraindicated();
  _prev.multimodal     = multimodalFailure();
  _prev.complexity     = computeComplexity();
  _isFirstRun = false;
}


/* ════════════════════════════════════════════════════════════
   SECTION 14 — CAUSALITY PANEL
════════════════════════════════════════════════════════════ */

function buildCausalityPanel() {
  var panel = document.getElementById('cr-causality-panel');
  var rows  = document.getElementById('cr-causality-rows');
  if (!panel || !rows) return;

  var items = [];

  if (_prev.egfr !== null && P.egfr !== _prev.egfr) {
    var egfrDir    = P.egfr < _prev.egfr ? 'worse' : 'better';
    var egfrEffect = '';
    if      (P.egfr < 30  && _prev.egfr >= 30)  egfrEffect = 'NSAIDs now absolutely contraindicated · acetaminophen dose ceiling applies';
    else if (P.egfr < 45  && _prev.egfr >= 45)  egfrEffect = 'NSAID pathway unsafe · renal monitoring frequency increased';
    else if (P.egfr >= 60 && _prev.egfr < 60)   egfrEffect = 'Renal risk flag cleared · monitoring interval can be relaxed';
    else                                          egfrEffect = 'Renal risk reclassified · monitoring threshold adjusted';
    items.push({ param:'eGFR', dotClass: egfrDir==='worse'?'dot-red':'dot-green',
      change: _prev.egfr + ' → ' + P.egfr + ' mL/min', dir: egfrDir, effect: egfrEffect });
  }

  if (_prev.gi !== null && P.gi !== _prev.gi) {
    var giDir    = (P.gi==='bleed'||P.gi==='ulcer-recent') ? 'worse' : (P.gi==='none' ? 'better' : 'neutral');
    var giEffect = '';
    if      (giRisk()==='very-high' && _prev.giRisk!=='very-high') giEffect = 'GI risk now critical — NSAIDs are an absolute contraindication; escalation pathway closed';
    else if (giRisk()==='high'      && _prev.giRisk==='low')       giEffect = 'NSAID pathway deprioritized — GI monitoring required at every visit';
    else if (giRisk()==='low'       && _prev.giRisk!=='low')       giEffect = 'GI contraindication resolved — NSAID pathway may now be considered with PPI cover';
    else                                                             giEffect = 'GI risk weighting updated · NSAID reasoning recalculated';
    items.push({ param:'GI History', dotClass: giDir==='worse'?'dot-red': giDir==='better'?'dot-green':'dot-amber',
      change: giLabel(), dir: giDir, effect: giEffect });
  }

  if (_prev.bp !== null && P.bp !== _prev.bp) {
    var bpDir    = P.bp > _prev.bp ? 'worse' : 'better';
    var bpEffect = '';
    if      (bpControl()==='uncontrolled' && _prev.bpControl!=='uncontrolled') bpEffect = 'BP uncontrolled — NSAIDs now contraindicated; amlodipine efficacy risk elevated';
    else if (bpControl()==='controlled'   && _prev.bpControl!=='controlled')   bpEffect = 'BP now controlled — BP-based NSAID contraindication resolved';
    else                                                                         bpEffect = 'BP risk tier changed (' + bpRiskLabel() + ') · NSAID eligibility recalculated';
    items.push({ param:'Blood Pressure', dotClass: bpDir==='worse'?'dot-red':'dot-green',
      change: _prev.bp + ' → ' + P.bp + ' mmHg', dir: bpDir, effect: bpEffect });
  }

  if (_prev.pain !== null && P.pain !== _prev.pain) {
    var painDir    = P.pain > _prev.pain ? 'worse' : 'better';
    var painEffect = '';
    if      (P.pain >= 8 && _prev.pain < 8)  painEffect = 'Severe pain threshold crossed — combination therapy (acetaminophen + topical NSAID) is now indicated';
    else if (P.pain < 8  && _prev.pain >= 8)  painEffect = 'Pain below severe threshold — acetaminophen monotherapy pathway reactivated';
    else if (P.pain >= 6 && _prev.pain < 6)   painEffect = 'Moderate pain confirmed — fixed TID dosing schedule should be enforced';
    else                                        painEffect = 'Analgesic adequacy threshold reassessed at new severity level';
    items.push({ param:'Pain NRS', dotClass: painDir==='worse'?'dot-red':'dot-green',
      change: _prev.pain + '/10 → ' + P.pain + '/10', dir: painDir, effect: painEffect });
  }

  if (_prev.adh !== null && P.adh !== _prev.adh) {
    var adhDir    = P.adh==='poor' ? 'worse' : P.adh==='good' ? 'better' : 'neutral';
    var adhEffect = '';
    if      (P.adh === 'poor') adhEffect = 'Poor adherence shifts pathway toward simplified regimens; Week 4 NRS response is unreliable without consistent dosing';
    else if (P.adh === 'good') adhEffect = 'Good adherence restores validity of treatment response assessment; NRS outcomes now interpretable';
    else                        adhEffect = 'Inconsistent PRN use — fixed schedule counselling required before escalation is considered';
    items.push({ param:'Adherence', dotClass: adhDir==='worse'?'dot-amber':'dot-green',
      change: adhLabel(), dir: adhDir, effect: adhEffect });
  }

  if (items.length === 0) { panel.classList.remove('visible'); return; }

  rows.innerHTML = '';
  items.forEach(function(item) {
    var dirClass = item.dir==='worse'?'cr-delta-worse': item.dir==='better'?'cr-delta-better':'cr-delta-neutral';
    var dotBg    = item.dotClass.indexOf('red')>-1?'var(--red)': item.dotClass.indexOf('green')>-1?'var(--green)':'var(--amber)';
    rows.innerHTML += '<div class="cr-causality-row">' +
      '<div class="cr-causality-param"><span class="cr-causality-param-dot" style="background:' + dotBg + '"></span>' + item.param + '</div>' +
      '<div class="cr-causality-change"><span class="cr-delta-val ' + dirClass + '">' + item.change + '</span></div>' +
      '<div class="cr-causality-effect">' + item.effect + '</div>' +
      '</div>';
  });
  panel.classList.add('visible');
}


/* ════════════════════════════════════════════════════════════
   SECTION 15 — TRADE-OFF STRIP & ESCALATION TAGS
════════════════════════════════════════════════════════════ */

function updateTradeoffStrip() {
  var strip  = document.getElementById('cr-tradeoff-strip');
  var text   = document.getElementById('cr-tradeoff-text');
  var deprio = document.getElementById('cr-tradeoff-deprioritized');
  if (!strip || !text || !deprio) return;

  strip.className = 'cr-tradeoff-strip';

  var cls, msg, dep;
  if (apapContraindicated() && nsaidContraindicated()) {
    cls = 'strip-red'; msg = 'All standard pathways compromised — specialist assessment required before any analgesic is initiated'; dep = 'No safe first-line available';
  } else if (P.egfr < 30) {
    cls = 'strip-red'; msg = 'Renal protection is the overriding constraint — all analgesics are deprioritized pending nephrology input; pain tolerance is being traded for organ safety'; dep = 'NSAIDs + acetaminophen ceiling active';
  } else if (giRisk() === 'very-high') {
    cls = 'strip-red'; msg = 'GI safety is the absolute constraint — maximum GI protection is required; analgesic efficacy is fully subordinated to bleeding risk avoidance'; dep = 'Systemic NSAID pathway closed';
  } else if (multimodalFailure()) {
    cls = 'strip-red'; msg = 'Multimodal failure — pain control need is now the dominant factor; specialist oversight is required before any further pharmacotherapy'; dep = 'Standard pathway exhausted';
  } else if (nsaidContraindicated() && P.adh === 'poor') {
    cls = 'strip-amber'; msg = 'Adherence is now the binding clinical variable — analgesic selection is constrained by GI risk, but therapeutic outcomes are primarily limited by dosing consistency'; dep = 'NSAID escalation + PRN dosing both deprioritized';
  } else if (nsaidContraindicated()) {
    cls = 'strip-amber';
    var reasons = [];
    if (giRisk() !== 'low') reasons.push('GI bleed risk');
    if (P.intol === 'both-nsaid' || P.intol === 'bp-nsaid') reasons.push('BP intolerance documented');
    if (ageFlag()) reasons.push('Beers flag');
    msg = 'GI safety is the binding constraint — analgesic efficacy is being traded for gastrointestinal protection' + (reasons.length ? ' (' + reasons.join(' + ') + ')' : '');
    dep = 'NSAID escalation deprioritized';
  } else if (P.pain >= 8) {
    cls = 'strip-amber'; msg = 'Pain severity is now driving the decision — the trade-off has shifted toward adequate analgesia; combination therapy is now clinically justified despite residual risks'; dep = 'Acetaminophen monotherapy insufficient';
  } else if (bpControl() === 'elevated' || bpControl() === 'mildly-elevated') {
    cls = 'strip-amber'; msg = 'Cardiovascular stability is the active co-constraint — BP management and analgesic safety are competing; amlodipine interaction risk is being monitored'; dep = 'NSAID + high BP combination avoided';
  } else if (P.adh === 'poor') {
    cls = 'strip-amber'; msg = 'Adherence is the primary clinical variable — the therapeutic question is no longer which drug, but whether any drug is being taken consistently enough to assess'; dep = 'Complex regimens deprioritized';
  } else {
    cls = 'strip-green'; msg = 'Risk profile is manageable within the acetaminophen pathway — safety and efficacy goals are currently compatible'; dep = 'No pathways actively deprioritized';
  }

  strip.classList.add(cls);
  text.textContent  = msg;
  deprio.textContent = dep;
}

function updateEscalationTags() {
  function setEscTag(id, text, cls) {
    var el = document.getElementById('ip-esc-' + id);
    if (!el) return;
    if (text) {
      el.textContent = text;
      el.className = 'ip-escalation-tag visible ' + cls;
    } else {
      el.className = 'ip-escalation-tag';
      el.textContent = '';
    }
  }

  if      (P.egfr < 30) setEscTag('egfr', 'NSAIDs: absolute CI', 'esc-critical');
  else if (P.egfr < 45) setEscTag('egfr', 'NSAID-unsafe zone', 'esc-critical');
  else if (P.egfr < 60) setEscTag('egfr', 'Monitor closely', 'esc-monitor');
  else                  setEscTag('egfr', null);

  if      (giRisk() === 'very-high') setEscTag('gi', 'NSAID: absolute CI', 'esc-critical');
  else if (giRisk() === 'high')      setEscTag('gi', 'NSAID pathway closed', 'esc-critical');
  else if (P.gi === 'dyspepsia')     setEscTag('gi', 'Monitor on escalation', 'esc-monitor');
  else                               setEscTag('gi', null);

  if      (bpControl() === 'uncontrolled') setEscTag('bp', 'NSAID: unsafe', 'esc-critical');
  else if (bpControl() === 'elevated')     setEscTag('bp', 'Monitor BP', 'esc-monitor');
  else                                     setEscTag('bp', null);
}


/* ════════════════════════════════════════════════════════════
   SECTION 16 — REVIEW OBJECTIVE BANNER
════════════════════════════════════════════════════════════ */

function updateReviewObjectiveBanner(rec) {
  var objectiveEl = document.getElementById('rob-objective-text');
  var concernEl   = document.getElementById('rob-concern-text');
  var actionEl    = document.getElementById('rob-action-text');
  var actionAltEl = document.getElementById('rob-action-alt');
  if (!objectiveEl) return;

  var objective;
  if (apapContraindicated() && nsaidContraindicated()) {
    objective = 'Identifying safe analgesic pathway when both primary pharmacological options are contraindicated — specialist referral criteria';
  } else if (apapContraindicated()) {
    objective = 'Evaluating NSAID-based analgesic initiation under compound renal and GI risk — monitoring burden assessment';
  } else if (multimodalFailure()) {
    objective = 'Reviewing analgesic options after multimodal pharmacotherapy failure — assessing opioid pathway candidacy and monitoring requirements';
  } else if (P.pain >= 8) {
    objective = 'Managing severe pain under constrained escalation pathway — balancing analgesic adequacy against GI and renal safety';
  } else if (P.egfr < 45) {
    objective = 'Assessing analgesic safety under moderate-to-severe renal impairment — renal dose adjustment and pathway restriction review';
  } else if (egfrRisk() !== 'low' && giRisk() !== 'low') {
    objective = 'Evaluating analgesic safety under compound renal and GI constraint — assessing acetaminophen adequacy and escalation threshold';
  } else if (giRisk() !== 'low') {
    objective = 'Balancing analgesic efficacy against GI safety — reviewing therapy initiation and monitoring frequency in high-risk GI profile';
  } else {
    objective = 'Reviewing analgesic initiation in polypharmacy context — assessing drug interactions, monitoring burden, and escalation readiness';
  }
  objectiveEl.textContent = objective;

  var concern;
  if      (P.egfr < 30)                                      concern = 'Severe renal impairment (eGFR ' + P.egfr + ') · Analgesic pathway critically narrowed';
  else if (apapContraindicated() && nsaidContraindicated())   concern = 'Both primary analgesic pathways closed · Specialist review required';
  else if (giRisk() === 'very-high')                          concern = 'Active GI bleeding risk · All NSAIDs absolutely contraindicated';
  else if (P.egfr < 45 && giRisk() !== 'low')                concern = 'Compound renal + GI risk · NSAID pathway closed · Escalation pathway narrowing';
  else if (P.egfr < 60 && giRisk() !== 'low')                concern = 'Progressive renal decline · NSAID pathway closed';
  else if (P.pain >= 8 && nsaidContraindicated())             concern = 'Severe pain · Escalation options severely constrained';
  else if (egfrRisk() !== 'low')                              concern = 'Renal impairment (eGFR ' + P.egfr + ') · Monitoring burden elevated';
  else if (giRisk() !== 'low')                                concern = 'GI safety risk · NSAID class contraindicated';
  else                                                         concern = 'Polypharmacy burden · Adherence and interaction monitoring required';
  concernEl.textContent = concern;

  var action, actionAlt;
  if (apapContraindicated() && nsaidContraindicated()) {
    action = 'Initiate specialist referral — no safe first-line analgesic available';
    actionAlt = 'Deprescribing review + pain team input';
  } else if (apapContraindicated()) {
    action = 'Consider low-dose NSAID + PPI cover — monitor renal and GI closely';
    actionAlt = 'Review in 2 weeks — eGFR + GI symptoms';
  } else if (multimodalFailure()) {
    action = 'Reassess opioid pathway candidacy — specialist oversight recommended';
    actionAlt = 'Consider deprescribing concurrent agents before opioid initiation';
  } else if (P.egfr < 45) {
    action = 'Dose-adjust acetaminophen — max ' + (P.egfr < 30 ? '2' : '2.5') + ' g/day — reassess renal function at 2 weeks';
    actionAlt = 'Avoid all NSAIDs — renal risk prohibitive';
  } else if (P.pain >= 8 && !apapContraindicated()) {
    action = 'Escalate to topical diclofenac gel if acetaminophen inadequate at Week 4';
    actionAlt = 'Monitor NRS at Week 2 before escalation decision';
  } else {
    action = 'Initiate acetaminophen TID — obtain baseline eGFR today';
    actionAlt = 'Review at Week 2 before escalation decision';
  }
  actionEl.textContent = action;
  if (actionAltEl) actionAltEl.textContent = actionAlt;
}


/* ════════════════════════════════════════════════════════════
   SECTION 17 — PHARMACIST INTERVENTION PANEL
════════════════════════════════════════════════════════════ */

function updateInterventionPanel(rec) {
  var complexity = computeComplexity();

  // Priority classification
  var priorityClass, priorityLabel, tierClass, tierLabel;
  if (apapContraindicated() && nsaidContraindicated()) {
    priorityClass = 'pi-prio-high';     priorityLabel = 'Urgent — no safe first-line identified';
    tierClass = 'pi-tier-urgent'; tierLabel = 'Urgent';
  } else if (P.egfr < 30 || giRisk() === 'very-high') {
    priorityClass = 'pi-prio-high';     priorityLabel = 'High priority — renal / GI safety concern';
    tierClass = 'pi-tier-urgent'; tierLabel = 'High';
  } else if (P.egfr < 45 || (nsaidContraindicated() && P.pain >= 7)) {
    priorityClass = 'pi-prio-elevated'; priorityLabel = 'Elevated — review before next prescribing';
    tierClass = 'pi-tier-high'; tierLabel = 'Elevated';
  } else if (nsaidContraindicated() || P.adh === 'poor' || complexity >= 60) {
    priorityClass = 'pi-prio-monitor';  priorityLabel = 'Monitor — Week 2 contact required';
    tierClass = 'pi-tier-monitor'; tierLabel = 'Monitor';
  } else if (P.pain >= 6 || P.adh === 'partial') {
    priorityClass = 'pi-prio-monitor';  priorityLabel = 'Follow-up at Week 2';
    tierClass = 'pi-tier-monitor'; tierLabel = 'Follow-up';
  } else {
    priorityClass = 'pi-prio-routine';  priorityLabel = 'Routine review';
    tierClass = 'pi-tier-routine'; tierLabel = 'Routine';
  }

  var tierBadge = document.getElementById('pi-priority-tier-badge');
  if (tierBadge) { tierBadge.className = 'pi-priority-tier ' + tierClass; tierBadge.textContent = tierLabel; }

  var badge   = document.getElementById('pi-priority-badge');
  var labelEl = document.getElementById('pi-priority-label');
  if (badge)   badge.className = 'pi-priority-badge ' + priorityClass;
  if (labelEl) labelEl.textContent = priorityLabel;

  // Sidebar status
  var sidebarDot  = document.getElementById('dp-intervention-status-dot');
  var sidebarText = document.getElementById('dp-intervention-status-text');
  if (sidebarDot && sidebarText) {
    sidebarDot.className = 'dp-risk-dot';
    if (priorityClass === 'pi-prio-high') {
      sidebarDot.classList.add('dp-risk-dot-red');
      sidebarText.textContent = 'Act now — safety intervention required';
    } else if (priorityClass === 'pi-prio-elevated') {
      sidebarDot.classList.add('dp-risk-dot-amber');
      sidebarText.textContent = 'Review before next prescribing contact';
    } else if (priorityClass === 'pi-prio-monitor') {
      sidebarDot.classList.add('dp-risk-dot-amber');
      sidebarText.textContent = 'Week 2 follow-up — confirm adherence + eGFR';
    } else {
      sidebarDot.classList.add('dp-risk-dot-green');
      sidebarText.textContent = 'Routine review — no urgent action';
    }
  }

  // Action verb
  var actionVerbEl = document.getElementById('pi-action-verb');
  if (actionVerbEl) {
    if (apapContraindicated() && nsaidContraindicated()) actionVerbEl.textContent = 'Refer — specialist input needed';
    else if (P.egfr < 30)                               actionVerbEl.textContent = 'Dose-adjust and escalate monitoring';
    else if (P.egfr < 45)                               actionVerbEl.textContent = 'Dose-reduce — renal risk active';
    else if (multimodalFailure())                        actionVerbEl.textContent = 'Review pathway — specialist input';
    else if (P.pain >= 8 && !apapContraindicated())      actionVerbEl.textContent = 'Escalate if not controlled at Wk 4';
    else                                                 actionVerbEl.textContent = 'Initiate today';
  }

  // Panel title
  var titleEl = document.getElementById('pi-title');
  if (titleEl) {
    if (apapContraindicated() && nsaidContraindicated()) titleEl.textContent = 'Medication Review — Specialist Pathway Assessment';
    else if (P.egfr < 45)                               titleEl.textContent = 'Medication Review — Renal Safety Assessment';
    else if (multimodalFailure())                        titleEl.textContent = 'Medication Review — Deprescribing & Escalation Review';
    else if (P.pain >= 8)                                titleEl.textContent = 'Medication Review — Analgesic Escalation Assessment';
    else                                                 titleEl.textContent = 'Medication Review — Analgesic Safety Assessment';
  }

  // Main intervention + sub-actions
  var mainEl = document.getElementById('pi-intervention-main');
  var sub1El = document.getElementById('pi-sub-1');
  var sub2El = document.getElementById('pi-sub-2');
  var sub3El = document.getElementById('pi-sub-3');

  var mainText, sub1, sub2, sub3, sub1Dot, sub2Dot, sub3Dot;
  if (apapContraindicated() && nsaidContraindicated()) {
    mainText='Initiate specialist referral — no safe first-line analgesic identified'; sub1='Review full medication list for deprescribing opportunities'; sub2='Consider pain medicine or rheumatology co-management'; sub3='Hold analgesic escalation pending specialist input';
    sub1Dot='pi-dot-red'; sub2Dot='pi-dot-amber'; sub3Dot='pi-dot-amber';
  } else if (apapContraindicated()) {
    mainText='Initiate low-dose NSAID + PPI cover — intensive monitoring pathway'; sub1='eGFR check at 2 weeks — flag any decline ≥10%'; sub2='GI symptom review at every contact'; sub3='Do not deprescribe PPI — GI risk remains active';
    sub1Dot='pi-dot-red'; sub2Dot='pi-dot-amber'; sub3Dot='pi-dot-amber';
  } else if (multimodalFailure()) {
    mainText='Reassess analgesic pathway — consider deprescribing review'; sub1='Review all 7 concurrent agents for interaction burden'; sub2='Opioid candidacy requires sedation risk reassessment'; sub3='Document failure rationale before next escalation';
    sub1Dot='pi-dot-amber'; sub2Dot='pi-dot-amber'; sub3Dot='pi-dot-blue';
  } else if (P.egfr < 30) {
    mainText='Dose-adjust acetaminophen to 2 g/day max — nephrology review'; sub1='Weekly eGFR monitoring — all renally-cleared drugs at risk'; sub2='Avoid NSAIDs absolutely — prostaglandin-dependent renal perfusion'; sub3='Review entire medication list for renal dose adjustment';
    sub1Dot='pi-dot-red'; sub2Dot='pi-dot-red'; sub3Dot='pi-dot-amber';
  } else if (P.egfr < 45) {
    mainText='Dose-reduce acetaminophen to 2.5 g/day — intensify renal follow-up'; sub1='Renal function check at 2 and 4 weeks'; sub2='NSAID pathway closed — renal risk prohibitive at eGFR ' + P.egfr; sub3='Document eGFR trajectory before Month 3 review';
    sub1Dot='pi-dot-red'; sub2Dot='pi-dot-red'; sub3Dot='pi-dot-amber';
  } else if (P.pain >= 8 && !apapContraindicated()) {
    mainText='Escalate to topical diclofenac gel — if acetaminophen inadequate at Week 4'; sub1='Confirm fixed-schedule acetaminophen use before escalation decision'; sub2='eGFR recheck before topical NSAID — confirm eGFR ≥50'; sub3='Document pain trajectory from NRS baseline';
    sub1Dot='pi-dot-amber'; sub2Dot='pi-dot-amber'; sub3Dot='pi-dot-blue';
  } else {
    mainText='Initiate acetaminophen TID (fixed schedule) — obtain baseline eGFR today'; sub1='Obtain baseline eGFR before Week 2 contact'; sub2='Confirm adherence at Week 2 — do not escalate on PRN use'; sub3='Maintain pantoprazole 40 mg — do not deprescribe at this stage';
    sub1Dot='pi-dot-amber'; sub2Dot='pi-dot-amber'; sub3Dot='pi-dot-blue';
  }

  if (mainEl) mainEl.textContent = mainText;
  function setSub(el, text, dotClass) {
    if (!el) return;
    el.textContent = text;
    var dotEl = el.previousElementSibling;
    if (dotEl) dotEl.className = 'pi-sub-dot ' + dotClass;
  }
  setSub(sub1El, sub1, sub1Dot);
  setSub(sub2El, sub2, sub2Dot);
  setSub(sub3El, sub3, sub3Dot);

  // Urgency items
  var urgencyContainer = document.getElementById('pi-urgency-items');
  if (urgencyContainer) {
    var urgencyItems = [];
    if      (P.egfr < 30)      urgencyItems.push({ cls:'urg-red',   text:'<strong>Severe renal impairment (eGFR ' + P.egfr + ')</strong> — dose-adjust all renally-cleared drugs now; acetaminophen ceiling 2 g/day' });
    else if (P.egfr < 45)      urgencyItems.push({ cls:'urg-red',   text:'<strong>eGFR ' + P.egfr + ' — moderate CKD</strong> — NSAID pathway closed; check renal function at 2 and 4 weeks' });
    else if (P.egfr < 60)      urgencyItems.push({ cls:'urg-amber', text:'<strong>eGFR ' + P.egfr + ' — CKD Stage 3a</strong> — no prior trend; order baseline today, recheck at Week 6 before any escalation decision' });

    if      (giRisk()==='very-high') urgencyItems.push({ cls:'urg-red',   text:'<strong>Active or recent GI bleed</strong> — NSAIDs absolutely contraindicated; check GI symptoms at every contact' });
    else if (giRisk()==='high')      urgencyItems.push({ cls:'urg-amber', text:'<strong>Prior peptic ulcer — GI risk high</strong> — NSAIDs contraindicated; maintain PPI cover, do not deprescribe pantoprazole' });

    if (nsaidContraindicated() && P.pain >= 7)
      urgencyItems.push({ cls:'urg-amber', text:'<strong>NRS ' + P.pain + '/10 with NSAID pathway closed</strong> — escalation options are narrow; document pain trajectory at Wk 2 before next decision' });
    else if (P.pain >= 8)
      urgencyItems.push({ cls:'urg-amber', text:'<strong>Severe pain (NRS ' + P.pain + '/10)</strong> — acetaminophen monotherapy likely inadequate; combination threshold reached at Week 4' });

    if      (P.adh === 'poor')    urgencyItems.push({ cls:'urg-amber', text:'<strong>Poor adherence</strong> — do not escalate until confirmed at Week 2; Week 4 NRS cannot be interpreted without dosing verification' });
    else if (P.adh === 'partial') urgencyItems.push({ cls:'urg-blue',  text:'<strong>Inconsistent PRN use</strong> — prescribe TID fixed schedule today; subtherapeutic exposure will confound Week 4 review' });

    if (complexity >= 75)  urgencyItems.push({ cls:'urg-amber', text:'<strong>7-agent regimen — high complexity</strong> — review for interaction burden; deprescribing candidates: identify at Month 3 review' });
    if (multimodalFailure()) urgencyItems.push({ cls:'urg-red',  text:'<strong>All non-opioid options exhausted</strong> — specialist referral required before any further pharmacotherapy' });

    if (urgencyItems.length === 0)
      urgencyItems.push({ cls:'urg-blue', text:'<strong>No escalating concern identified</strong> — standard monitoring schedule applies; review at Week 2 as planned' });

    urgencyContainer.innerHTML = urgencyItems.map(function(item) {
      return '<div class="pi-urgency-item ' + item.cls + '">' +
        '<svg class="pi-urgency-icon" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>' +
        '<span>' + item.text + '</span></div>';
    }).join('');
  }

  // Follow-up consequence items
  var followupContainer = document.getElementById('pi-followup-items');
  if (followupContainer) {
    var followupItems = [];
    if      (P.egfr < 45) followupItems.push({ strong:'Missed dose-adjustment window',      text:' — eGFR may continue to decline without dose ceiling in place; accumulation risk increases' });
    else if (P.egfr < 60) followupItems.push({ strong:'Escalation decision without renal data',   text:' — baseline eGFR not available; cannot confirm eGFR ≥50 required for topical NSAID at Wk 4' });

    if (giRisk() !== 'low')
      followupItems.push({ strong:'Analgesic use without GI reassessment', text:' — prolonged PPI omission or analgesic substitution may go undetected' });

    if (P.adh === 'partial' || P.adh === 'poor')
      followupItems.push({ strong:'Week 4 escalation decision becomes invalid', text:' — cannot distinguish treatment failure from subtherapeutic dosing without adherence confirmation at Wk 2' });

    if (nsaidContraindicated() && P.pain >= 6)
      followupItems.push({ strong:'Pain uncontrolled — no objective reassessment',  text:' — NRS trajectory unknown; escalation timing window may close with further renal decline' });

    if (complexity >= 70)
      followupItems.push({ strong:'Interaction risk unreviewed', text:' — 7-agent regimen; any new prescription requires interaction check against current list' });

    if (followupItems.length === 0)
      followupItems.push({ strong:'Pain review delayed', text:' — NRS trajectory at Week 2 is the first data point for escalation decision; delay pushes this to Month 3 review' });

    followupContainer.innerHTML = followupItems.map(function(item) {
      return '<div class="pi-followup-item">' +
        '<span class="pi-followup-arrow">›</span>' +
        '<span><strong>' + item.strong + '</strong>' + item.text + '</span>' +
        '</div>';
    }).join('');
  }

  // Next contact text
  var nextContactEl = document.getElementById('pi-next-contact-text');
  if (nextContactEl) {
    if      (P.egfr < 30) nextContactEl.textContent = 'Next contact: 1 week — eGFR + safety review + dose check';
    else if (P.egfr < 45) nextContactEl.textContent = 'Next contact: 2 weeks — eGFR + dose-adjustment confirmation';
    else                  nextContactEl.textContent = 'Week 2 — confirm TID adherence, NRS, eGFR status. Do not escalate until adherence verified.';
  }

  // Action pathway steps
  var pathwayStepsEl = document.getElementById('pi-pathway-steps');
  var pathwayNoteEl  = document.getElementById('pi-pathway-note');
  if (pathwayStepsEl) {
    var steps;
    if (apapContraindicated() && nsaidContraindicated()) {
      steps = [
        { label:'NSAIDs — CI', cls:'pi-step-closed' }, { label:'Acetaminophen — CI', cls:'pi-step-closed' },
        { label:'Specialist Referral', cls:'pi-step-active' }, { label:'Deprescribing Review', cls:'pi-step-conditional' }
      ];
      if (pathwayNoteEl) pathwayNoteEl.textContent = 'Refer to pain medicine or rheumatology before initiating further pharmacotherapy';
    } else if (P.egfr < 30) {
      steps = [
        { label:'NSAIDs — absolute CI', cls:'pi-step-closed' }, { label:'Acetaminophen ≤2 g/day', cls:'pi-step-active' },
        { label:'Nephrology review', cls:'pi-step-conditional' }
      ];
      if (pathwayNoteEl) pathwayNoteEl.textContent = 'Renal protection is the overriding priority; analgesic ceiling applies at all stages';
    } else if (multimodalFailure()) {
      steps = [
        { label:'NSAIDs — CI', cls:'pi-step-closed' }, { label:'Acetaminophen — failed', cls:'pi-step-closed' },
        { label:'Deprescribing review', cls:'pi-step-active' }, { label:'Opioid candidacy assessment', cls:'pi-step-conditional' }
      ];
      if (pathwayNoteEl) pathwayNoteEl.textContent = 'Opioid pathway candidacy requires specialist oversight — document all failure rationale first';
    } else if (P.pain >= 8 && !apapContraindicated()) {
      steps = [
        { label:'Acetaminophen TID', cls:'pi-step-active' }, { label:'Topical diclofenac gel (Wk 4)', cls:'pi-step-conditional' },
        { label:'Duloxetine 30–60 mg', cls:'pi-step-conditional' }, { label:'NSAIDs — CI', cls:'pi-step-closed' }
      ];
      if (pathwayNoteEl) pathwayNoteEl.textContent = 'Escalate to topical diclofenac at Week 4 if NRS ≥6 on confirmed TID use; eGFR ≥50 required';
    } else {
      steps = [
        { label:'Acetaminophen TID — now', cls:'pi-step-active' }, { label:'Topical diclofenac (Wk 4+)', cls:'pi-step-conditional' },
        { label:'Duloxetine 30 mg (neuropathic)', cls:'pi-step-conditional' }, { label:'NSAIDs — CI', cls:'pi-step-closed' }
      ];
      if (pathwayNoteEl) pathwayNoteEl.textContent = 'Wk 2: confirm adherence + NRS · Wk 4: escalation decision if NRS ≥6 or inadequate response on TID schedule';
    }

    pathwayStepsEl.innerHTML = steps.map(function(step, i) {
      var arrow = i < steps.length - 1 ? '<span class="pi-pathway-arrow">›</span>' : '';
      return '<span class="pi-pathway-step ' + step.cls + '">' + step.label + '</span>' + arrow;
    }).join('');
  }
}


/* ════════════════════════════════════════════════════════════
   SECTION 18 — HANDOFF SECTION
════════════════════════════════════════════════════════════ */

var _activeHandoffType = 'pharmacist';

function selectHandoffType(type, btn) {
  document.querySelectorAll('.hf-doc-type').forEach(function(b) { b.classList.remove('active'); });
  btn.classList.add('active');
  _activeHandoffType = type;

  var docIds = ['pharmacist','monitoring','escalation','attending','risk','rationale','followup'];
  docIds.forEach(function(id) {
    var el = document.getElementById('hf-doc-' + id);
    if (el) el.style.display = (id === type) ? 'block' : 'none';
  });
}

function copyHandoffDocument() {
  var doc = document.getElementById('hf-doc-' + _activeHandoffType);
  if (!doc) return;

  var lines = [];
  var header = doc.querySelector('.hf-doc-title');
  var sub    = doc.querySelector('.hf-doc-subtitle');
  if (header) lines.push(header.textContent.toUpperCase());
  if (sub)    lines.push(sub.textContent);
  lines.push('');

  doc.querySelectorAll('.hf-section').forEach(function(section) {
    var headEl = section.querySelector('.hf-section-head');
    if (headEl) lines.push('── ' + headEl.textContent.trim() + ' ──');
    section.querySelectorAll('.hf-line, .hf-line-flag, .hf-action-item, .hf-risk-row').forEach(function(el) {
      lines.push(el.textContent.trim().replace(/\s+/g,' '));
    });
    var callout = section.querySelector('.hf-amber-callout, .hf-escalation-callout');
    if (callout) lines.push(callout.textContent.trim().replace(/\s+/g,' '));
    lines.push('');
  });

  var sig = doc.querySelector('.hf-sig-block');
  if (sig) { lines.push('──'); lines.push(sig.textContent.trim().replace(/\s+/g,' ')); }

  var text = lines.join('\n');
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(function() {
      var btns = doc.querySelectorAll('.hf-copy-btn');
      btns.forEach(function(btn) {
        btn.classList.add('copied');
        btn.textContent = 'Copied';
        setTimeout(function() {
          btn.classList.remove('copied');
          btn.innerHTML = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy';
        }, 2000);
      });
    });
  }
}

function updateHandoffMeta() {
  var painEl    = document.getElementById('hf-meta-pain');
  var egfrEl    = document.getElementById('hf-meta-egfr');
  var complexEl = document.getElementById('hf-meta-complexity');

  if (painEl) {
    painEl.textContent = P.pain + ' / 10';
    painEl.className = 'hf-meta-val ' + (P.pain >= 8 ? 'val-red' : P.pain >= 6 ? 'val-amber' : 'val-green');
  }
  if (egfrEl) {
    egfrEl.textContent = P.egfr + ' mL/min';
    egfrEl.className = 'hf-meta-val ' + (P.egfr < 45 ? 'val-red' : P.egfr < 60 ? 'val-amber' : 'val-green');
  }
  if (complexEl) {
    var score = computeComplexity();
    complexEl.textContent = score + ' / 100';
    complexEl.className = 'hf-meta-val ' + (score >= 75 ? 'val-red' : score >= 50 ? 'val-amber' : 'val-green');
  }
}


/* ════════════════════════════════════════════════════════════
   SECTION 19 — POLYPHARMACY & INTERACTIONS ENGINE
════════════════════════════════════════════════════════════ */

function updatePolypharmacyPanel() {
  updateRenalCascadeHighlight();
  updatePolyBurdenBadge();
  updatePolyInteractionFlags();
  updatePolyMonitoringBanner();
  updateReactiveDoseLabels();
}

function updateRenalCascadeHighlight() {
  ['renal-row-60plus','renal-row-4559','renal-row-3044','renal-row-under30'].forEach(function(id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('renal-active-row');
    var egfrCell = el.querySelector('.renal-cascade-egfr');
    if (egfrCell) egfrCell.classList.remove('egfr-current');
    var marker = el.querySelector('.renal-active-marker');
    if (marker) marker.style.display = 'none';
  });

  var activeId;
  if      (P.egfr >= 60) activeId = 'renal-row-60plus';
  else if (P.egfr >= 45) activeId = 'renal-row-4559';
  else if (P.egfr >= 30) activeId = 'renal-row-3044';
  else                   activeId = 'renal-row-under30';

  var activeEl = document.getElementById(activeId);
  if (activeEl) {
    activeEl.classList.add('renal-active-row');
    var egfrCell = activeEl.querySelector('.renal-cascade-egfr');
    if (egfrCell) egfrCell.classList.add('egfr-current');
    var marker = activeEl.querySelector('.renal-active-marker');
    if (!marker) {
      egfrCell = activeEl.querySelector('.renal-cascade-egfr');
      if (egfrCell) {
        var m = document.createElement('span');
        m.className = 'renal-active-marker';
        m.textContent = 'CURRENT';
        egfrCell.appendChild(m);
      }
    } else {
      marker.style.display = '';
    }
  }

  var inlineEgfr = document.getElementById('poly-egfr-inline');
  if (inlineEgfr) inlineEgfr.textContent = P.egfr;
  var currentEgfrLabel = document.getElementById('poly-renal-current-egfr');
  if (currentEgfrLabel) currentEgfrLabel.textContent = 'Current eGFR: ' + P.egfr + ' mL/min';
}

function updatePolyBurdenBadge() {
  var badge = document.getElementById('poly-burden-badge');
  if (badge) {
    var complexity = computeComplexity();
    if (complexity >= 70 || P.egfr < 30) {
      badge.className = 'poly-burden-badge burden-high'; badge.textContent = 'High burden';
    } else if (complexity >= 45 || P.egfr < 50 || nsaidContraindicated()) {
      badge.className = 'poly-burden-badge burden-mod';  badge.textContent = 'Moderate burden';
    } else {
      badge.className = 'poly-burden-badge burden-low';  badge.textContent = 'Low burden';
    }
  }

  // Interaction rail
  var intVal  = document.getElementById('poly-rail-int-val');
  var intNote = document.getElementById('poly-rail-int-note');
  var intRail = document.getElementById('poly-rail-interactions');
  if (intVal && intNote) {
    if (nsaidContraindicated()) {
      intVal.textContent  = '0 active interactions';
      intNote.textContent = 'Amlodipine–NSAID interaction fully prevented by NSAID exclusion. Acetaminophen carries no clinically significant interactions with current regimen.';
      if (intRail) intRail.className = 'safety-rail-item srl-green';
    } else {
      intVal.textContent  = '1–2 monitor-level pairs';
      intNote.textContent = 'NSAID pathway conditionally accessible — amlodipine–NSAID BP interaction monitoring required if initiated. Review before prescribing.';
      if (intRail) intRail.className = 'safety-rail-item srl-amber';
    }
  }

  // Renal rail
  var renalVal  = document.getElementById('poly-rail-renal-val');
  var renalNote = document.getElementById('poly-rail-renal-note');
  var renalRail = document.getElementById('poly-rail-renal');
  if (renalVal && renalNote) {
    if (P.egfr < 30) {
      renalVal.textContent  = '2 adjustments active';
      renalNote.textContent = 'Severe renal impairment — APAP ceiling 2 g/day, all NSAIDs absolutely contraindicated, opioid metabolite accumulation risk. Nephrology input required.';
      if (renalRail) renalRail.className = 'safety-rail-item srl-red';
    } else if (P.egfr < 45) {
      renalVal.textContent  = '2 adjustments active';
      renalNote.textContent = 'Moderate CKD — APAP max 2.5 g/day, NSAIDs absolutely contraindicated, close monitoring required. Nephrology co-management if declining.';
      if (renalRail) renalRail.className = 'safety-rail-item srl-red';
    } else if (P.egfr < 60) {
      renalVal.textContent  = '1 dose ceiling active';
      renalNote.textContent = 'Acetaminophen ceiling at 3 g/day (older adult + G3a CKD). NSAIDs excluded — renal constraint plus documented intolerance. Monitor eGFR trajectory 6-weekly.' + (P.egfr >= 50 && P.egfr <= 62 ? ' Trajectory unconfirmed — no prior eGFR on record.' : '');
      if (renalRail) renalRail.className = 'safety-rail-item srl-amber';
    } else {
      renalVal.textContent  = 'Standard dosing';
      renalNote.textContent = 'eGFR ≥60 — standard analgesic dosing permissible on renal grounds. Age-adjusted ceiling (older adult 3 g/day) still applies.';
      if (renalRail) renalRail.className = 'safety-rail-item srl-green';
    }
  }
}

function updatePolyInteractionFlags() {
  var amlNsaidFlag   = document.getElementById('poly-aml-nsaid-flag');
  var amlNsaidDetail = document.getElementById('poly-aml-nsaid-detail');
  var intSev         = document.getElementById('poly-int-aml-nsaid-sev');
  var intMech        = document.getElementById('poly-int-aml-nsaid-mech');

  if (nsaidContraindicated()) {
    if (amlNsaidFlag)   { amlNsaidFlag.className = 'poly-interaction-flag poly-flag-green'; amlNsaidFlag.textContent = '✓ NSAID excluded — interaction prevented'; }
    if (amlNsaidDetail) amlNsaidDetail.textContent = 'NSAIDs are contraindicated in this patient profile. The amlodipine–NSAID interaction is fully mitigated by NSAID exclusion. No monitoring required for this pair on current regimen.';
    if (intSev) { intSev.className = 'poly-int-severity poly-int-sev-ok'; intSev.textContent = 'Risk eliminated'; }
    if (intMech) intMech.textContent = 'NSAIDs excluded from this patient\'s regimen due to documented intolerance and contraindication profile. Amlodipine antihypertensive efficacy is therefore not at risk. This interaction becomes clinically relevant again only if NSAID restrictions are revisited — which would require specialist review.';
  } else {
    if (amlNsaidFlag)   { amlNsaidFlag.className = 'poly-interaction-flag poly-flag-amber'; amlNsaidFlag.textContent = '⚠ NSAID: monitor BP'; }
    if (amlNsaidDetail) amlNsaidDetail.textContent = 'NSAIDs are conditionally accessible at current parameters. If initiated: BP monitoring at 2 weeks is mandatory. Prior response (+18 mmHg with diclofenac) indicates high individual sensitivity.';
    if (intSev) { intSev.className = 'poly-int-severity poly-int-sev-avoid'; intSev.textContent = 'Monitor closely'; }
    if (intMech) intMech.textContent = 'NSAIDs impair prostaglandin-mediated vasodilation and promote sodium retention, opposing CCB antihypertensive effect. In this patient, diclofenac previously caused +18 mmHg systolic rise. If NSAID pathway becomes necessary: low-dose, shortest duration, BP check at 2 weeks.';
  }
}

function updateReactiveDoseLabels() {
  var apapLabel  = document.getElementById('poly-apap-renal-label');
  var apapDetail = document.getElementById('poly-apap-renal-detail');
  if (apapLabel && apapDetail) {
    if (P.egfr < 30) {
      apapLabel.className = 'poly-renal-dose renal-ci';
      apapLabel.textContent = 'Dose reduction required (eGFR ' + P.egfr + ')';
      apapDetail.textContent = 'Max 2 g/day with extended dosing interval (every 6–8 hours). Avoid combination with hepatotoxic agents. Monitor LFTs at 4 weeks. Nephrology input required before any analgesic escalation.';
    } else if (P.egfr < 45) {
      apapLabel.className = 'poly-renal-dose renal-adjust';
      apapLabel.textContent = 'Dose ceiling reduced (eGFR ' + P.egfr + ')';
      apapDetail.textContent = 'Max 2.5 g/day — moderate CKD with declining renal function. Monitor LFTs. Avoid co-prescribing other hepatotoxic agents. Extend interval to every 6 hours if needed.';
    } else if (P.egfr < 60) {
      apapLabel.className = 'poly-renal-dose renal-adjust';
      apapLabel.textContent = 'Dose ceiling active (eGFR ' + P.egfr + ')';
      apapDetail.textContent = 'Max 3 g/day — older adult + G3a CKD ceiling. Standard elderly limit applies. Monitor eGFR trajectory every 6 weeks. If eGFR drops below 45, tighten ceiling to 2.5 g/day.';
    } else {
      apapLabel.className = 'poly-renal-dose renal-ok';
      apapLabel.textContent = 'Standard older-adult dose (eGFR ' + P.egfr + ')';
      apapDetail.textContent = 'Max 3 g/day (older adult ceiling applies regardless of eGFR at age ' + P.age + '). Renal function is not the dose-limiting factor at current eGFR.';
    }
  }
}

function updatePolyMonitoringBanner() {
  var banner   = document.getElementById('poly-monitoring-banner');
  var label    = document.getElementById('poly-mib-label');
  var text     = document.getElementById('poly-mib-text');
  var schedule = document.getElementById('poly-mib-schedule');
  if (!banner || !label || !text || !schedule) return;

  var complexity           = computeComplexity();
  var renalTrendUnknown    = (P.egfr >= 50 && P.egfr <= 62);
  var adherenceUnverified  = (P.adh === 'partial' || P.adh === 'unknown');

  if (P.egfr < 30 || complexity >= 75) {
    banner.className = 'monitoring-intensity-banner mib-high';
    label.textContent = 'High intensity';
    text.textContent = 'Severely impaired renal function and high overall complexity require compressed monitoring intervals. Post-change labs within 2 weeks. Any new drug addition at this stage requires nephrology and pharmacy co-review before prescribing.';
    schedule.textContent = 'Labs at 2 weeks + 4 weeks';
  } else if (P.egfr < 45 || (nsaidContraindicated() && P.bp >= 150)) {
    banner.className = 'monitoring-intensity-banner mib-high';
    label.textContent = 'Elevated intensity';
    text.textContent = 'Moderate CKD with eGFR ' + P.egfr + ' mL/min and NSAID contraindication active. Post-change monitoring prioritises renal trajectory and analgesic tolerability. eGFR at 4 weeks is a non-optional safety check.';
    schedule.textContent = 'eGFR at 4 weeks · BP monthly';
  } else if (complexity >= 50 || P.adh === 'poor') {
    banner.className = 'monitoring-intensity-banner mib-mod';
    label.textContent = 'Moderate intensity';
    if (P.adh === 'poor') {
      text.textContent = 'Poor adherence history is the dominant monitoring concern at this stage — monitoring intensity is driven by adherence verification, not drug interaction risk. Confirm fixed schedule at week 2 before any dose titration or escalation decision.';
      schedule.textContent = 'Adherence check wk 2 · Labs wk 6';
    } else {
      text.textContent = 'Moderate complexity profile — renal trajectory and GI tolerability are the primary monitoring concerns. Post-change assessment should confirm acetaminophen tolerability and GI stability at week 2, with eGFR and LFT at 6 weeks.';
      schedule.textContent = 'Clinical wk 2 · Labs wk 6';
    }
  } else if (renalTrendUnknown && adherenceUnverified) {
    banner.className = 'monitoring-intensity-banner mib-mod';
    label.textContent = 'Moderate intensity — uncertainty-adjusted';
    text.textContent = 'Profile would warrant routine monitoring on documented parameters alone, but two unresolved uncertainties increase caution: (1) eGFR ' + P.egfr + ' sits at the G2/G3a boundary with no prior result to establish trend direction; (2) adherence is self-reported and unverified. Monitoring is treated as moderate until both are confirmed. Do not defer baseline labs.';
    schedule.textContent = 'Baseline labs Day 1 · Adherence wk 2 · eGFR wk 6';
  } else if (renalTrendUnknown) {
    banner.className = 'monitoring-intensity-banner mib-mod';
    label.textContent = 'Moderate intensity — renal trend unconfirmed';
    text.textContent = 'Renal function sits at the G2/G3a boundary (eGFR ' + P.egfr + ') without prior measurements to establish trajectory. Monitoring is conservatively elevated until at least one follow-up eGFR establishes whether function is stable, improving, or declining. Obtain baseline labs at this visit.';
    schedule.textContent = 'Baseline eGFR Day 1 · Recheck wk 6';
  } else {
    banner.className = 'monitoring-intensity-banner mib-routine';
    label.textContent = 'Routine intensity';
    text.textContent = 'Current regimen change carries low pharmacological risk. Monitoring is standard for this complexity level — adherence confirmation at week 2 and routine labs at 6 weeks are appropriate. No compressed monitoring intervals required.';
    schedule.textContent = 'Review wk 2 · Labs wk 6';
  }
}


/* ════════════════════════════════════════════════════════════
   SECTION 20 — LONGITUDINAL PROGRESSION ENGINE
════════════════════════════════════════════════════════════ */

var P_BASELINE    = null;
var LP_CURRENT_TP = 0;

var LP_TIMEPOINTS = [
  {
    idx: 0, label: 'Day 1', sublabel: 'Initiation visit',
    drift: {}, delta: null,
    pathwayStates:   ['active','future','future','future','future'],
    pathwayOutcomes: [null, null, null, null, null],
    missed: false
  },
  {
    idx: 1, label: 'Week 2', sublabel: 'Pain & adherence review',
    drift: { pain: -1, adh: 'partial' },
    delta: {
      severity: 'warn',
      title: 'Status at Week 2 review',
      from: 'Since Day 1 initiation',
      changes: [
        { param:'Pain (NRS)',    text:'<span class="lp-worsened">Still 5/10</span> — partial improvement from 6/10. Target NRS ≤3 not yet reached. Functional limitations persist.',          key:'pain' },
        { param:'Adherence',    text:'<span class="lp-new">PRN pattern resuming</span> — patient reports not taking doses on low-pain days. Fixed-schedule adherence not confirmed at this visit.', key:'adh'  },
        { param:'Renal (eGFR)', text:'<span class="lp-unchanged">Stable ~58 mL/min</span> — baseline labs obtained at Day 1. No trajectory change detectable at 2 weeks.',                        key:'egfr' },
        { param:'GI tolerance', text:'<span class="lp-improved">Tolerating well</span> — no epigastric symptoms reported. Pantoprazole cover maintained.',                                         key:'gi'   }
      ],
      implication: 'Pain response is partial, but escalation criteria are not yet met on confirmed fixed-schedule therapy. The unresolved adherence gap means apparent non-response cannot be attributed to pharmacological inadequacy — reinforce TID schedule before considering escalation. Escalation at this point would be premature.'
    },
    pathwayStates:   ['past','active','future','future','future'],
    pathwayOutcomes: [{ cls:'outcome-ok', text:'✓ Initiated' }, { cls:'outcome-escalated', text:'→ Adherence: unconfirmed' }, null, null, null],
    missed: false
  },
  {
    idx: 2, label: 'Week 4', sublabel: 'Escalation decision',
    drift: { pain: 0, adh: 'poor', egfr: -3, bp: +5 },
    delta: {
      severity: 'warn',
      title: 'Status at Week 4 escalation review',
      from: 'Accumulated since Day 1 initiation',
      changes: [
        { param:'Pain (NRS)',      text:'<span class="lp-worsened">6/10 — unchanged</span> from baseline. Acetaminophen analgesic ceiling may be insufficient, but adherence failure has not been excluded as primary driver.', key:'pain' },
        { param:'Adherence',      text:'<span class="lp-worsened">Confirmed poor</span> — patient now reporting most-days missed doses. PRN use only on severe pain days. Fixed TID schedule not established despite reinforcement at Week 2.', key:'adh'  },
        { param:'Renal (eGFR)',   text:'<span class="lp-new">eGFR 55 mL/min</span> — small decline from 58 at Day 1. Within biological variability, but directionally declining. G3a range maintained. Trend direction now visible for first time.', key:'egfr' },
        { param:'Blood pressure', text:'<span class="lp-new">133 mmHg systolic</span> — mildly elevated from 128. Within acceptable range. Consistent with intermittent amlodipine adherence.', key:'bp'   }
      ],
      implication: 'Escalation at Week 4 is clinically premature while adherence remains unconfirmed. Pain persistence at NRS 6/10 cannot be reliably attributed to pharmacological inadequacy when the patient is not taking medications as prescribed. The renal trend (58→55) is small but now directionally visible — escalation to topical NSAID should be deferred until adherence is established and the renal trajectory is confirmed stable. Polypharmacy burden has increased with adherence-driven therapeutic uncertainty.'
    },
    pathwayStates:   ['past','past','active','future','future'],
    pathwayOutcomes: [
      { cls:'outcome-ok', text:'✓ Initiated' }, { cls:'outcome-concern', text:'⚠ Adherence gap — unresolved' },
      { cls:'outcome-escalated', text:'→ Deferred — adherence prerequisite unmet' }, null, null
    ],
    missed: false
  },
  {
    idx: 3, label: 'Week 8', sublabel: 'Comprehensive review',
    drift: { pain: 0, adh: 'poor', egfr: -7, bp: +14, cv: 'high' },
    delta: {
      severity: 'alert',
      title: 'Status at Week 8 — management reassessment required',
      from: 'Progressive change since Day 1',
      changes: [
        { param:'Renal (eGFR)',         text:'<span class="lp-worsened">eGFR 51 mL/min</span> — down from 58 at baseline. 12% decline over 8 weeks. Trend now confirmed declining. Approaching the 50 mL/min absolute NSAID threshold. Topical NSAID escalation window is closing.', key:'egfr' },
        { param:'Blood pressure',       text:'<span class="lp-worsened">142 mmHg systolic</span> — progressively elevated. Amlodipine adherence should be reviewed. Not yet triggering the 160 mmHg discontinuation threshold, but trajectory warrants active monitoring.', key:'bp'  },
        { param:'Cardiovascular risk',  text:'<span class="lp-worsened">Reclassified: High</span> — cumulative progression of hypertension trajectory and declining renal function has shifted the CV risk profile.', key:'cv'   },
        { param:'Pain (NRS)',           text:'<span class="lp-worsened">Still 6/10</span> — unchanged over 8 weeks. Conservative management ceiling has been reached under current adherence pattern. Functional goals not met.', key:'pain' },
        { param:'Adherence',           text:'<span class="lp-worsened">Persistent poor pattern</span> — 8-week pattern now confirmed. Blister packaging was not implemented. Pharmacological efficacy assessment is unreliable.', key:'adh'  }
      ],
      implication: 'The Week 8 picture has materially shifted the risk balance. The eGFR decline from 58 to 51 narrows the escalation corridor — topical NSAID use now requires confirmation that eGFR is ≥50, which it marginally meets but without safety margin. The BP trajectory (128→142) and reclassified CV risk make any systemic NSAID inappropriate. Conservative management ceiling has been reached. Physiotherapy referral (home-based) and orthopedic consultation are now the appropriate next steps, not further pharmacological escalation.'
    },
    pathwayStates:   ['past','past','past','active','future'],
    pathwayOutcomes: [
      { cls:'outcome-ok',         text:'✓ Initiated' },
      { cls:'outcome-concern',    text:'⚠ Adherence unresolved' },
      { cls:'outcome-escalated',  text:'→ Conservative mgmt ceiling reached' },
      { cls:'outcome-concern',    text:'⚠ Renal + BP trend: active monitoring' },
      null
    ],
    missed: false
  },
  {
    idx: 4, label: '3 Months', sublabel: 'Stable-phase review',
    drift: { pain: -2, adh: 'partial', egfr: -9, bp: +10, cv: 'high' },
    delta: {
      severity: 'warn',
      title: 'Status at 3-month stable-phase review',
      from: 'Longitudinal course: Day 1 → 3 months',
      changes: [
        { param:'Renal (eGFR)',      text:'<span class="lp-worsened">eGFR 49 mL/min</span> — crossed the 50 mL/min NSAID threshold. All NSAIDs now absolutely contraindicated. Acetaminophen ceiling reduced to 2.5 g/day. Nephrology co-management now indicated.', key:'egfr' },
        { param:'Pain (NRS)',        text:'<span class="lp-improved">4/10 — partial improvement</span> from 6/10 baseline. Physiotherapy has contributed to functional progress. Not at target (NRS ≤3) but trend is improving.', key:'pain' },
        { param:'Adherence',        text:'<span class="lp-improved">Improving — inconsistent</span> but better than prior visits. Blister packaging implemented at Week 10. Fixed-schedule use more consistent.', key:'adh'  },
        { param:'Blood pressure',   text:'<span class="lp-unchanged">138 mmHg systolic</span> — stable at elevated level. Antihypertensive adherence improved. Monitoring ongoing. Amlodipine remains appropriate.', key:'bp'   },
        { param:'Surgical candidacy', text:'<span class="lp-new">TKA discussion initiated</span> — functional goals not fully met at 3 months. Orthopedic referral submitted. Conservative management ceiling confirmed.', key: null }
      ],
      implication: 'The 3-month trajectory has produced a meaningful shift in the treatment logic. eGFR has crossed 50 mL/min, making all NSAIDs absolutely contraindicated and reducing the acetaminophen ceiling. The previously acceptable topical NSAID escalation path is now closed permanently under the current renal trajectory. Pain has partially improved with physiotherapy. The dominant clinical question is now surgical candidacy assessment (TKA) rather than pharmacological escalation. Nephrology co-management is required for ongoing renal monitoring. The polypharmacy burden has paradoxically simplified — fewer options mean a cleaner, more conservative regimen.'
    },
    pathwayStates:   ['past','past','past','past','active'],
    pathwayOutcomes: [
      { cls:'outcome-ok',        text:'✓ Initiated' },
      { cls:'outcome-concern',   text:'⚠ Adherence concern (resolved at wk 10)' },
      { cls:'outcome-escalated', text:'→ Physio referral — delayed' },
      { cls:'outcome-escalated', text:'→ Ortho referral submitted' },
      { cls:'outcome-concern',   text:'⚠ eGFR <50 — pathway closed' }
    ],
    missed: false
  }
];

function initLongitudinalProgression() {
  P_BASELINE = {
    egfr: P.egfr, gi: P.gi, bp: P.bp, cv: P.cv,
    pain: P.pain, age: P.age, failed: P.failed,
    adh:  P.adh,  sed: P.sed, intol: P.intol
  };
  renderTimepointButtons(0);
  updatePathwayStates(0);
}

function setTimepoint(idx) {
  LP_CURRENT_TP = idx;
  var tp = LP_TIMEPOINTS[idx];

  Object.assign(P, P_BASELINE);

  var d = tp.drift;
  if (d.egfr  !== undefined) P.egfr  = Math.max(10, P_BASELINE.egfr  + d.egfr);
  if (d.bp    !== undefined) P.bp    = Math.max(100, P_BASELINE.bp   + d.bp);
  if (d.pain  !== undefined) P.pain  = Math.max(1, Math.min(10, P_BASELINE.pain + d.pain));
  if (d.adh   !== undefined) P.adh   = d.adh;
  if (d.cv    !== undefined) P.cv    = d.cv;

  runReasoningEngine();
  updatePolypharmacyPanel();
  renderTimepointButtons(idx);
  renderDeltaStrip(tp);
  renderMissedBanner(idx);
  updatePathwayStates(idx);

  // Sync popover sliders to updated P values
  ['egfr','bp','pain'].forEach(function(key) {
    var cfg  = POPOVER_INPUTS[key];
    var rng  = document.getElementById(cfg.id);
    var valEl = document.getElementById(cfg.valId);
    if (rng)   rng.value = P[key];
    if (valEl) valEl.textContent = P[key];
  });
}

// ── Timepoint button rendering ──
function renderTimepointButtons(activeIdx) {
  for (var i = 0; i < LP_TIMEPOINTS.length; i++) {
    var btn = document.getElementById('lp-tp-' + i);
    if (!btn) continue;
    btn.className = 'lp-tp ' + (i < activeIdx ? 'lp-past' : i === activeIdx ? 'lp-active' : 'lp-future');

    var dotEl = btn.querySelector('.lp-tp-dot');
    if (dotEl) {
      // Common dot dimensions
      dotEl.style.display      = 'inline-block';
      dotEl.style.width        = '6px';
      dotEl.style.height       = '6px';
      dotEl.style.borderRadius = '50%';
      if (i < activeIdx) {
        dotEl.style.background = 'var(--border)';
        dotEl.style.border     = 'none';
      } else if (i === activeIdx) {
        dotEl.style.background = 'var(--blue)';
        dotEl.style.border     = 'none';
      } else {
        dotEl.style.background = 'transparent';
        dotEl.style.border     = '1px solid var(--border)';
      }
    }

    // Status tag for past checkpoints
    var tp      = LP_TIMEPOINTS[i];
    var weekDiv = btn.querySelector('.lp-tp-week');
    if (weekDiv) {
      var existingTag = weekDiv.querySelector('.lp-status-tag');
      if (existingTag) existingTag.remove();
      if (i < activeIdx && tp.pathwayOutcomes && tp.pathwayOutcomes[i]) {
        var out    = tp.pathwayOutcomes[i];
        var tag    = document.createElement('span');
        var tagCls = 'lp-status-tag ';
        if      (out.cls === 'outcome-ok')        tagCls += 'lp-status-ok';
        else if (out.cls === 'outcome-escalated')  tagCls += 'lp-status-escalated';
        else if (out.cls === 'outcome-concern')    tagCls += 'lp-status-concern';
        else                                       tagCls += 'lp-status-missed';
        tag.className    = tagCls;
        tag.style.marginLeft = '5px';
        tag.textContent  = i === 0 ? 'Done' : out.cls === 'outcome-ok' ? 'Completed' : out.cls === 'outcome-escalated' ? 'Escalated' : 'Concern';
        weekDiv.appendChild(tag);
      }
    }
  }
}

// ── Delta strip rendering ──
function renderDeltaStrip(tp) {
  var delta = document.getElementById('lp-delta');
  if (!delta) return;

  if (!tp.delta) { delta.className = 'lp-delta'; return; }

  var d = tp.delta;
  delta.className = 'lp-delta lp-delta-visible' +
    (d.severity === 'alert' ? ' lp-delta-alert' : d.severity === 'warn' ? ' lp-delta-warn' : '');

  setEl('lp-delta-title', d.title);
  setEl('lp-delta-from',  d.from);
  setEl('lp-implication-text', d.implication);

  var implLabel = document.getElementById('lp-implication-label');
  if (implLabel) {
    implLabel.textContent = d.severity === 'alert' ? 'Escalation implication'
      : d.severity === 'warn' ? 'Management implication' : 'Reasoning implication';
  }

  var changesEl = document.getElementById('lp-delta-changes');
  if (changesEl) {
    changesEl.innerHTML = '';
    d.changes.forEach(function(c) {
      var row = document.createElement('div');
      row.className = 'lp-delta-item';
      row.innerHTML = '<span class="lp-delta-param">' + c.param + '</span>' +
                      '<span class="lp-delta-change">' + c.text + '</span>';
      changesEl.appendChild(row);
    });
  }
}

// ── Missed follow-up banner ──
function renderMissedBanner(idx) {
  var banner = document.getElementById('lp-missed-banner');
  if (!banner) return;

  if (idx === 3) {
    banner.className = 'lp-missed-banner lp-missed-visible';
    setEl('lp-missed-text', 'Escalation checkpoint at Week 4 was reached without adherence being confirmed. The renal trend that emerged between Weeks 4–8 (eGFR 55→51) occurred without a monitoring-triggered reassessment. Previously acceptable NSAID escalation paths are now narrowed by a decline that went undetected within the monitoring window.');
  } else if (idx === 4) {
    banner.className = 'lp-missed-banner lp-missed-visible';
    setEl('lp-missed-text', 'The eGFR threshold crossing (below 50 mL/min) at 3 months has closed the topical NSAID escalation pathway that was conditionally available at initiation. This represents a previously acceptable option becoming permanently unsafe due to monitored disease progression — not a prescribing error, but a clinically expected consequence of longitudinal CKD in this patient profile.');
  } else {
    banner.className = 'lp-missed-banner';
  }
}

// ── Pathway visual state update ──
function updatePathwayStates(activeIdx) {
  var tp = LP_TIMEPOINTS[activeIdx];
  if (!tp) return;

  for (var i = 0; i < 5; i++) {
    var item       = document.getElementById('lp-pathway-' + i);
    var dot        = document.getElementById('lp-pdot-' + i);
    var outcomeEl  = document.getElementById('lp-outcome-' + i);
    if (!item) continue;

    var state       = tp.pathwayStates[i];
    var outcomeData = tp.pathwayOutcomes ? tp.pathwayOutcomes[i] : null;

    item.classList.remove('lp-item-past', 'lp-item-active', 'lp-item-future');
    if      (state === 'past')   item.classList.add('lp-item-past');
    else if (state === 'active') item.classList.add('lp-item-active');
    else if (state === 'future') item.classList.add('lp-item-future');

    if (dot) {
      dot.className = 'mn-pathway-dot' + (state === 'active' ? ' active' : '');
      if (state === 'past') {
        dot.style.background  = 'var(--border)';
        dot.style.borderColor = 'var(--border)';
      } else if (state === 'active') {
        dot.style.background  = 'var(--blue)';
        dot.style.borderColor = 'var(--blue)';
      } else {
        dot.style.background  = '';
        dot.style.borderColor = '';
      }
    }

    if (outcomeEl) {
      if (outcomeData && state !== 'future') {
        var existingBadge = outcomeEl.querySelector('.lp-past-outcome');
        if (existingBadge) existingBadge.remove();
        var badge = document.createElement('span');
        badge.className  = 'lp-past-outcome ' + outcomeData.cls;
        badge.textContent = outcomeData.text;
        outcomeEl.appendChild(badge);
      } else {
        outcomeEl.innerHTML = '';
      }
    }
  }
}


/* ════════════════════════════════════════════════════════════
   SECTION 21A — CLINICAL STATUS SUMMARY
════════════════════════════════════════════════════════════ */

function updateClinicalStatusSummary() {
  var block = document.getElementById('css-block');
  if (!block) return;

  // ── helpers ──────────────────────────────────────────────────────────────
  function setVal(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }
  function setClass(id, cls) {
    var el = document.getElementById(id);
    if (el) { el.className = el.className.replace(/css-val-\w+/g, '').trim(); if (cls) el.classList.add(cls); }
  }

  // ── derive clinical dimensions from P ────────────────────────────────────
  var eR = egfrRisk();          // 'low' | 'mild' | 'moderate' | 'severe'
  var gR = giRisk();            // 'low' | 'high' | 'very-high'
  var nsaidClosed = nsaidContraindicated();
  var opioidClosed = opioidAvoidable();
  var complexity = computeComplexity();

  // 1. Clinical Status
  var statusVal, statusSub, statusCls;
  if (P.egfr < 30 || P.bp >= 170 || gR === 'very-high') {
    statusVal = 'Unstable'; statusSub = 'Acute risk factors present'; statusCls = 'css-val-red';
  } else if (P.egfr < 45 || P.bp >= 150 || gR === 'high') {
    statusVal = 'Guarded'; statusSub = 'Active risk factors — monitor closely'; statusCls = 'css-val-amber';
  } else {
    statusVal = 'Stable'; statusSub = 'No acute deterioration'; statusCls = 'css-val-green';
  }
  setVal('css-status-val', statusVal);
  setVal('css-status-sub', statusSub);
  setClass('css-status-val', statusCls);

  // 2. Functional Impact
  var funcVal, funcSub, funcCls;
  if (P.pain >= 8) {
    funcVal = 'Severe'; funcSub = 'Markedly limits daily activities'; funcCls = 'css-val-red';
  } else if (P.pain >= 6) {
    funcVal = 'Moderate'; funcSub = 'Stair use and walking limited'; funcCls = 'css-val-amber';
  } else if (P.pain >= 4) {
    funcVal = 'Mild–Moderate'; funcSub = 'Some activity restriction'; funcCls = 'css-val-amber';
  } else {
    funcVal = 'Mild'; funcSub = 'Manageable with current regimen'; funcCls = 'css-val-green';
  }
  setVal('css-functional-val', funcVal);
  setVal('css-functional-sub', funcSub);
  setClass('css-functional-val', funcCls);

  // 3. Symptom Burden
  var symVal, symSub, symCls;
  if (P.pain >= 8) {
    symVal = 'High'; symSub = 'NRS ' + P.pain + '/10 · Severe'; symCls = 'css-val-red';
  } else if (P.pain >= 6) {
    symVal = 'Moderate–High'; symSub = 'NRS ' + P.pain + '/10 · Bilateral'; symCls = 'css-val-amber';
  } else if (P.pain >= 4) {
    symVal = 'Moderate'; symSub = 'NRS ' + P.pain + '/10'; symCls = 'css-val-amber';
  } else {
    symVal = 'Low'; symSub = 'NRS ' + P.pain + '/10 · Manageable'; symCls = 'css-val-green';
  }
  setVal('css-symptom-val', symVal);
  setVal('css-symptom-sub', symSub);
  setClass('css-symptom-val', symCls);

  // 4. Risk Profile
  var riskVal, riskSub, riskCls;
  var riskCount = (gR === 'high' || gR === 'very-high' ? 1 : 0) +
    (eR === 'moderate' || eR === 'severe' ? 2 : eR === 'mild' ? 1 : 0) +
    (ageFlag() ? 1 : 0) +
    (P.cv === 'high' || P.cv === 'very-high' ? 1 : 0) +
    (P.bp >= 150 ? 1 : 0);
  if (riskCount >= 5) {
    riskVal = 'High'; riskSub = 'Multiple compound constraints'; riskCls = 'css-val-red';
  } else if (riskCount >= 3) {
    riskVal = 'Moderate–High'; riskSub = 'GI + renal + age constraints'; riskCls = 'css-val-amber';
  } else if (riskCount >= 1) {
    riskVal = 'Moderate'; riskSub = 'Active risk factors present'; riskCls = 'css-val-amber';
  } else {
    riskVal = 'Low'; riskSub = 'No major risk factors active'; riskCls = 'css-val-green';
  }
  setVal('css-risk-val', riskVal);
  setVal('css-risk-sub', riskSub);
  setClass('css-risk-val', riskCls);

  // 5. Treatment Pathway
  var pathVal, pathSub, pathCls;
  var closedCount = (nsaidClosed ? 1 : 0) + (opioidClosed ? 1 : 0) + (acetaminophenFailed() ? 1 : 0);
  if (closedCount >= 3) {
    pathVal = 'Severely Limited'; pathSub = 'Most classes exhausted'; pathCls = 'css-val-red';
  } else if (nsaidClosed && opioidClosed) {
    pathVal = 'Constrained'; pathSub = 'NSAID & opioid closed'; pathCls = 'css-val-amber';
  } else if (nsaidClosed) {
    pathVal = 'Restricted'; pathSub = 'NSAID pathway closed'; pathCls = 'css-val-amber';
  } else {
    pathVal = 'Open'; pathSub = 'Standard options available'; pathCls = 'css-val-green';
  }
  setVal('css-pathway-val', pathVal);
  setVal('css-pathway-sub', pathSub);
  setClass('css-pathway-val', pathCls);

  // 6. Intervention Urgency
  var urgVal, urgSub, urgCls;
  if (P.pain >= 8 || gR === 'very-high' || P.egfr < 30) {
    urgVal = 'Urgent'; urgSub = 'Immediate action required'; urgCls = 'css-val-red';
  } else if (P.pain >= 6 || gR === 'high' || eR === 'mild') {
    urgVal = 'Prompt'; urgSub = 'Initiate today · Review Wk 2'; urgCls = 'css-val-amber';
  } else {
    urgVal = 'Routine'; urgSub = 'Elective — monitor at follow-up'; urgCls = '';
  }
  setVal('css-urgency-val', urgVal);
  setVal('css-urgency-sub', urgSub);
  setClass('css-urgency-val', urgCls);

  // ── Overall badge ────────────────────────────────────────────────────────
  var badge = document.getElementById('css-overall-badge');
  var badgeLabel = document.getElementById('css-overall-label');
  if (badge && badgeLabel) {
    badge.className = 'css-overall-badge';
    if (statusVal === 'Unstable' || riskVal === 'High') {
      badge.classList.add('css-badge-red');
      badgeLabel.textContent = 'Clinical Review Required';
    } else if (statusVal === 'Guarded' || riskVal === 'Moderate–High') {
      badge.classList.add('css-badge-amber');
      badgeLabel.textContent = 'Monitoring Elevated';
    } else {
      badgeLabel.textContent = 'Clinically Stable';
    }
  }

  // ── Overall Assessment narrative ─────────────────────────────────────────
  var narrativeParts = [];
  // Pain / symptom framing
  if (P.pain >= 8) {
    narrativeParts.push('Patient presents with severe pain (NRS ' + P.pain + '/10) causing significant functional impairment.');
  } else if (P.pain >= 6) {
    narrativeParts.push('Patient remains symptomatic with moderate-to-severe pain (NRS ' + P.pain + '/10) and progressive functional limitation.');
  } else {
    narrativeParts.push('Patient reports moderate pain (NRS ' + P.pain + '/10) with manageable functional impact.');
  }
  // Constraint summary
  if (nsaidClosed && opioidClosed) {
    narrativeParts.push('Analgesic options are significantly restricted by compound ' +
      (gR !== 'low' ? 'GI, ' : '') +
      (eR !== 'low' ? 'renal, ' : '') +
      'and cardiovascular constraints.');
  } else if (nsaidClosed) {
    narrativeParts.push('NSAIDs are contraindicated; alternative analgesic strategies are required.');
  }
  // Recommendation bridge
  if (acetaminophenFailed()) {
    narrativeParts.push('First-line acetaminophen has failed — pathway review and specialist input are required before escalation.');
  } else if (nsaidClosed) {
    narrativeParts.push('First-line treatment initiation is appropriate today — acetaminophen TID provides the best achievable safety-efficacy balance within the current constraint profile.');
  } else {
    narrativeParts.push('Treatment initiation is appropriate — acetaminophen is recommended as first-line with close monitoring.');
  }
  setVal('css-assessment-text', narrativeParts.join(' '));

  // ── Reasoning chips ──────────────────────────────────────────────────────
  var chipsEl = document.getElementById('css-reasoning-items');
  if (chipsEl) {
    var chips = [];
    if (gR === 'very-high' || gR === 'high')   chips.push({ label: 'GI risk binding', cls: 'css-chip-red' });
    if (eR === 'mild' || eR === 'moderate')     chips.push({ label: 'Renal monitoring required', cls: 'css-chip-amber' });
    if (eR === 'severe')                         chips.push({ label: 'Severe renal impairment', cls: 'css-chip-red' });
    if (P.failed === '2nsaid' || P.failed === 'multi') chips.push({ label: 'NSAID pathway closed ×2', cls: 'css-chip-amber' });
    else if (P.failed === '1nsaid')              chips.push({ label: 'NSAID failed ×1', cls: 'css-chip-amber' });
    if (ageFlag())                               chips.push({ label: 'Age ≥65 (Beers)', cls: 'css-chip-amber' });
    if (P.bp >= 150)                             chips.push({ label: 'BP elevated', cls: 'css-chip-amber' });
    if (!acetaminophenFailed() && !nsaidClosed)  chips.push({ label: 'Acetaminophen: first-line', cls: 'css-chip-blue' });
    else if (!acetaminophenFailed())             chips.push({ label: 'Acetaminophen: lowest systemic risk', cls: 'css-chip-blue' });
    if (P.adh === 'partial' || P.adh === 'poor') chips.push({ label: 'Adherence concern', cls: 'css-chip-amber' });
    chips.push({ label: 'ACR 2023 aligned', cls: 'css-chip-muted' });

    chipsEl.innerHTML = chips.map(function(c) {
      return '<span class="css-reasoning-chip ' + c.cls + '">' + c.label + '</span>';
    }).join('');
  }

  // ── Block title ──────────────────────────────────────────────────────────
  var timepointLabels = ['Day 1', 'Week 2', 'Week 4', 'Week 8', '3 Months'];
  var tpLabel = timepointLabels[LP_CURRENT_TP] || 'Day 1';
  setVal('css-title', 'Patient Assessment — ' + tpLabel);
}


/* ════════════════════════════════════════════════════════════
   SECTION 21B — CLINICAL IMPRESSION
════════════════════════════════════════════════════════════ */

function updateClinicalImpression() {
  var el = document.getElementById('ci-block');
  if (!el) return;

  var eR  = egfrRisk();
  var gR  = giRisk();
  var nsaidClosed = nsaidContraindicated();
  var opioidClosed = opioidAvoidable();
  var apapFailed = acetaminophenFailed();
  var multimodal = multimodalFailure();

  // ── Timepoint label ──────────────────────────────────────────────────────
  var tpLabels = ['Day 1', 'Week 2', 'Week 4', 'Week 8', '3 Months'];
  var tpLabel = tpLabels[LP_CURRENT_TP] || 'Day 1';
  var tpEl = document.getElementById('ci-timepoint');
  if (tpEl) tpEl.textContent = tpLabel;

  // ── Build impression lines ───────────────────────────────────────────────
  var lines = [];

  // 1. Symptomatic status — the opening clinical observation
  if (P.pain >= 8) {
    lines.push({ text: 'Patient presents with severe, functionally disabling pain (NRS ' + P.pain + '/10). Activity is significantly curtailed and the current analgesic approach is inadequate.', tone: 'red' });
  } else if (P.pain >= 6) {
    lines.push({ text: 'Patient remains symptomatic with moderate-to-severe pain (NRS ' + P.pain + '/10) and progressive functional limitation. Bilateral joint involvement is contributing to reduced mobility and social independence.', tone: 'amber' });
  } else if (P.pain >= 4) {
    lines.push({ text: 'Patient reports moderate pain (NRS ' + P.pain + '/10). Functional capacity is partially preserved but activity limitation is evident.', tone: 'amber' });
  } else {
    lines.push({ text: 'Pain is currently well-controlled (NRS ' + P.pain + '/10). Functional status appears maintained at this timepoint.', tone: 'green' });
  }

  // 2. Risk constraint framing — the binding clinical context
  if (gR === 'very-high' && (eR === 'moderate' || eR === 'severe')) {
    lines.push({ text: 'Risk profile is substantially constrained. Active GI haemorrhage history combined with significant renal impairment (eGFR ' + P.egfr + ') narrows the analgesic pathway to the least nephrotoxic and gastrotoxic agents only.', tone: 'red' });
  } else if (gR === 'very-high') {
    lines.push({ text: 'GI risk is the dominant clinical constraint. Prior bleeding history renders NSAIDs of all classes inappropriate regardless of pain severity. This is not a provisional restriction — it is a firm contraindication.', tone: 'red' });
  } else if (gR === 'high' && (eR === 'mild' || eR === 'moderate' || eR === 'severe')) {
    lines.push({ text: 'Compound GI and renal risk limits analgesic selection. Prior peptic ulcer and a borderline eGFR (' + P.egfr + ' mL/min) together close the NSAID pathway and restrict escalation options at both the GI and nephrotoxicity axes.', tone: 'amber' });
  } else if (gR === 'high') {
    lines.push({ text: 'Prior peptic ulcer represents a sustained GI risk. NSAIDs carry meaningful ulcer reactivation and bleeding risk in this context — particularly with age-related mucosal vulnerability.', tone: 'amber' });
  } else if (eR === 'moderate' || eR === 'severe') {
    lines.push({ text: 'Renal function is significantly impaired (eGFR ' + P.egfr + ') and is the primary constraint on analgesic escalation. Prostaglandin-dependent renal autoregulation is at risk; NSAIDs are contraindicated at this level of function.', tone: 'red' });
  } else if (eR === 'mild') {
    lines.push({ text: 'Mild renal impairment (eGFR ' + P.egfr + ', CKD G3a) introduces a dose ceiling for acetaminophen and warrants monitoring of any analgesic with nephrotoxic potential. The trajectory of renal function is currently unconfirmed.', tone: 'amber' });
  }

  // 3. BP / CV — only if clinically relevant
  if (P.bp >= 170) {
    lines.push({ text: 'Blood pressure is uncontrolled (SBP ' + P.bp + ' mmHg). NSAID use in this context carries direct risk of further BP elevation and antihypertensive antagonism — this is a firm contraindication to any NSAID trial.', tone: 'red' });
  } else if (P.bp >= 150) {
    lines.push({ text: 'Blood pressure is mildly elevated (SBP ' + P.bp + ' mmHg). NSAIDs would likely impair amlodipine efficacy; previous diclofenac trial produced a documented +18 mmHg rise, which reinforces avoidance.', tone: 'amber' });
  }

  // 4. Prior treatment failures — what this means for current decision
  if (multimodal) {
    lines.push({ text: 'Multiple analgesic classes have failed. The treatment pathway is substantially exhausted — further escalation requires specialist input before any new agent class is introduced.', tone: 'red' });
  } else if (apapFailed) {
    lines.push({ text: 'Acetaminophen has been trialled and failed. The primary conservative option is no longer available, and escalation to a second-line agent — within the bounds of the current risk profile — is now appropriate.', tone: 'amber' });
  } else if (P.failed === '2nsaid') {
    lines.push({ text: 'Two NSAID trials have been discontinued due to documented intolerance. This is not a relative contraindication — it constitutes direct clinical evidence that the NSAID pathway is not viable for this patient. Acetaminophen TID has not yet been trialled on a fixed schedule.', tone: 'amber' });
  } else if (P.failed === '1nsaid') {
    lines.push({ text: 'One NSAID has been discontinued due to intolerance. Caution is appropriate before attempting a second NSAID trial; alternative first-line options should be exhausted first.', tone: 'amber' });
  }

  // 5. Adherence — clinical implication, not a flag
  if (P.adh === 'poor') {
    lines.push({ text: 'Adherence is documented as poor. Any apparent treatment failure at this stage must be interpreted cautiously — subtherapeutic drug exposure cannot be excluded as the primary explanation for ongoing pain.', tone: 'amber' });
  } else if (P.adh === 'partial') {
    lines.push({ text: 'Adherence to the analgesic regimen is inconsistent. The patient has been using medication on a PRN basis rather than a fixed schedule. A first assessment of true fixed-schedule adherence has not yet been obtained.', tone: 'amber' });
  }

  // 6. Sedation / opioid gate
  if (opioidClosed && (P.failed === 'multi' || P.pain >= 8)) {
    lines.push({ text: 'Opioid analgesics are not appropriate in this context. The patient\'s fall risk profile, sedation sensitivity, and expressed preference collectively close this pathway, regardless of pain severity.', tone: 'muted' });
  }

  // 7. Stability note — only at timepoints > 0 or if stable
  if (LP_CURRENT_TP > 0 && P.pain <= 5 && eR !== 'severe') {
    lines.push({ text: 'Clinical presentation remains stable despite persistent symptoms. No acute deterioration has occurred since the previous review.', tone: 'green' });
  } else if (LP_CURRENT_TP === 0 && !multimodal && !apapFailed) {
    lines.push({ text: 'No major escalation triggers are present at this stage. Conservative management is clinically appropriate and should be established before further pathway decisions are made.', tone: 'muted' });
  }

  // ── Conclusion sentence — the bridge to the recommendation ───────────────
  var conclusion = '';
  if (multimodal) {
    conclusion = 'Specialist-led review is required before any further analgesic class is initiated. Current symptomatic management should be optimised within available options while referral is arranged.';
  } else if (apapFailed) {
    conclusion = 'First-line acetaminophen has failed on adequate trial. Escalation to the next available option within the current risk profile is now clinically indicated.';
  } else if (gR === 'very-high' || (gR === 'high' && (eR === 'moderate' || eR === 'severe'))) {
    conclusion = 'Given compound contraindications, the recommendation reflects the safest achievable option — not an ideal analgesic choice. Clinical expectations should be calibrated accordingly, and functional outcome monitoring is essential.';
  } else if (nsaidClosed && !apapFailed) {
    conclusion = 'Current risk profile supports conservative management with acetaminophen TID as a fixed-schedule first-line trial. The adequacy of this approach should be formally assessed at Week 2 before any escalation decision is made.';
  } else if (P.pain <= 4 && LP_CURRENT_TP > 0) {
    conclusion = 'Clinical trajectory is favourable. Current management should be maintained and monitoring intensity stepped down if stability is confirmed at the next scheduled review.';
  } else {
    conclusion = 'Conservative management is appropriate at this stage. Initiation of scheduled acetaminophen, combined with systematic monitoring, represents the correct first step in this clinical pathway.';
  }

  // ── Render ───────────────────────────────────────────────────────────────
  var parasEl = document.getElementById('ci-paragraphs');
  if (parasEl) {
    parasEl.innerHTML = lines.map(function(l) {
      return '<div class="ci-line ci-line-' + l.tone + '">' + l.text + '</div>';
    }).join('');
  }

  var concEl = document.getElementById('ci-conclusion');
  if (concEl) {
    concEl.innerHTML = '<span class="ci-conclusion-label">Clinical direction</span>' + conclusion;
  }
}


/* ════════════════════════════════════════════════════════════
   SECTION 21 — ENTRY PAGE GATE
════════════════════════════════════════════════════════════ */

function enterWorkflow() {
  var ep = document.getElementById('entry-page');
  var wp = document.getElementById('workflow-page');
  var sp = document.getElementById('selector-page');
  if (ep) { ep.style.display = 'none'; }
  if (sp) { sp.style.display = 'none'; }
  if (wp) { wp.style.display = 'block'; window.scrollTo({ top: 0, behavior: 'auto' }); }
}

function showSelector() {
  var ep = document.getElementById('entry-page');
  var wp = document.getElementById('workflow-page');
  var ap = document.getElementById('abx-page');
  var sp = document.getElementById('selector-page');
  if (ep) ep.style.display = 'none';
  if (wp) wp.style.display = 'none';
  if (ap) ap.style.display = 'none';
  if (sp) sp.style.display = 'block';
  window.scrollTo({ top: 0, behavior: 'auto' });
}

function returnToSelector() {
  showSelector();
}

function enterAbxWorkflow() {
  var sp = document.getElementById('selector-page');
  var ap = document.getElementById('abx-page');
  if (sp) sp.style.display = 'none';
  if (ap) { ap.style.display = 'block'; window.scrollTo({ top: 0, behavior: 'auto' }); }
  abxRunReasoningEngine();
}


/* ════════════════════════════════════════════════════════════
   ABX — STATE
════════════════════════════════════════════════════════════ */

var ABX = {
  wbc:         14.2,
  crp:         88,
  gfr:         52,
  temp:        37.4,
  improvement: 'improving',
  culture:     'pending'
};

var _abxActivePopover = null;

/* ════════════════════════════════════════════════════════════
   ABX — NAVIGATION
════════════════════════════════════════════════════════════ */

function abxShowSection(id, btn) {
  var sections = document.querySelectorAll('#abx-page .dp-section');
  sections.forEach(function(s) { s.classList.remove('active'); });
  var target = document.getElementById(id);
  if (target) target.classList.add('active');

  var navItems = document.querySelectorAll('#abx-page .dp-nav-item');
  navItems.forEach(function(n) { n.classList.remove('active'); });
  if (btn) btn.classList.add('active');

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ════════════════════════════════════════════════════════════
   ABX — POPOVERS
════════════════════════════════════════════════════════════ */

function abxOpenPopover(key, e) {
  if (e) e.stopPropagation();
  abxClosePopover(_abxActivePopover);
  var pop = document.getElementById('abx-pop-' + key);
  var card = document.getElementById('abx-p-' + key);
  if (!pop || !card) return;

  // Sync slider/select to current ABX state before showing
  if (key === 'wbc')  { var r = document.getElementById('abx-rng-wbc');  if (r) { r.value = ABX.wbc; document.getElementById('abx-rng-wbc-val').textContent = ABX.wbc; } }
  if (key === 'crp')  { var r = document.getElementById('abx-rng-crp');  if (r) { r.value = ABX.crp; document.getElementById('abx-rng-crp-val').textContent = ABX.crp; } }
  if (key === 'gfr')  { var r = document.getElementById('abx-rng-gfr');  if (r) { r.value = ABX.gfr; document.getElementById('abx-rng-gfr-val').textContent = ABX.gfr; } }
  if (key === 'temp') { var r = document.getElementById('abx-rng-temp'); if (r) { r.value = ABX.temp; document.getElementById('abx-rng-temp-val').textContent = parseFloat(ABX.temp).toFixed(1); } }
  if (key === 'improvement') { var s = document.getElementById('abx-sel-improvement'); if (s) s.value = ABX.improvement; }
  if (key === 'culture')     { var s = document.getElementById('abx-sel-culture');     if (s) s.value = ABX.culture; }

  pop.style.display = 'block';
  // Position relative to card
  var rect = card.getBoundingClientRect();
  pop.style.top  = (card.offsetTop + card.offsetHeight + 4) + 'px';
  pop.style.left = card.offsetLeft + 'px';

  _abxActivePopover = key;
}

function abxClosePopover(key) {
  if (!key) return;
  var pop = document.getElementById('abx-pop-' + key);
  if (pop) pop.style.display = 'none';
  if (_abxActivePopover === key) _abxActivePopover = null;
}

document.addEventListener('click', function(e) {
  if (!_abxActivePopover) return;
  var pop = document.getElementById('abx-pop-' + _abxActivePopover);
  if (pop && !pop.contains(e.target)) abxClosePopover(_abxActivePopover);
});

/* ════════════════════════════════════════════════════════════
   ABX — APPLY PARAM
════════════════════════════════════════════════════════════ */

function abxApplyParam(key) {
  if (key === 'wbc') {
    var r = document.getElementById('abx-rng-wbc');
    if (r) ABX.wbc = parseFloat(r.value);
  }
  if (key === 'crp') {
    var r = document.getElementById('abx-rng-crp');
    if (r) ABX.crp = parseFloat(r.value);
  }
  if (key === 'gfr') {
    var r = document.getElementById('abx-rng-gfr');
    if (r) ABX.gfr = parseFloat(r.value);
  }
  if (key === 'temp') {
    var r = document.getElementById('abx-rng-temp');
    if (r) ABX.temp = parseFloat(r.value);
  }
  if (key === 'improvement') {
    var s = document.getElementById('abx-sel-improvement');
    if (s) ABX.improvement = s.value;
  }
  if (key === 'culture') {
    var s = document.getElementById('abx-sel-culture');
    if (s) ABX.culture = s.value;
  }
  abxClosePopover(key);
  abxRunReasoningEngine();
}

/* ════════════════════════════════════════════════════════════
   ABX — HELPERS
════════════════════════════════════════════════════════════ */

function abxFeverActive()     { return ABX.temp >= 38.0; }
function abxWbcElevated()     { return ABX.wbc > 11; }
function abxWbcSeverely()     { return ABX.wbc > 20; }
function abxCrpHigh()         { return ABX.crp > 100; }
function abxCrpVeryHigh()     { return ABX.crp > 200; }
function abxGfrImpaired()     { return ABX.gfr < 60; }
function abxGfrSevere()       { return ABX.gfr < 30; }
function abxImproving()       { return ABX.improvement === 'improving'; }
function abxWorsening()       { return ABX.improvement === 'worsening'; }
function abxCultureSensitive(){ return ABX.culture === 'sensitive'; }
function abxCultureResistant(){ return ABX.culture === 'resistant'; }
function abxCultureNoGrowth() { return ABX.culture === 'no-growth'; }
function abxCulturePending()  { return ABX.culture === 'pending'; }

/* ════════════════════════════════════════════════════════════
   ABX — REASONING ENGINE
════════════════════════════════════════════════════════════ */

function abxRunReasoningEngine() {
  abxUpdateParamCards();
  abxUpdateClinicalStatusSummary();
  abxUpdateClinicalImpression();
  abxUpdateRecommendation();
  abxUpdateMonitoring();
}

/* ── 1. Param cards ───────────────────────────────────────────────────────── */
function abxUpdateParamCards() {
  function setVal(id, v)  { var e = document.getElementById(id); if (e) e.textContent = v; }
  function setClass(id, cls) {
    var e = document.getElementById(id);
    if (!e) return;
    e.className = e.className.replace(/abx-val-\w+/g, '').trim();
    if (cls) e.classList.add(cls);
  }

  // WBC
  setVal('abx-val-wbc', ABX.wbc);
  var wbcStatus = ABX.wbc > 20 ? 'Severely elevated' : ABX.wbc > 11 ? 'Elevated' : ABX.wbc < 4 ? 'Low — leucopenia' : 'Normal range';
  var wbcCls    = ABX.wbc > 20 ? 'abx-val-red' : ABX.wbc > 11 ? 'abx-val-amber' : ABX.wbc < 4 ? 'abx-val-amber' : 'abx-val-green';
  setVal('abx-status-wbc', wbcStatus);
  setClass('abx-val-wbc', wbcCls);

  // CRP
  setVal('abx-val-crp', ABX.crp);
  var crpStatus = ABX.crp > 200 ? 'Severely elevated' : ABX.crp > 100 ? 'Significantly elevated' : ABX.crp > 5 ? 'Elevated · trending down' : 'Normal';
  var crpCls    = ABX.crp > 100 ? 'abx-val-red' : ABX.crp > 5 ? 'abx-val-amber' : 'abx-val-green';
  setVal('abx-status-crp', crpStatus);
  setClass('abx-val-crp', crpCls);

  // GFR
  setVal('abx-val-gfr', ABX.gfr);
  var gfrStatus = ABX.gfr < 30 ? 'Severe impairment — dose review' : ABX.gfr < 60 ? 'Mild impairment' : 'Normal — no adjustment';
  var gfrCls    = ABX.gfr < 30 ? 'abx-val-red' : ABX.gfr < 60 ? 'abx-val-amber' : '';
  setVal('abx-status-gfr', gfrStatus);
  setClass('abx-val-gfr', gfrCls);

  // Temp
  setVal('abx-val-temp', parseFloat(ABX.temp).toFixed(1));
  var tempStatus = ABX.temp >= 39.5 ? 'High fever' : ABX.temp >= 38.5 ? 'Moderate fever' : ABX.temp >= 38.0 ? 'Febrile' : 'Afebrile';
  var tempCls    = ABX.temp >= 38.5 ? 'abx-val-red' : ABX.temp >= 38.0 ? 'abx-val-amber' : 'abx-val-green';
  setVal('abx-status-temp', tempStatus);
  setClass('abx-val-temp', tempCls);

  // Improvement
  var impLabels = { improving: 'Improving', stable: 'Stable', worsening: 'Worsening' };
  var impSubs   = { improving: 'Tolerating oral intake · mobilising', stable: 'No deterioration — limited change', worsening: 'Clinical decline noted' };
  var impCls    = { improving: 'abx-val-green', stable: 'abx-val-amber', worsening: 'abx-val-red' };
  setVal('abx-val-improvement', impLabels[ABX.improvement] || ABX.improvement);
  setVal('abx-status-improvement', impSubs[ABX.improvement] || '');
  setClass('abx-val-improvement', impCls[ABX.improvement] || '');

  // Culture
  var cultLabels = { pending: 'Pending', 'no-growth': 'No growth', sensitive: 'Sensitive organism', resistant: 'Resistant organism', contaminant: 'Likely contaminant' };
  var cultSubs   = { pending: 'Blood cultures day 1 — no growth to date', 'no-growth': '72hr negative — de-escalation supported', sensitive: 'Narrow-spectrum agent possible', resistant: 'Broad-spectrum therapy required', contaminant: 'Clinical correlation needed' };
  var cultCls    = { pending: 'abx-val-amber', 'no-growth': 'abx-val-green', sensitive: 'abx-val-green', resistant: 'abx-val-red', contaminant: 'abx-val-amber' };
  setVal('abx-val-culture', cultLabels[ABX.culture] || ABX.culture);
  setVal('abx-status-culture', cultSubs[ABX.culture] || '');
  setClass('abx-val-culture', cultCls[ABX.culture] || '');
}

/* ── 2. Clinical Status Summary ──────────────────────────────────────────── */
function abxUpdateClinicalStatusSummary() {
  function setVal(id, v) { var e = document.getElementById(id); if (e) e.textContent = v; }
  function setCls(id, cls) {
    var e = document.getElementById(id);
    if (!e) return;
    e.className = e.className.replace(/css-val-\w+/g, '').trim();
    if (cls) e.classList.add(cls);
  }

  // Inflammatory trend
  var infVal, infSub, infCls;
  if (abxCrpVeryHigh() || abxWbcSeverely()) {
    infVal = 'Severely elevated'; infSub = 'WBC ' + ABX.wbc + ' · CRP ' + ABX.crp; infCls = 'css-val-red';
  } else if (abxCrpHigh() || abxWbcElevated()) {
    infVal = 'Elevated'; infSub = 'WBC ' + ABX.wbc + ' · CRP ' + ABX.crp; infCls = 'css-val-amber';
  } else {
    infVal = 'Settling'; infSub = 'WBC ' + ABX.wbc + ' · CRP ' + ABX.crp; infCls = 'css-val-green';
  }
  setVal('abx-m-inflam', infVal); setVal('abx-m-inflam-sub', infSub); setCls('abx-m-inflam', infCls);

  // Fever
  var fevVal, fevSub, fevCls;
  if (ABX.temp >= 38.5) {
    fevVal = 'Febrile'; fevSub = ABX.temp.toFixed(1) + '°C — active fever'; fevCls = 'css-val-red';
  } else if (ABX.temp >= 38.0) {
    fevVal = 'Low-grade'; fevSub = ABX.temp.toFixed(1) + '°C — borderline'; fevCls = 'css-val-amber';
  } else {
    fevVal = 'Afebrile'; fevSub = ABX.temp.toFixed(1) + '°C — resolved'; fevCls = 'css-val-green';
  }
  setVal('abx-m-fever', fevVal); setVal('abx-m-fever-sub', fevSub); setCls('abx-m-fever', fevCls);

  // Clinical trajectory
  var trajMap = { improving: ['Improving', 'Tolerating oral · mobilising', 'css-val-green'], stable: ['Stable', 'No deterioration — limited change', 'css-val-amber'], worsening: ['Worsening', 'Clinical decline — reassess urgently', 'css-val-red'] };
  var traj = trajMap[ABX.improvement] || trajMap.stable;
  setVal('abx-m-trajectory', traj[0]); setVal('abx-m-traj-sub', traj[1]); setCls('abx-m-trajectory', traj[2]);

  // Renal
  var renVal, renSub, renCls;
  if (abxGfrSevere()) {
    renVal = 'Severe impairment'; renSub = 'eGFR ' + ABX.gfr + ' — major dose review'; renCls = 'css-val-red';
  } else if (abxGfrImpaired()) {
    renVal = 'Mild impairment'; renSub = 'eGFR ' + ABX.gfr + ' — dose adj. active'; renCls = 'css-val-amber';
  } else {
    renVal = 'Normal'; renSub = 'eGFR ' + ABX.gfr + ' — no adjustment'; renCls = '';
  }
  setVal('abx-m-renal', renVal); setVal('abx-m-renal-sub', renSub); setCls('abx-m-renal', renCls);

  // Overall assessment text
  var parts = [];
  if (abxWorsening()) {
    parts.push('Patient is clinically deteriorating on current antimicrobial therapy. This is the primary clinical concern overriding all other indicators.');
  } else if (abxImproving()) {
    parts.push('Patient demonstrates meaningful clinical improvement on Day 3 of IV piperacillin-tazobactam.');
    if (abxWbcElevated() || abxCrpHigh()) parts.push('Inflammatory markers remain elevated but are trending in the right direction.');
    if (!abxFeverActive()) parts.push('Defervescence achieved.');
    parts.push('Clinical improvement is the dominant stewardship signal at this stage.');
  } else {
    parts.push('Patient is clinically stable with limited improvement. Inflammatory markers have not yet significantly settled.');
    parts.push('Continue current therapy and reassess at 48 hours.');
  }
  var overall = document.getElementById('abx-overall-text');
  if (overall) overall.textContent = parts.join(' ');

  // Badge
  var badge = document.getElementById('abx-css-badge');
  var badgeLbl = document.getElementById('abx-css-badge-label');
  var badgeDot = document.getElementById('abx-css-badge-dot');
  if (badge && badgeLbl) {
    badge.className = 'css-overall-badge';
    if (abxWorsening()) {
      badge.classList.add('css-badge-red'); badgeLbl.textContent = 'Clinical deterioration'; if(badgeDot) badgeDot.style.background='var(--red)';
    } else if (abxImproving()) {
      badgeLbl.textContent = 'Clinical improvement noted'; if(badgeDot) badgeDot.style.background='var(--green)';
    } else {
      badge.classList.add('css-badge-amber'); badgeLbl.textContent = 'Stable — limited response'; if(badgeDot) badgeDot.style.background='var(--amber)';
    }
  }
}

/* ── 3. Clinical Impression ──────────────────────────────────────────────── */
function abxUpdateClinicalImpression() {
  var lines = [];

  // Opening — trajectory is always first
  if (abxWorsening()) {
    lines.push({ text: 'Patient is clinically deteriorating despite ' + (abxCrpVeryHigh() ? 'very high inflammatory markers (CRP ' + ABX.crp + ' mg/L, WBC ' + ABX.wbc + ')' : 'current antimicrobial therapy') + '. This constitutes a treatment failure signal and must be escalated urgently. Laboratory values, however elevated, are secondary to this clinical deterioration.', tone: 'red' });
  } else if (abxImproving()) {
    lines.push({ text: 'Patient is clinically improving — this is the single most important stewardship observation on Day 3 review. Symptomatic improvement with return of oral tolerance and mobility is a validated criterion for IV-to-oral step-down consideration.', tone: 'green' });
  } else {
    lines.push({ text: 'Clinical trajectory is stable but without meaningful improvement. This is an intermediate position — neither a clear trigger for escalation nor a safe basis for de-escalation. A further 24–48hr period of observation is appropriate before committing to a pathway change.', tone: 'amber' });
  }

  // Inflammatory markers — always contextualised against trajectory
  if (abxWbcSeverely() || abxCrpVeryHigh()) {
    lines.push({ text: 'Inflammatory markers are severely elevated (WBC ' + ABX.wbc + ', CRP ' + ABX.crp + ' mg/L). In the context of ' + (abxWorsening() ? 'clinical deterioration, this confirms inadequate treatment response.' : 'clinical improvement, markedly elevated markers should not alone prevent de-escalation — CRP has a well-documented lag of 48–72hr behind clinical response.'), tone: abxWorsening() ? 'red' : 'amber' });
  } else if (abxWbcElevated() || abxCrpHigh()) {
    lines.push({ text: 'Inflammatory markers remain above normal (WBC ' + ABX.wbc + ', CRP ' + ABX.crp + ' mg/L). This is expected at Day 3 of an acute infective process and should be interpreted alongside clinical trajectory, not in isolation. Biochemical normalisation typically lags clinical improvement by 2–4 days.', tone: 'amber' });
  } else {
    lines.push({ text: 'Inflammatory markers are settling towards normal range (WBC ' + ABX.wbc + ', CRP ' + ABX.crp + ' mg/L). This provides additional biochemical support for de-escalation alongside the clinical picture.', tone: 'green' });
  }

  // Fever
  if (abxFeverActive()) {
    lines.push({ text: 'Patient remains febrile (' + ABX.temp.toFixed(1) + '°C). Persistent fever in the context of ' + (abxWorsening() ? 'deterioration is a firm contraindication to de-escalation.' : 'overall clinical improvement may represent post-infective inflammation rather than active infection — clinical assessment is required to differentiate.'), tone: 'amber' });
  } else {
    lines.push({ text: 'Defervescence has been achieved (' + ABX.temp.toFixed(1) + '°C). Resolution of fever in combination with clinical improvement is a recognised IV-to-oral step-down criterion. This is a positive indicator.', tone: 'green' });
  }

  // Culture data
  if (abxCultureResistant()) {
    lines.push({ text: 'Culture has identified a resistant organism. Broad-spectrum IV cover must be maintained and therapy should be reviewed in conjunction with microbiology. De-escalation is not appropriate until susceptibility data is fully reviewed.', tone: 'red' });
  } else if (abxCultureSensitive()) {
    lines.push({ text: 'Culture has identified a sensitive organism — a narrow-spectrum oral agent is likely to provide adequate cover. This is the strongest available microbiological support for de-escalation.', tone: 'green' });
  } else if (abxCultureNoGrowth()) {
    lines.push({ text: '72-hour culture is negative. No growth at 72hr in a clinically improving patient supports step-down from broad-spectrum IV therapy. The absence of a confirmed organism does not mandate continued broad-spectrum cover once clinical criteria are met.', tone: 'green' });
  } else {
    lines.push({ text: 'Culture data is still pending. Final de-escalation decision should be deferred until the result is available — however, clinical improvement criteria can be assessed independently and the pathway prepared in advance.', tone: 'amber' });
  }

  // Renal
  if (abxGfrSevere()) {
    lines.push({ text: 'Severe renal impairment (eGFR ' + ABX.gfr + ') requires urgent dose review of all renally-cleared agents. Piperacillin-tazobactam requires significant dose reduction or interval extension at this level. Nephrotoxic agents must be avoided entirely.', tone: 'red' });
  } else if (abxGfrImpaired()) {
    lines.push({ text: 'Mild renal impairment (eGFR ' + ABX.gfr + ') is consistent with dose-adjusted pip-tazo at current frequency. eGFR should be rechecked at 72hr — acute illness may cause further transient deterioration.', tone: 'amber' });
  }

  // Conclusion
  var conclusion = '';
  if (abxWorsening()) {
    conclusion = 'Treatment failure must be assumed until proven otherwise. Urgent escalation of antimicrobial spectrum, urgent culture review, and infectious diseases input are all indicated. Do not de-escalate.';
  } else if (abxImproving() && (abxCultureSensitive() || abxCultureNoGrowth())) {
    conclusion = 'IV-to-oral de-escalation is clinically and microbiologically supported. Step-down should proceed once prescriber reviews and consents — maintaining current IV therapy beyond this point is not stewardship-appropriate.';
  } else if (abxImproving() && abxCulturePending()) {
    conclusion = 'Clinical criteria for IV-to-oral step-down are met. De-escalation should proceed or be formally planned pending culture confirmation — a pending result alone is not sufficient reason to delay in a clinically improving patient.';
  } else if (abxImproving() && abxCultureResistant()) {
    conclusion = 'Despite clinical improvement, the resistant organism mandates continued broad-spectrum IV therapy. Stewardship should focus on duration optimisation and ensuring the narrowest effective agent is selected based on susceptibility data.';
  } else {
    conclusion = 'Reassess in 48 hours. Continue current therapy and use the interim period to obtain culture data, recheck inflammatory markers, and formally document clinical trajectory criteria.';
  }

  var parasEl = document.getElementById('abx-ci-paragraphs');
  if (parasEl) {
    parasEl.innerHTML = lines.map(function(l) {
      return '<div class="ci-line ci-line-' + l.tone + '">' + l.text + '</div>';
    }).join('');
  }
  var concEl = document.getElementById('abx-ci-conclusion');
  if (concEl) concEl.innerHTML = '<span class="ci-conclusion-label">Clinical direction</span>' + conclusion;
}

/* ── 4. Recommendation ───────────────────────────────────────────────────── */
function abxUpdateRecommendation() {
  function setEl(id, v) { var e = document.getElementById(id); if (e) e.innerHTML = v; }
  function setText(id, v) { var e = document.getElementById(id); if (e) e.textContent = v; }

  var action, state, rationale, conf, confLabel, confDesc, chip1, chip2, chip3, chip4;
  var deescTarget, prereq;

  if (abxWorsening()) {
    action = 'Escalate<br>Therapy'; state = 'Urgent — treatment failure';
    conf = 88; confLabel = 'High confidence'; confDesc = 'Clinical deterioration is a firm escalation trigger';
    rationale = 'Patient is clinically deteriorating on current antimicrobial therapy. This constitutes a treatment failure signal. Escalation of antimicrobial spectrum is indicated, along with urgent repeat cultures, infectious diseases review, and reassessment of the working diagnosis. Do not de-escalate.';
    chip1 = '<span class="ds-primary-ev-chip strong">Treatment failure criteria met</span>';
    chip2 = '<span class="ds-primary-ev-chip caution">Urgent ID review indicated</span>';
    chip3 = '<span class="ds-primary-ev-chip caution">Repeat cultures before escalating</span>';
    chip4 = abxGfrSevere() ? '<span class="ds-primary-ev-chip caution">Severe renal impairment — agent selection critical</span>' : '<span class="ds-primary-ev-chip">Maintain renal dose monitoring</span>';
    deescTarget = 'Infectious diseases input<br><span class="ds-pcol-sub">Before any agent change</span>';
    prereq = 'Repeat blood cultures<br><span class="ds-pcol-sub">Obtain before escalating</span>';
    // Update wn states
    var s1 = document.getElementById('abx-wn-deesc-state'); if(s1){ s1.textContent='Not appropriate'; s1.className='wn-col-state avoid'; }
    var s2 = document.getElementById('abx-wn-esc-state');  if(s2){ s2.textContent='Required'; s2.className='wn-col-state'; }
    var r1 = document.getElementById('abx-wn-deesc'); if(r1) r1.textContent = 'Clinical deterioration is an absolute contraindication to de-escalation regardless of culture data.';
    var r2 = document.getElementById('abx-wn-esc');   if(r2) r2.textContent = 'Treatment failure is the only established escalation trigger. It is present here.';
    var r3 = document.getElementById('abx-wn-continue'); if(r3) r3.textContent = 'Continuing current therapy without change is inappropriate given documented deterioration.';
    var ci = document.getElementById('abx-wn-culture-item'); if(ci) ci.textContent = 'Repeat cultures before changing therapy — existing results insufficient if taken on admission only.';
  } else if (ABX.improvement === 'stable' && !abxCultureSensitive() && !abxCultureNoGrowth()) {
    action = 'Reassess<br>in 48 Hours'; state = 'Observe — insufficient signal';
    conf = 62; confLabel = 'Moderate confidence'; confDesc = 'Stable trajectory without clear improvement or deterioration';
    rationale = 'Patient is stable but has not demonstrated meaningful clinical improvement. Inflammatory markers remain elevated and culture data is not yet available to guide de-escalation. The appropriate stewardship action is to continue current therapy and formally reassess at 48 hours with updated culture results and clinical status. Neither escalation nor de-escalation is supported by the current data.';
    chip1 = '<span class="ds-primary-ev-chip">Continue current therapy</span>';
    chip2 = '<span class="ds-primary-ev-chip caution">Await culture result</span>';
    chip3 = '<span class="ds-primary-ev-chip caution">Reassess at 48hr with updated labs</span>';
    chip4 = abxGfrImpaired() ? '<span class="ds-primary-ev-chip caution">Renal dose monitoring</span>' : '<span class="ds-primary-ev-chip">No dose adjustment required</span>';
    deescTarget = 'Defer pending culture<br><span class="ds-pcol-sub">Reassess at 48hr</span>';
    prereq = 'Updated clinical assessment<br><span class="ds-pcol-sub">Plus culture result</span>';
    var s1 = document.getElementById('abx-wn-deesc-state'); if(s1){ s1.textContent='Not yet'; s1.className='wn-col-state cond'; }
    var s2 = document.getElementById('abx-wn-esc-state');  if(s2){ s2.textContent='Not indicated'; s2.className='wn-col-state avoid'; }
    var r1 = document.getElementById('abx-wn-deesc'); if(r1) r1.textContent = 'De-escalation requires demonstrated clinical improvement — not yet present.';
    var r2 = document.getElementById('abx-wn-esc');   if(r2) r2.textContent = 'No deterioration trigger — escalation would be premature and not stewardship-appropriate.';
    var r3 = document.getElementById('abx-wn-continue'); if(r3) r3.textContent = 'Current therapy is appropriate. Await 48hr data before changing course.';
    var ci = document.getElementById('abx-wn-culture-item'); if(ci) ci.textContent = 'Culture result will be the key determinant of next decision — document plan to review on receipt.';
  } else {
    // Default: de-escalation supported
    var strong = abxCultureSensitive() || abxCultureNoGrowth();
    action = 'Consider<br>De-escalation'; state = strong ? 'Strongly supported' : 'Clinically supported';
    conf = strong ? 86 : 72; 
    confLabel = strong ? 'High confidence' : 'Moderate-high confidence';
    confDesc = strong ? 'Clinical improvement + microbiological support' : 'Clinical trajectory supports step-down · pending culture confirmation';
    rationale = 'Patient is clinically improving with ' + (!abxFeverActive() ? 'defervescence, ' : '') + 'tolerating oral intake, and mobilising. ' + (abxCrpHigh() ? 'Inflammatory markers remain elevated but are on a downward trend — biochemical lag behind clinical response is expected and should not delay step-down in an improving patient. ' : 'Inflammatory markers are settling. ') + (abxCultureNoGrowth() ? 'Seventy-two hour blood cultures show no growth, removing the microbiological argument for continued broad-spectrum IV cover. ' : abxCultureSensitive() ? 'Culture has identified a sensitive organism amenable to narrow-spectrum oral therapy. ' : 'Oral step-down to amoxicillin-clavulanate should be considered once culture data is available. ') + (abxGfrImpaired() ? 'Dose adjustment for renal impairment is maintained throughout.' : '');
    chip1 = '<span class="ds-primary-ev-chip strong">IDSA Stewardship Principles</span>';
    chip2 = '<span class="ds-primary-ev-chip strong">Clinical improvement outweighs markers</span>';
    chip3 = abxCulturePending() ? '<span class="ds-primary-ev-chip caution">Culture data awaited</span>' : (abxCultureSensitive() ? '<span class="ds-primary-ev-chip strong">Sensitive organism confirmed</span>' : '<span class="ds-primary-ev-chip strong">No growth at 72hr</span>');
    chip4 = abxGfrImpaired() ? '<span class="ds-primary-ev-chip caution">Renal dose adjustment maintained</span>' : '<span class="ds-primary-ev-chip">Standard oral dosing</span>';
    deescTarget = 'Oral amoxicillin-clavulanate<br><span class="ds-pcol-sub">If no resistant organism</span>';
    prereq = abxCulturePending() ? '72-hr culture result<br><span class="ds-pcol-sub">No growth or sensitive organism</span>' : '<span style="color:var(--green)">Culture criteria met</span><br><span class="ds-pcol-sub">Proceed when prescriber reviews</span>';
    var s1 = document.getElementById('abx-wn-deesc-state'); if(s1){ s1.textContent='Preferred'; s1.className='wn-col-state'; }
    var s2 = document.getElementById('abx-wn-esc-state');  if(s2){ s2.textContent='Not indicated'; s2.className='wn-col-state avoid'; }
    var r1 = document.getElementById('abx-wn-deesc'); if(r1) r1.textContent = 'Clinical improvement is the primary trigger for IV-to-oral step-down.';
    var r2 = document.getElementById('abx-wn-esc');   if(r2) r2.textContent = 'No clinical or microbiological trigger for escalation at this review.';
    var r3 = document.getElementById('abx-wn-continue'); if(r3) r3.textContent = 'Continued IV therapy beyond clinical stability criteria carries line infection risk without additional clinical benefit.';
    var ci = document.getElementById('abx-wn-culture-item'); if(ci) ci.textContent = abxCulturePending() ? 'Await culture result before finalising — no growth likely supports narrow-spectrum oral.' : (abxCultureSensitive() ? 'Culture supports narrow-spectrum oral agent — de-escalation fully appropriate.' : 'No growth at 72hr removes the microbiological argument for continued broad-spectrum IV.');
  }

  // Write to DOM
  setEl('abx-rec-action', action);
  setText('abx-rec-state', state);
  setText('abx-rec-rationale', rationale);
  var chipsRow = document.querySelector('#abx-section-recommendation .ds-primary-ev-chips');
  if (chipsRow) chipsRow.innerHTML = chip1 + chip2 + chip3 + chip4;
  setText('abx-conf-pct', conf + '%');
  setText('abx-conf-label', confLabel);
  setText('abx-conf-desc', confDesc);
  var bar = document.getElementById('abx-conf-bar'); if (bar) bar.style.width = conf + '%';
  setEl('abx-deesc-target', deescTarget);
  setEl('abx-prerequisite', prereq);
}

/* ── 5. Monitoring ───────────────────────────────────────────────────────── */
function abxUpdateMonitoring() {
  // Renal dosing row
  var rdEl = document.getElementById('abx-rd-piptz');
  var rdNote = document.getElementById('abx-rd-piptz-note');
  if (rdEl) {
    if (abxGfrSevere()) {
      rdEl.textContent = '2.25 g TDS (eGFR <30)';
      rdEl.className = 'renal-dosing-val renal-dosing-val-amber';
      if (rdNote) rdNote.textContent = 'Significant dose reduction required. Consider extended infusion strategy. Review with pharmacy.';
    } else if (abxGfrImpaired()) {
      rdEl.textContent = '4.5 g TDS (eGFR 30–59)';
      rdEl.className = 'renal-dosing-val renal-dosing-val-amber';
      if (rdNote) rdNote.textContent = 'Dose interval extended per renal guidance. Standard dose 4.5 g QDS at eGFR ≥60.';
    } else {
      rdEl.textContent = '4.5 g QDS (eGFR ≥60)';
      rdEl.className = 'renal-dosing-val';
      if (rdNote) rdNote.textContent = 'Standard dosing. No renal adjustment required at current eGFR.';
    }
  }

  // Flag 1 — culture
  var flag1 = document.getElementById('abx-flag-1');
  if (flag1) {
    if (abxCultureResistant()) flag1.innerHTML = '<span class="mn-contra-x">⚠</span> Resistant organism confirmed — broad-spectrum IV must be maintained. Consult microbiology urgently.';
    else if (abxCultureNoGrowth()) flag1.innerHTML = '<span class="mn-contra-x">ℹ</span> Culture negative at 72hr — supports de-escalation if clinical criteria met.';
    else if (abxCultureSensitive()) flag1.innerHTML = '<span class="mn-contra-x">ℹ</span> Sensitive organism — narrow-spectrum oral step-down is microbiologically supported.';
    else flag1.innerHTML = '<span class="mn-contra-x">⚠</span> Culture-negative at 72hr — reassess empirical spectrum. Consider narrowing if clinical picture supports.';
  }

  // Flag renal
  var flagR = document.getElementById('abx-flag-renal');
  if (flagR) {
    if (abxGfrSevere()) flagR.innerHTML = '<span class="mn-contra-x">⚠</span> Severe renal impairment (eGFR ' + ABX.gfr + ') — urgent dose review required. Avoid all nephrotoxic agents.';
    else if (abxGfrImpaired()) flagR.innerHTML = '<span class="mn-contra-x">⚠</span> eGFR ' + ABX.gfr + ' — monitor for acute kidney injury during course. Stop all nephrotoxic agents if eGFR falls >20%.';
    else flagR.innerHTML = '<span class="mn-contra-x">ℹ</span> Renal function normal (eGFR ' + ABX.gfr + '). Continue standard monitoring throughout antimicrobial course.';
  }
}


/* ════════════════════════════════════════════════════════════
   SECTION 22 — INITIALISATION
════════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', function() {
  // Show the selector on load instead of the OA entry page directly
  var ep = document.getElementById('entry-page');
  var sp = document.getElementById('selector-page');
  if (ep) ep.style.display = 'none';
  if (sp) sp.style.display = 'block';

  // Core OA reasoning engine boot (runs in background — needed when user enters OA workflow)
  updateParamTiles();
  updateComplexityBar();
  updateClinicalStatusSummary();
  updateClinicalImpression();
  var rec    = buildPrimaryRec();
  var nsaidR = buildNsaidReasoning();
  _isFirstRun = true;
  updateClinicalReasoningPanel(rec, nsaidR);
  updateTradeoffStrip();
  updateEscalationTags();
  updateRenalDosingBlock();
  updateInterventionPanel(rec);

  // Polypharmacy & longitudinal
  updatePolypharmacyPanel();
  initLongitudinalProgression();

  // Handoff meta
  updateHandoffMeta();

  // ABX engine pre-warm
  abxRunReasoningEngine();
});
