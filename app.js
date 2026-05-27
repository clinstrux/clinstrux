/* ══════════════════════════════════════════════════════════
   CLINSTRUX PATIENT PARAMETER ENGINE v1.0
   All reasoning logic is client-side and parameter-driven.
   No chatbot. No AI summary. Pure clinical rule engine.
══════════════════════════════════════════════════════════ */

// ── Patient state object ──
var P = {
  egfr: 58,
  gi: 'ulcer',           // none | dyspepsia | ulcer | ulcer-recent | bleed
  bp: 128,
  cv: 'mod',             // low | mod | high | very-high
  pain: 6,
  age: 68,
  failed: '2nsaid',      // none | physio | apap | 1nsaid | 2nsaid | multi
  adh: 'partial',        // good | partial | poor | unknown
  sed: 'high',           // none | mod | high | fall
  intol: 'both-nsaid'    // none | gi-nsaid | bp-nsaid | both-nsaid | apap | multi
};

// ── Navigation ──
function showSection(id, btn) {
  document.querySelectorAll('.dp-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.dp-nav-item').forEach(b => b.classList.remove('active'));
  document.getElementById('section-' + id).classList.add('active');
  btn.classList.add('active');
  window.scrollTo({top: 0, behavior: 'smooth'});
}
function showNoteTab(id, btn) {
  document.querySelectorAll('.cn-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.cn-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('cn-panel-' + id).classList.add('active');
  btn.classList.add('active');
}
function setEvFilter(btn) {
  document.querySelectorAll('.ev-filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

// ── Popover system ──
var _activePopover = null;

function openPopover(key, evt) {
  evt.stopPropagation();
  if (_activePopover) closePopover(_activePopover);
  var pop = document.getElementById('pop-' + key);
  var trigger = evt.currentTarget;
  var rect = trigger.getBoundingClientRect();
  
  // Sync current state into popover inputs
  if (key === 'egfr') document.getElementById('rng-egfr').value = P.egfr, document.getElementById('rng-egfr-val').textContent = P.egfr;
  if (key === 'bp')   document.getElementById('rng-bp').value = P.bp, document.getElementById('rng-bp-val').textContent = P.bp;
  if (key === 'pain') document.getElementById('rng-pain').value = P.pain, document.getElementById('rng-pain-val').textContent = P.pain;
  if (key === 'age')  document.getElementById('rng-age').value = P.age, document.getElementById('rng-age-val').textContent = P.age;
  if (key === 'gi')   document.getElementById('sel-gi').value = P.gi;
  if (key === 'cv')   document.getElementById('sel-cv').value = P.cv;
  if (key === 'failed') document.getElementById('sel-failed').value = P.failed;
  if (key === 'adh')  document.getElementById('sel-adh').value = P.adh;
  if (key === 'sed')  document.getElementById('sel-sed').value = P.sed;
  if (key === 'intol') document.getElementById('sel-intol').value = P.intol;

  pop.style.display = 'block';
  pop.classList.add('open');
  
  // Position relative to viewport
  var top = rect.bottom + 6;
  var left = rect.left;
  if (left + 240 > window.innerWidth - 10) left = window.innerWidth - 250;
  if (top + 200 > window.innerHeight) top = rect.top - 200 - 6;
  pop.style.top = top + 'px';
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
  if (key === 'egfr')   P.egfr   = parseInt(document.getElementById('rng-egfr').value);
  if (key === 'bp')     P.bp     = parseInt(document.getElementById('rng-bp').value);
  if (key === 'pain')   P.pain   = parseInt(document.getElementById('rng-pain').value);
  if (key === 'age')    P.age    = parseInt(document.getElementById('rng-age').value);
  if (key === 'gi')     P.gi     = document.getElementById('sel-gi').value;
  if (key === 'cv')     P.cv     = document.getElementById('sel-cv').value;
  if (key === 'failed') P.failed = document.getElementById('sel-failed').value;
  if (key === 'adh')    P.adh    = document.getElementById('sel-adh').value;
  if (key === 'sed')    P.sed    = document.getElementById('sel-sed').value;
  if (key === 'intol')  P.intol  = document.getElementById('sel-intol').value;
  closePopover(key);
  runReasoningEngine();
}

function dismissUpdateBanner() {
  document.getElementById('ip-update-banner').classList.remove('visible');
}

// ── Scoring helpers ──
function egfrRisk() {
  if (P.egfr >= 60) return 'low';
  if (P.egfr >= 45) return 'mild';
  if (P.egfr >= 30) return 'moderate';
  return 'severe';
}
function giRisk() {
  var m = {none:'low', dyspepsia:'low', ulcer:'high', 'ulcer-recent':'very-high', bleed:'very-high'};
  return m[P.gi] || 'high';
}
function bpControl() {
  if (P.bp < 130) return 'controlled';
  if (P.bp < 150) return 'mildly-elevated';
  if (P.bp < 170) return 'elevated';
  return 'uncontrolled';
}
function ageFlag() { return P.age >= 65; }
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
function apapContraindicated() {
  return P.intol === 'apap' || P.intol === 'multi';
}
function multimodalFailure() {
  return P.failed === 'multi';
}
function acetaminophenFailed() {
  return P.failed === 'apap' || P.failed === 'multi';
}

// ── Complexity score 0-100 ──
function computeComplexity() {
  var score = 0;
  // eGFR
  if (P.egfr < 30) score += 20;
  else if (P.egfr < 45) score += 15;
  else if (P.egfr < 60) score += 8;
  // GI
  if (P.gi === 'bleed') score += 20;
  else if (P.gi === 'ulcer-recent') score += 18;
  else if (P.gi === 'ulcer') score += 12;
  else if (P.gi === 'dyspepsia') score += 5;
  // BP
  if (P.bp >= 170) score += 15;
  else if (P.bp >= 150) score += 10;
  else if (P.bp >= 130) score += 5;
  // CV
  if (P.cv === 'very-high') score += 12;
  else if (P.cv === 'high') score += 8;
  else if (P.cv === 'mod') score += 4;
  // Pain
  if (P.pain >= 9) score += 8;
  else if (P.pain >= 7) score += 5;
  // Age
  if (P.age >= 80) score += 8;
  else if (P.age >= 65) score += 5;
  // Failed
  if (P.failed === 'multi') score += 10;
  else if (P.failed === 'apap') score += 8;
  else if (P.failed === '2nsaid') score += 5;
  // Adherence
  if (P.adh === 'poor') score += 5;
  // Sedation
  if (P.sed === 'fall') score += 5;
  else if (P.sed === 'high') score += 3;
  return Math.min(score, 100);
}

// ── Label helpers ──
function egfrLabel() {
  var r = egfrRisk();
  if (r === 'low') return 'Normal / mild';
  if (r === 'mild') return 'Mild impairment';
  if (r === 'moderate') return 'Moderate CKD';
  return 'Severe — high risk';
}
function giLabel() {
  var m = {none:'No GI history', dyspepsia:'Dyspepsia only', ulcer:'Prior peptic ulcer', 'ulcer-recent':'Active / recent ulcer', bleed:'Prior GI bleed'};
  return m[P.gi];
}
function giRiskLabel() {
  var m = {none:'Baseline risk', dyspepsia:'Low-moderate risk', ulcer:'High risk', 'ulcer-recent':'Very high risk', bleed:'Very high risk'};
  return m[P.gi];
}
function bpLabel() { return P.bp + ' mmHg systolic'; }
function bpRiskLabel() {
  var c = bpControl();
  if (c === 'controlled') return 'Controlled';
  if (c === 'mildly-elevated') return 'Mildly elevated';
  if (c === 'elevated') return 'Elevated — monitor';
  return 'Uncontrolled — flag';
}
function cvLabel() {
  var m = {low:'Low', mod:'Moderate', high:'High', 'very-high':'Very high'};
  return m[P.cv];
}
function cvRiskLabel() {
  var m = {low:'No major factors', mod:'Hypertension', high:'Multiple risk factors', 'very-high':'Established CVD'};
  return m[P.cv];
}
function painLabel() { return P.pain + ' / 10'; }
function painRiskLabel() {
  if (P.pain <= 3) return 'Mild';
  if (P.pain <= 6) return 'Moderate';
  if (P.pain <= 8) return 'Severe';
  return 'Very severe';
}
function ageLabel() { return P.age + ' years'; }
function ageRiskLabel() { return P.age >= 65 ? '≥65 flag active' : 'No age flag'; }
function failedLabel() {
  var m = {none:'No prior therapies', physio:'Physio only', apap:'Acetaminophen failed', '1nsaid':'1 NSAID failed', '2nsaid':'2 NSAIDs failed', multi:'Multiple classes failed'};
  return m[P.failed];
}
function failedRiskLabel() {
  var m = {none:'Treatment naive', physio:'Analgesic naive', apap:'Core option exhausted', '1nsaid':'Intolerance documented', '2nsaid':'Intolerance documented', multi:'Multimodal failure'};
  return m[P.failed];
}
function adhLabel() {
  var m = {good:'Good adherence', partial:'Inconsistent PRN', poor:'Poor adherence', unknown:'Adherence unknown'};
  return m[P.adh];
}
function adhRiskLabel() {
  var m = {good:'Low concern', partial:'Concern noted', poor:'High concern', unknown:'Assess at next visit'};
  return m[P.adh];
}
function sedLabel() {
  var m = {none:'No concern', mod:'Mild preference', high:'High concern', fall:'Fall risk active'};
  return m[P.sed];
}
function sedRiskLabel() {
  var m = {none:'Accepts sedation', mod:'Prefers non-sedating', high:'Patient refuses sedation', fall:'Sedation contraindicated'};
  return m[P.sed];
}
function intolLabel() {
  var m = {none:'None documented', 'gi-nsaid':'NSAIDs: GI only', 'bp-nsaid':'NSAIDs: BP only', 'both-nsaid':'NSAIDs: GI + BP', apap:'Acetaminophen', multi:'Multiple classes'};
  return m[P.intol];
}
function intolRiskLabel() {
  var m = {none:'No intolerance', 'gi-nsaid':'Documented × 1', 'bp-nsaid':'Documented × 1', 'both-nsaid':'Documented × 2', apap:'Key option affected', multi:'Multiple affected'};
  return m[P.intol];
}

// ── Risk CSS class helpers ──
function egfrClass() { var r = egfrRisk(); return r==='low'?'ip-val-ok': r==='mild'?'ip-val-warning':'ip-val-danger'; }
function giClass() { var r = giRisk(); return r==='low'?'ip-val-ok':'ip-val-danger'; }
function bpClass() { var c = bpControl(); return c==='controlled'?'ip-val-ok': c==='uncontrolled'?'ip-val-danger':'ip-val-warning'; }
function egfrParamClass() { var r = egfrRisk(); return r==='low'?'': r==='mild'?'ip-warning':'ip-danger'; }
function giParamClass() { var r = giRisk(); return r==='low'?'':'ip-danger'; }
function bpParamClass() { var c = bpControl(); return c==='controlled'?'': c==='uncontrolled'?'ip-danger':'ip-warning'; }
function egfrRiskClass() { var r = egfrRisk(); return r==='low'?'r-low':'r-mod'; }
function giRiskClass() { var r = giRisk(); return r==='low'?'r-low':r==='high'||r==='very-high'?'r-high':'r-mod'; }
function bpRiskClass() { var c = bpControl(); return c==='controlled'?'r-low': c==='uncontrolled'?'r-high':'r-mod'; }

// ── Build primary recommendation ──
function buildPrimaryRec() {
  // Decide recommended drug
  var drug, state, rationale, confPct, confLabel, confDesc;
  
  if (apapContraindicated()) {
    // Acetaminophen itself is problematic
    if (!nsaidContraindicated() && P.cv !== 'very-high') {
      drug = 'Low-dose NSAID\n+ PPI cover';
      state = 'Escalation Required';
      confPct = 55; confLabel = 'Moderate confidence';
      confDesc = 'Acetaminophen intolerance shifts first-line pathway · Close GI monitoring';
      rationale = 'Acetaminophen contraindicated or failed — documented intolerance shifts the first-line recommendation. Low-dose NSAID with mandatory PPI cover is the next appropriate option. Intensive GI and renal monitoring required given patient profile. This represents a high-risk therapeutic pathway.';
    } else {
      drug = 'Specialist Review\nRequired';
      state = 'Escalation — No Safe First-Line';
      confPct = 38; confLabel = 'Low confidence — complex case';
      confDesc = 'Acetaminophen and NSAID pathways both compromised · Specialist input needed';
      rationale = 'Both primary analgesic pathways are compromised in this patient. Acetaminophen intolerance and NSAID contraindications leave limited safe pharmacological options for this severity of pain. Specialist rheumatology or pain medicine referral is recommended before initiating further pharmacotherapy.';
    }
  } else if (nsaidContraindicated()) {
    drug = 'Acetaminophen\n(Paracetamol)';
    state = 'Preferred · First-line';
    confPct = 82; confLabel = 'High confidence';
    confDesc = 'Supported by ACR/EULAR guidelines · Multiple RCTs';
    // Build rationale dynamically from active contraindications
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
    // High pain + prior failures
    drug = 'Acetaminophen\n+ Topical NSAID';
    state = 'Combination · First-line';
    confPct = 70; confLabel = 'Moderate-High confidence';
    confDesc = 'Combination approach for severe pain with prior monotherapy failure';
    rationale = 'Severe pain (' + P.pain + '/10) combined with prior analgesic failures supports combination first-line approach. Acetaminophen provides systemic baseline analgesia; topical NSAID provides localized anti-inflammatory effect with lower systemic exposure. Monitor renal and GI parameters.';
  } else {
    drug = 'Acetaminophen\n(Paracetamol)';
    state = 'Preferred · First-line';
    confPct = 78; confLabel = 'High confidence';
    confDesc = 'ACR guideline aligned · Multiple RCT support';
    rationale = 'Acetaminophen remains the safest first-line analgesic for this patient given current risk profile. Pain severity (' + P.pain + '/10) is appropriate for acetaminophen monotherapy at this stage.';
  }
  
  // Adjust confidence down for very complex profiles
  var complexity = computeComplexity();
  if (complexity > 75) confPct = Math.max(confPct - 10, 35);
  if (P.adh === 'poor') confPct = Math.max(confPct - 5, 35);
  
  // ── Uncertainty adjustments ──
  // Unverified adherence reduces outcome confidence
  var uncertaintyQualifier = '';
  var confBand = '';
  if (P.adh === 'partial' || P.adh === 'unknown') {
    confPct = Math.max(confPct - 5, 35);
    confBand = ' ±6%';
    uncertaintyQualifier = 'Adherence history unverified — outcome confidence is reduced until fixed-schedule use is confirmed at Week 2.';
  }
  if (P.adh === 'poor') {
    confBand = ' ±8%';
    uncertaintyQualifier = 'Poor and unverified adherence significantly limits treatment response predictability. Efficacy assessment requires confirmed adherence.';
  }
  // Borderline renal with no trend data reduces escalation confidence
  if (P.egfr >= 50 && P.egfr <= 62) {
    confPct = Math.max(confPct - 4, 35);
    if (!confBand) confBand = ' ±5%';
    if (!uncertaintyQualifier) uncertaintyQualifier = 'Borderline eGFR (G2/G3a) without trend data — renal trajectory direction is unconfirmed. Escalation window may narrow if declining.';
    else uncertaintyQualifier += ' Renal trajectory also unconfirmed at this stage.';
  }
  
  return {drug, state, rationale, confPct, confLabel, confDesc, confBand, uncertaintyQualifier};
}

// ── Build NSAID why-not reasoning ──
function buildNsaidReasoning() {
  var reasons = [];
  var state, reason;
  
  if (nsaidContraindicated()) {
    state = 'Avoid';
    if (giRisk() === 'very-high') {
      reason = 'Multiple absolute contraindications make NSAID use clinically unsafe in this patient.';
      reasons.push({id:'dyn-nsaid-gi', text: P.gi === 'bleed'
        ? 'Active or prior GI bleed — NSAID initiation carries high probability of re-bleeding. Absolute contraindication.'
        : 'Recent peptic ulcer (&lt;1yr) substantially elevates NSAID-related GI complication risk. Contraindicated.'});
    } else if (giRisk() === 'high') {
      reason = 'Compound contraindication profile renders NSAIDs inappropriate as analgesic pathway.';
      reasons.push({id:'dyn-nsaid-gi', text: 'Elevated GI bleeding risk — prior peptic ulcer + documented NSAID-induced GI intolerance ('
        + (P.intol==='both-nsaid'||P.intol==='gi-nsaid' ? 'ibuprofen, diclofenac both failed' : 'intolerance documented') + ')'});
    } else {
      reason = 'NSAIDs deprioritized due to safety profile in this patient context.';
      reasons.push({id:'dyn-nsaid-gi', text: 'GI risk present — careful monitoring would be required if NSAID pathway considered in future'});
    }
    
    if (bpControl() === 'uncontrolled') {
      reasons.push({id:'dyn-nsaid-bp', text: 'Hypertension uncontrolled (' + P.bp + ' mmHg systolic) — NSAID initiation carries clinically significant risk of further BP elevation'});
    } else if (P.intol === 'bp-nsaid' || P.intol === 'both-nsaid') {
      reasons.push({id:'dyn-nsaid-bp', text: 'BP elevation documented with prior NSAID use — previous diclofenac caused +18 mmHg systolic; amlodipine efficacy may be compromised'});
    } else {
      reasons.push({id:'dyn-nsaid-bp', text: 'CV monitoring required if NSAID pathway ever initiated — controlled hypertension present'});
    }
    
    if (P.egfr < 30) {
      reasons.push({id:'dyn-nsaid-renal', text: 'Severe renal impairment (eGFR ' + P.egfr + ') — NSAIDs absolutely contraindicated; prostaglandin-dependent renal perfusion at high risk'});
    } else if (P.egfr < 45) {
      reasons.push({id:'dyn-nsaid-renal', text: 'Moderate renal impairment (eGFR ' + P.egfr + ') — NSAIDs impair renal perfusion significantly at this eGFR; avoid unless absolutely necessary'});
    } else {
      reasons.push({id:'dyn-nsaid-renal', text: 'Renal monitoring concern — eGFR ' + P.egfr + '; NSAIDs impair renal perfusion and cannot be safely initiated without close monitoring'});
    }
    
    if (ageFlag()) {
      reasons.push({id:'dyn-nsaid-age', text: 'Age ' + P.age + ' — Beers Criteria (AGS 2023) recommends against NSAIDs in adults ≥65 unless all alternatives exhausted'});
    } else {
      reasons.push({id:'dyn-nsaid-age', text: 'Patient age (' + P.age + ') does not trigger Beers Criteria flag — age is not the primary contraindication driver in this profile'});
    }
  } else {
    // NSAID is now potentially acceptable
    state = 'Conditional';
    reason = 'NSAIDs are not absolutely contraindicated in this updated profile, but remain a secondary option to acetaminophen due to residual risk factors.';
    reasons.push({id:'dyn-nsaid-gi', text: 'GI risk remains present — ' + giLabel().toLowerCase() + '. Low-dose with PPI cover required.'});
    reasons.push({id:'dyn-nsaid-bp', text: 'BP status: ' + bpRiskLabel() + ' (' + P.bp + ' mmHg) — monitor BP closely if NSAID initiated'});
    reasons.push({id:'dyn-nsaid-renal', text: 'Renal function: eGFR ' + P.egfr + ' — baseline monitoring required at 2 and 6 weeks if NSAID started'});
    reasons.push({id:'dyn-nsaid-age', text: ageFlag() ? 'Age ' + P.age + ' — Beers Criteria flag remains active; use lowest effective dose and shortest duration' : 'Age ' + P.age + ' — no Beers flag; standard dosing considerations apply'});
  }
  
  return {state, reason, reasons};
}

// ── Build opioid reasoning ──
function buildOpioidReasoning() {
  var avoidable = opioidAvoidable();
  var multimodal = multimodalFailure();
  
  if (multimodal && !avoidable) {
    return {
      state: 'Escalation Option',
      reason: 'Multimodal pharmacotherapy failure noted — low-dose opioid may be considered with specialist oversight and careful fall-risk assessment.'
    };
  }
  
  var reason = '';
  if (P.sed === 'fall') {
    reason = 'Active fall risk combined with opioid sedation potential makes this pathway contraindicated without specialist oversight.';
  } else if (P.sed === 'high') {
    reason = 'Patient explicitly refuses sedating agents — opioid pathway not clinically appropriate at this stage.';
  } else if (ageFlag() && P.sed !== 'none') {
    reason = 'Age ' + P.age + ' with sedation concern — opioid metabolite clearance and fall-risk profile make opioids an unfavorable choice.';
  } else {
    reason = 'Opioid pathway remains a last-resort escalation. Current pain severity and stage of multimodal management do not support opioid initiation.';
  }
  
  return {state: avoidable ? 'Avoid' : 'Last Resort', reason};
}

// ── Update follow-up interval urgency ──
function buildFollowupUrgency() {
  var complexity = computeComplexity();
  if (complexity >= 75) return {wk2: 'Week 1', wk4: 'Week 2–3', tone: 'Compress follow-up intervals — high complexity profile requires accelerated reassessment.'};
  if (P.pain >= 8) return {wk2: 'Week 2', wk4: 'Week 3–4', tone: 'Severe pain warrants early reassessment checkpoint.'};
  return {wk2: 'Week 2', wk4: 'Week 4', tone: 'Standard follow-up intervals appropriate for this risk profile.'};
}

// ── Update monitoring contraindications ──
function updateContraindications() {
  var renalEl = document.getElementById('dyn-contra-renal');
  var bpEl = document.getElementById('dyn-contra-bp');
  var sedEl = document.getElementById('dyn-contra-sed');
  
  if (P.egfr < 30) {
    renalEl.innerHTML = '<span class="mn-contra-x">✕</span> <strong>Active warning:</strong> eGFR ' + P.egfr + ' — NSAIDs absolutely contraindicated. Acetaminophen dose reduction required. Nephrology referral threshold approaching.';
    renalEl.style.color = 'var(--red)';
    renalEl.style.fontWeight = '600';
  } else if (P.egfr < 45) {
    renalEl.innerHTML = '<span class="mn-contra-x">✕</span> <strong>Elevated risk:</strong> eGFR ' + P.egfr + ' (moderate CKD) — NSAIDs unsafe at this renal function. Monitor closely. Avoid escalation without nephrology input.';
    renalEl.style.color = 'var(--amber)';
    renalEl.style.fontWeight = '600';
  } else {
    renalEl.innerHTML = '<span class="mn-contra-x">✕</span> eGFR &lt;30 — avoid NSAIDs entirely; acetaminophen dose reduction required. Current eGFR ' + P.egfr + ' — monitor trajectory.';
    renalEl.style.color = '';
    renalEl.style.fontWeight = '';
  }
  
  if (bpControl() === 'uncontrolled') {
    bpEl.innerHTML = '<span class="mn-contra-x">✕</span> <strong>Active flag:</strong> BP ' + P.bp + ' mmHg — NSAID initiation contraindicated. Review amlodipine dose. Do not escalate to NSAID until BP &lt;150 mmHg.';
    bpEl.style.color = 'var(--red)';
    bpEl.style.fontWeight = '600';
  } else {
    bpEl.innerHTML = '<span class="mn-contra-x">✕</span> Uncontrolled hypertension (SBP &gt;160) — avoid NSAIDs until BP controlled. Current BP: ' + P.bp + ' mmHg (' + bpRiskLabel() + ')';
    bpEl.style.color = bpControl() === 'elevated' ? 'var(--amber)' : '';
    bpEl.style.fontWeight = bpControl() === 'elevated' ? '600' : '';
  }
  
  if (P.sed === 'fall') {
    sedEl.innerHTML = '<span class="mn-contra-x">✕</span> <strong>Active fall risk:</strong> Sedating agents (opioids, duloxetine, gabapentinoids) are contraindicated without formal fall risk assessment and specialist sign-off.';
    sedEl.style.color = 'var(--red)';
    sedEl.style.fontWeight = '600';
  } else if (P.sed === 'high') {
    sedEl.innerHTML = '<span class="mn-contra-x">✕</span> Patient expressly refuses sedating agents — sedation concern documented. All neuromodulators require explicit patient consent and counselling on sedation risk before initiation.';
    sedEl.style.color = 'var(--amber)';
    sedEl.style.fontWeight = '600';
  } else if (P.sed === 'none') {
    sedEl.innerHTML = '<span class="mn-contra-x">✕</span> Sedation tolerance documented — patient accepts sedating agents if benefit is explained. Standard sedation monitoring applies.';
    sedEl.style.color = 'var(--green)';
    sedEl.style.fontWeight = '';
  } else {
    sedEl.innerHTML = '<span class="mn-contra-x">✕</span> Sedating agents (opioids, high-dose duloxetine) without fall-risk assessment — patient prefers non-sedating agents; discussion required before initiating.';
    sedEl.style.color = '';
    sedEl.style.fontWeight = '';
  }
}

// ── Dynamic renal dosing block in Monitoring section ──
function updateRenalDosingBlock() {
  var apapVal = document.getElementById('dyn-rd-apap-val');
  var apapNote = document.getElementById('dyn-rd-apap-note');
  var nsaidVal = document.getElementById('dyn-rd-nsaid-val');
  var nsaidNote = document.getElementById('dyn-rd-nsaid-note');
  var opioidVal = document.getElementById('dyn-rd-opioid-val');
  var opioidNote = document.getElementById('dyn-rd-opioid-note');
  var trajNote = document.getElementById('dyn-rd-trajectory-note');
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

// ── Complexity display ──
function updateComplexityBar() {
  var score = computeComplexity();
  var fill = document.getElementById('ip-complexity-fill');
  var scoreEl = document.getElementById('ip-complexity-score');
  var descEl = document.getElementById('ip-complexity-desc');
  
  fill.style.width = score + '%';
  scoreEl.textContent = score;
  
  var color, desc;
  if (score >= 80) {
    color = 'var(--red)';
    desc = '— Critical complexity. Multiple active absolute contraindications. Specialist input likely required.';
  } else if (score >= 60) {
    color = 'var(--amber)';
    desc = '— High-complexity multifactorial profile. Multiple active contraindications.';
  } else if (score >= 35) {
    color = 'var(--blue)';
    desc = '— Moderate complexity. Careful monitoring required. Standard escalation pathways available.';
  } else {
    color = 'var(--green)';
    desc = '— Lower complexity. Straightforward analgesic pathway available.';
  }
  
  fill.style.background = color;
  scoreEl.style.color = color;
  descEl.textContent = desc;
}

// ── Update param panel tiles ──
function updateParamTiles() {
  function setTile(id, valText, riskText, valClass, riskClass, paramClass) {
    var el = document.getElementById('ip-' + id);
    var valEl = document.getElementById('ip-val-' + id);
    var riskEl = document.getElementById('ip-risk-' + id);
    if (valEl) { valEl.textContent = valText; valEl.className = 'ip-param-value ' + valClass; }
    if (riskEl) { riskEl.textContent = riskText; riskEl.className = 'ip-param-risk ' + riskClass; }
    if (el) el.className = 'ip-param ' + paramClass;
  }
  
  setTile('egfr', P.egfr + ' mL/min', egfrLabel(),
    egfrClass(), egfrRisk()==='low'?'r-low': egfrRisk()==='mild'?'r-mod':'r-high', egfrParamClass());
  setTile('gi', giLabel(), giRiskLabel(),
    P.gi==='none'?'ip-val-ok':'ip-val-danger', giRiskClass(), giParamClass());
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

// ── Flash updated elements ──
function flashElement(id) {
  var el = document.getElementById(id);
  if (el) { el.classList.remove('dynamic-updated'); void el.offsetWidth; el.classList.add('dynamic-updated'); }
}

// ── Main reasoning engine ──
function runReasoningEngine() {
  updateParamTiles();
  updateComplexityBar();
  
  // 1. Primary recommendation
  var rec = buildPrimaryRec();
  var primaryDrugEl = document.getElementById('dyn-primary-drug');
  if (primaryDrugEl) {
    primaryDrugEl.innerHTML = rec.drug.replace('\n', '<br>');
    flashElement('dyn-primary-drug');
  }
  var stateEl = document.getElementById('dyn-primary-state');
  if (stateEl) { stateEl.textContent = rec.state; flashElement('dyn-primary-state'); }
  var ratEl = document.getElementById('dyn-primary-rationale');
  if (ratEl) { ratEl.textContent = rec.rationale; flashElement('dyn-primary-rationale'); }
  
  // 2. Confidence strip
  var pctEl = document.getElementById('dyn-conf-pct');
  if (pctEl) {
    // Show band if uncertainty exists
    var bandEl = document.getElementById('dyn-conf-band');
    if (bandEl) bandEl.textContent = rec.confBand || '';
    pctEl.childNodes[0].textContent = rec.confPct + '%';
    flashElement('dyn-conf-pct');
  }
  var lblEl = document.getElementById('dyn-conf-label');
  if (lblEl) { lblEl.textContent = rec.confLabel; }
  var descEl = document.getElementById('dyn-conf-desc');
  if (descEl) { descEl.textContent = rec.confDesc; }
  var barEl = document.getElementById('dyn-conf-bar');
  if (barEl) { barEl.style.width = rec.confPct + '%'; }
  
  // Show/hide uncertainty qualifier line
  var qualEl = document.getElementById('dyn-conf-qualifier');
  if (qualEl) {
    if (rec.uncertaintyQualifier) {
      qualEl.textContent = rec.uncertaintyQualifier;
      qualEl.style.display = 'flex';
    } else {
      qualEl.style.display = 'none';
    }
  }
  
  // Confidence color changes with score
  if (pctEl) {
    if (rec.confPct >= 70) pctEl.style.color = 'rgba(80,210,145,0.95)';
    else if (rec.confPct >= 55) pctEl.style.color = 'rgba(230,165,50,0.9)';
    else pctEl.style.color = 'rgba(255,120,100,0.9)';
  }
  
  // 3. Decision drivers summary
  var drivers = [];
  if (giRisk() !== 'low') drivers.push(giRisk()==='very-high' ? 'Critical GI risk' : 'High GI risk');
  if (ageFlag()) drivers.push('Age ' + P.age + ' (≥65 flag)');
  if (P.intol !== 'none') drivers.push('Documented drug intolerance');
  if (egfrRisk() !== 'low') drivers.push('Renal impairment (eGFR ' + P.egfr + ')');
  if (bpControl() !== 'controlled') drivers.push('BP management (' + P.bp + ' mmHg)');
  if (P.pain >= 8) drivers.push('Severe pain (' + P.pain + '/10)');
  if (P.failed === 'multi') drivers.push('Multimodal failure');
  if (P.adh === 'poor') drivers.push('Adherence concern');
  drivers.push('Long-term management goal');
  
  var driversEl = document.getElementById('dyn-drivers-summary');
  if (driversEl) { driversEl.textContent = drivers.join(' · '); flashElement('dyn-drivers-summary'); }
  
  // 4. NSAID why-not reasoning
  var nsaidR = buildNsaidReasoning();
  var nsaidState = document.getElementById('dyn-nsaid-state');
  if (nsaidState) {
    nsaidState.textContent = nsaidR.state;
    nsaidState.className = 'wn-col-state ' + (nsaidR.state === 'Avoid' ? 'avoid' : 'cond');
  }
  var nsaidReason = document.getElementById('dyn-nsaid-reason');
  if (nsaidReason) { nsaidReason.textContent = nsaidR.reason; flashElement('dyn-nsaid-reason'); }
  nsaidR.reasons.forEach(function(r) {
    var el = document.getElementById(r.id);
    if (el) { el.innerHTML = r.text; }
  });
  
  // 5. Opioid reasoning
  var opioidR = buildOpioidReasoning();
  var opioidState = document.getElementById('dyn-opioid-state');
  if (opioidState) {
    opioidState.textContent = opioidR.state;
    opioidState.className = 'wn-col-state ' + (opioidR.state === 'Avoid' ? 'avoid' : 'esc');
  }
  var opioidReason = document.getElementById('dyn-opioid-reason');
  if (opioidReason) { opioidReason.textContent = opioidR.reason; }
  
  // 6. Opioid renal note
  var opioidRenal = document.getElementById('dyn-opioid-renal');
  if (opioidRenal) {
    if (P.egfr < 30) opioidRenal.textContent = 'Severe renal impairment (eGFR ' + P.egfr + ') — opioid metabolite accumulation is a critical safety concern; morphine-6-glucuronide clearance severely compromised';
    else if (P.egfr < 45) opioidRenal.textContent = 'Moderate renal impairment (eGFR ' + P.egfr + ') — opioid metabolite clearance significantly reduced; dose reduction mandatory if ever initiated';
    else opioidRenal.textContent = 'Renal metabolite clearance — eGFR ' + P.egfr + ' limits elimination of opioid metabolites (esp. morphine-6-glucuronide)';
  }
  
  // 7. Opioid stage note (changes if multimodal failure)
  var opioidStage = document.getElementById('dyn-opioid-stage');
  if (opioidStage) {
    if (multimodalFailure()) opioidStage.textContent = 'Multimodal failure documented — low-dose opioid may warrant specialist consideration if patient sedation profile changes';
    else if (P.failed === 'apap') opioidStage.textContent = 'Acetaminophen failed — escalation pathway narrows; opioids remain deprioritized pending topical NSAID and duloxetine trial (if sedation concern resolved)';
    else opioidStage.textContent = 'No clinical indication at this stage — pain severity (' + P.pain + '/10) and prior treatment history do not yet justify opioid pathway';
  }
  
  // 8. Monitoring contraindications
  updateContraindications();
  
  // 8b. Dynamic renal dosing block
  updateRenalDosingBlock();
  var evBadge = document.querySelector('.dp-evidence-badge');
  if (evBadge) {
    var complexity = computeComplexity();
    if (complexity >= 75) {
      evBadge.style.background = 'rgba(184,50,41,0.07)';
      evBadge.style.color = 'var(--red)';
      evBadge.style.borderColor = 'rgba(184,50,41,0.2)';
      evBadge.innerHTML = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> Evidence: Moderate — Complex';
    } else if (complexity >= 50) {
      evBadge.style.background = 'rgba(184,122,0,0.07)';
      evBadge.style.color = 'var(--amber)';
      evBadge.style.borderColor = 'rgba(184,122,0,0.2)';
      evBadge.innerHTML = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> Evidence: Moderate';
    } else {
      evBadge.style.background = '';
      evBadge.style.color = 'var(--green)';
      evBadge.style.borderColor = '';
      evBadge.innerHTML = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> Evidence: High';
    }
  }
  
  // 10. Show update banner
  var banner = document.getElementById('ip-update-banner');
  if (banner) {
    var msgs = [];
    if (nsaidContraindicated()) msgs.push('NSAID pathway: contraindicated');
    else msgs.push('NSAID pathway: conditional');
    if (apapContraindicated()) msgs.push('Acetaminophen: affected');
    msgs.push('Confidence: ' + rec.confPct + '%');
    document.getElementById('ip-update-text').textContent = 'Reasoning updated — ' + msgs.join(' · ');
    banner.classList.add('visible');
  }
  
  // 11. Mark downstream sections with subtle "updated" indicator
  ['section-summary', 'section-drivers', 'section-monitoring'].forEach(function(id) {
    var sec = document.getElementById(id);
    if (sec) { sec.classList.add('reason-stale'); setTimeout(function(){ sec.classList.remove('reason-stale'); }, 3000); }
  });
  
  // 12. Update clinical reasoning visibility panel
  updateClinicalReasoningPanel(rec, nsaidR);
  
  // 13. Update Review Objective Banner
  updateReviewObjectiveBanner(rec);

  // 14. Update Pharmacist Intervention Panel
  updateInterventionPanel(rec);
}

// ── Clinical Reasoning Panel Engine ──
// Tracks previous state to detect parameter-level changes
var _isFirstRun = true;

function updateClinicalReasoningPanel(rec, nsaidR) {
  var changed = !_isFirstRun && (
    rec.drug !== _prevRecDrug ||
    nsaidR.state !== _prevNsaidState ||
    P.egfr !== _prevEgfr ||
    P.gi !== _prevGi ||
    P.bp !== _prevBp ||
    P.pain !== _prevPain ||
    P.adh !== _prevAdh
  );
  
  // ── 1. Primary Clinical Concern ──
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

  // ── 2. Highest Monitoring Priority ──
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

  // ── 3. Main Treatment Constraint ──
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

  // ── 4. Most Significant Escalation Trigger ──
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

  // ── 5. Key Longitudinal Concern ──
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

  // ── 6. Current Risk Balance ──
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

  // ── Reason recommendation changed ──
  var changeRow = document.getElementById('cr-change-row');
  var changeText = document.getElementById('cr-change-text');
  if (changed && changeRow && changeText) {
    var changeMsg = '';
    var triggerNote = '';
    
    // Build specific, variable-attributed change message
    var changeFactors = [];
    if (rec.drug !== _prevRecDrug) {
      // Determine which specific variable triggered the rec change
      if (nsaidContraindicated() && !_prevNsaidWasContra) {
        changeFactors.push('NSAID pathway newly contraindicated — recommendation locked to acetaminophen');
        if (giRisk() === 'very-high' && _prevGiRisk !== 'very-high') {
          triggerNote = 'GI risk escalated to very-high — NSAIDs are now an absolute contraindication. NSAID escalation has been removed from the pathway entirely.';
        } else if (bpControl() === 'uncontrolled' && _prevBpControl !== 'uncontrolled') {
          triggerNote = 'BP rose to uncontrolled range (' + P.bp + ' mmHg) — NSAID initiation is now unsafe. Amlodipine efficacy would be further compromised. NSAID pathway closed.';
        } else if (P.egfr < 30 && _prevEgfr >= 30) {
          triggerNote = 'eGFR dropped below 30 — NSAIDs are absolutely contraindicated at this renal function. Prostaglandin-dependent renal perfusion is critically impaired.';
        } else if (P.egfr < 45 && _prevEgfr >= 45) {
          triggerNote = 'eGFR crossed below 45 — moderate renal impairment now makes NSAID use clinically unsafe. Renal pathway risk now outweighs any analgesic benefit.';
        } else {
          triggerNote = 'Combined contraindication profile has closed the NSAID pathway. GI risk + renal + BP factors are now compounding.';
        }
      } else if (!nsaidContraindicated() && _prevNsaidWasContra) {
        changeFactors.push('NSAID pathway reopened — risk profile has improved');
        triggerNote = 'Contraindication profile has partially resolved. NSAIDs are no longer absolutely contraindicated, but remain a secondary option due to residual risk factors.';
      } else if (apapContraindicated() && !_prevApapContra) {
        changeFactors.push('Acetaminophen intolerance newly documented — recommendation pathway shifted');
        triggerNote = 'Acetaminophen intolerance documented. This eliminates the primary first-line option. The workflow has shifted to the NSAID or specialist pathway.';
      } else if (P.pain >= 8 && _prevPain < 8) {
        changeFactors.push('Pain crossed severe threshold (NRS ' + P.pain + '/10) — combination pathway activated');
        triggerNote = 'Pain severity crossed the severe threshold. Acetaminophen monotherapy is now insufficient at this intensity. Combination with topical NSAID is now the recommended first-line approach.';
      } else if (multimodalFailure() && !_prevMultimodal) {
        changeFactors.push('Multimodal failure documented — escalation protocol applies');
        triggerNote = 'All non-opioid pathways have been exhausted. Specialist referral is now the appropriate next step before any further pharmacotherapy is initiated.';
      }
      changeMsg = changeFactors.join('. ') || 'Treatment pathway shifted based on updated patient parameters.';
    } else {
      // Rec drug unchanged — report what shifted in the background
      var shiftFactors = [];
      if (P.egfr !== _prevEgfr) shiftFactors.push('eGFR: ' + _prevEgfr + ' → ' + P.egfr + ' mL/min (renal risk ' + (P.egfr < _prevEgfr ? 'worsened' : 'improved') + ')');
      if (P.gi !== _prevGi) shiftFactors.push('GI risk reclassified: ' + giLabel());
      if (P.bp !== _prevBp) shiftFactors.push('BP updated: ' + P.bp + ' mmHg (' + bpRiskLabel() + ')');
      if (P.pain !== _prevPain) shiftFactors.push('Pain NRS: ' + _prevPain + ' → ' + P.pain);
      if (P.adh !== _prevAdh) shiftFactors.push('Adherence pattern: ' + adhLabel());
      changeMsg = shiftFactors.length
        ? 'Recommendation unchanged — constraint weighting updated. ' + shiftFactors.join('; ') + '. Review monitoring priorities.'
        : 'Pathway risk profile updated — monitoring requirements and escalation triggers have been recalculated.';
    }
    
    changeText.textContent = changeMsg;
    changeRow.classList.add('visible');
    
    // Show trigger note on primary rec if rec changed
    var triggerNoteEl = document.getElementById('ds-trigger-note');
    var triggerNoteText = document.getElementById('ds-trigger-note-text');
    if (triggerNoteEl && triggerNoteText) {
      if (triggerNote && rec.drug !== _prevRecDrug) {
        triggerNoteText.textContent = triggerNote;
        triggerNoteEl.classList.add('visible');
      } else {
        triggerNoteEl.classList.remove('visible');
      }
    }
    
    // Build causality attribution rows
    buildCausalityPanel();
    
    // Flash the panel
    var updInd = document.getElementById('cr-updated-indicator');
    if (updInd) {
      updInd.classList.add('visible');
      setTimeout(function(){ updInd.classList.remove('visible'); }, 4000);
    }
  } else if (!changed && !_isFirstRun) {
    if (changeRow) changeRow.classList.remove('visible');
    var triggerNoteEl = document.getElementById('ds-trigger-note');
    if (triggerNoteEl) triggerNoteEl.classList.remove('visible');
    var causalityPanel = document.getElementById('cr-causality-panel');
    if (causalityPanel) causalityPanel.classList.remove('visible');
  }

  // Update dominant trade-off strip
  updateTradeoffStrip();
  // Update escalation tags on param tiles
  updateEscalationTags();
  
  _prevNsaidWasContra = nsaidContraindicated();
  _prevRecDrug = rec.drug;
  _prevNsaidState = nsaidR.state;
  _prevEgfr = P.egfr;
  _prevGi = P.gi;
  _prevBp = P.bp;
  _prevPain = P.pain;
  _prevAdh = P.adh;
  _prevGiRisk = giRisk();
  _prevBpControl = bpControl();
  _prevApapContra = apapContraindicated();
  _prevMultimodal = multimodalFailure();
  _prevComplexity = computeComplexity();
  _isFirstRun = false;
}

function setCrSignal(signalId, sevClass, valId, valText, subId, subText) {
  var signal = document.getElementById(signalId);
  if (signal) {
    signal.className = 'cr-signal ' + sevClass;
    signal.classList.add('cr-updated');
    setTimeout(function(){ if(signal) signal.classList.remove('cr-updated'); }, 800);
  }
  var valEl = document.getElementById(valId);
  if (valEl) valEl.textContent = valText;
  if (subId) {
    var subEl = document.getElementById(subId);
    if (subEl) subEl.textContent = subText;
  }
  // Update dot color
  if (signal) {
    var dot = signal.querySelector('.cr-signal-label-dot');
    if (dot) {
      dot.className = 'cr-signal-label-dot';
      if (sevClass === 'sev-red') dot.classList.add('dot-red');
      else if (sevClass === 'sev-amber') dot.classList.add('dot-amber');
      else if (sevClass === 'sev-green') dot.classList.add('dot-green');
      else dot.classList.add('dot-blue');
    }
  }
}

// ── Review Objective Banner update ──
function updateReviewObjectiveBanner(rec) {
  var objectiveEl = document.getElementById('rob-objective-text');
  var concernEl = document.getElementById('rob-concern-text');
  var actionEl = document.getElementById('rob-action-text');
  var actionAltEl = document.getElementById('rob-action-alt');
  if (!objectiveEl) return;

  // Objective: what clinical task is happening
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

  // Primary concern
  var concern;
  if (P.egfr < 30) {
    concern = 'Severe renal impairment (eGFR ' + P.egfr + ') · Analgesic pathway critically narrowed';
  } else if (apapContraindicated() && nsaidContraindicated()) {
    concern = 'Both primary analgesic pathways closed · Specialist review required';
  } else if (giRisk() === 'very-high') {
    concern = 'Active GI bleeding risk · All NSAIDs absolutely contraindicated';
  } else if (P.egfr < 45 && giRisk() !== 'low') {
    concern = 'Compound renal + GI risk · NSAID pathway closed · Escalation pathway narrowing';
  } else if (P.egfr < 60 && giRisk() !== 'low') {
    concern = 'Progressive renal decline · NSAID pathway closed';
  } else if (P.pain >= 8 && nsaidContraindicated()) {
    concern = 'Severe pain · Escalation options severely constrained';
  } else if (egfrRisk() !== 'low') {
    concern = 'Renal impairment (eGFR ' + P.egfr + ') · Monitoring burden elevated';
  } else if (giRisk() !== 'low') {
    concern = 'GI safety risk · NSAID class contraindicated';
  } else {
    concern = 'Polypharmacy burden · Adherence and interaction monitoring required';
  }
  concernEl.textContent = concern;

  // Suggested pharmacist action
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

// ══════════════════════════════════════════════════════
//  PHARMACIST INTERVENTION PANEL ENGINE
// ══════════════════════════════════════════════════════
function updateInterventionPanel(rec) {
  var complexity = computeComplexity();

  // ── SIDEBAR INTERVENTION STATUS ──
  var sidebarDot = document.getElementById('dp-intervention-status-dot');
  var sidebarText = document.getElementById('dp-intervention-status-text');
  if (sidebarDot && sidebarText) {
    sidebarDot.className = 'dp-risk-dot';
    if (priorityClass === 'pi-prio-high') {
      sidebarDot.classList.add('dp-risk-dot-red');
      sidebarText.textContent = 'Intervention — higher priority';
    } else if (priorityClass === 'pi-prio-elevated') {
      sidebarDot.classList.add('dp-risk-dot-amber');
      sidebarText.textContent = 'Intervention priority increasing';
    } else if (priorityClass === 'pi-prio-monitor') {
      sidebarDot.classList.add('dp-risk-dot-amber');
      sidebarText.textContent = 'Escalating monitoring concern';
    } else {
      sidebarDot.classList.add('dp-risk-dot-green');
      sidebarText.textContent = 'Intervention: routine review';
    }
  }

  // ── INTERVENTION PRIORITY ──
  var priorityClass, priorityLabel;
  if (apapContraindicated() && nsaidContraindicated()) {
    priorityClass = 'pi-prio-high';
    priorityLabel = 'Intervention — Higher Priority';
  } else if (P.egfr < 30 || giRisk() === 'very-high') {
    priorityClass = 'pi-prio-high';
    priorityLabel = 'Increased Renal / GI Safety Concern';
  } else if (P.egfr < 45 || (nsaidContraindicated() && P.pain >= 7)) {
    priorityClass = 'pi-prio-elevated';
    priorityLabel = 'Intervention Becoming Higher Priority';
  } else if (nsaidContraindicated() || P.adh === 'poor' || complexity >= 60) {
    priorityClass = 'pi-prio-monitor';
    priorityLabel = 'Escalating Monitoring Concern';
  } else if (P.pain >= 6 || P.adh === 'partial') {
    priorityClass = 'pi-prio-monitor';
    priorityLabel = 'Follow-up Recommended';
  } else {
    priorityClass = 'pi-prio-routine';
    priorityLabel = 'Routine Review';
  }
  var badge = document.getElementById('pi-priority-badge');
  var labelEl = document.getElementById('pi-priority-label');
  if (badge) { badge.className = 'pi-priority-badge ' + priorityClass; }
  if (labelEl) labelEl.textContent = priorityLabel;

  // ── PANEL TITLE ──
  var titleEl = document.getElementById('pi-title');
  if (titleEl) {
    if (apapContraindicated() && nsaidContraindicated()) {
      titleEl.textContent = 'Medication Review — Specialist Pathway Assessment';
    } else if (P.egfr < 45) {
      titleEl.textContent = 'Medication Review — Renal Safety Assessment';
    } else if (multimodalFailure()) {
      titleEl.textContent = 'Medication Review — Deprescribing & Escalation Review';
    } else if (P.pain >= 8) {
      titleEl.textContent = 'Medication Review — Analgesic Escalation Assessment';
    } else {
      titleEl.textContent = 'Medication Review — Analgesic Safety Assessment';
    }
  }

  // ── SUGGESTED INTERVENTION (main + 3 subs) ──
  var mainEl = document.getElementById('pi-intervention-main');
  var sub1El = document.getElementById('pi-sub-1');
  var sub2El = document.getElementById('pi-sub-2');
  var sub3El = document.getElementById('pi-sub-3');

  var mainText, sub1, sub2, sub3, sub1Dot, sub2Dot, sub3Dot;

  if (apapContraindicated() && nsaidContraindicated()) {
    mainText = 'Initiate specialist referral — no safe first-line analgesic identified';
    sub1 = 'Review full medication list for deprescribing opportunities';
    sub2 = 'Consider pain medicine or rheumatology co-management';
    sub3 = 'Hold analgesic escalation pending specialist input';
    sub1Dot = 'pi-dot-red'; sub2Dot = 'pi-dot-amber'; sub3Dot = 'pi-dot-amber';
  } else if (apapContraindicated()) {
    mainText = 'Initiate low-dose NSAID + PPI cover — intensive monitoring pathway';
    sub1 = 'eGFR check at 2 weeks — flag any decline ≥10%';
    sub2 = 'GI symptom review at every contact';
    sub3 = 'Do not deprescribe PPI — GI risk remains active';
    sub1Dot = 'pi-dot-red'; sub2Dot = 'pi-dot-amber'; sub3Dot = 'pi-dot-amber';
  } else if (multimodalFailure()) {
    mainText = 'Reassess analgesic pathway — consider deprescribing review';
    sub1 = 'Review all 7 concurrent agents for interaction burden';
    sub2 = 'Opioid candidacy requires sedation risk reassessment';
    sub3 = 'Document failure rationale before next escalation';
    sub1Dot = 'pi-dot-amber'; sub2Dot = 'pi-dot-amber'; sub3Dot = 'pi-dot-blue';
  } else if (P.egfr < 30) {
    mainText = 'Dose-adjust acetaminophen to 2 g/day max — nephrology review';
    sub1 = 'Weekly eGFR monitoring — all renally-cleared drugs at risk';
    sub2 = 'Avoid NSAIDs absolutely — prostaglandin-dependent renal perfusion';
    sub3 = 'Review entire medication list for renal dose adjustment';
    sub1Dot = 'pi-dot-red'; sub2Dot = 'pi-dot-red'; sub3Dot = 'pi-dot-amber';
  } else if (P.egfr < 45) {
    mainText = 'Dose-reduce acetaminophen to 2.5 g/day — intensify renal follow-up';
    sub1 = 'Renal function check at 2 and 4 weeks';
    sub2 = 'NSAID pathway closed — renal risk prohibitive at eGFR ' + P.egfr;
    sub3 = 'Document eGFR trajectory before Month 3 review';
    sub1Dot = 'pi-dot-red'; sub2Dot = 'pi-dot-red'; sub3Dot = 'pi-dot-amber';
  } else if (P.pain >= 8 && !apapContraindicated()) {
    mainText = 'Escalate to topical diclofenac gel — if acetaminophen inadequate at Week 4';
    sub1 = 'Confirm fixed-schedule acetaminophen use before escalation decision';
    sub2 = 'eGFR recheck before topical NSAID — confirm eGFR ≥50';
    sub3 = 'Document pain trajectory from NRS baseline';
    sub1Dot = 'pi-dot-amber'; sub2Dot = 'pi-dot-amber'; sub3Dot = 'pi-dot-blue';
  } else {
    mainText = 'Initiate acetaminophen TID (fixed schedule) — obtain baseline eGFR today';
    sub1 = 'Obtain baseline eGFR before Week 2 contact';
    sub2 = 'Confirm adherence at Week 2 — do not escalate on PRN use';
    sub3 = 'Maintain pantoprazole 40 mg — do not deprescribe at this stage';
    sub1Dot = 'pi-dot-amber'; sub2Dot = 'pi-dot-amber'; sub3Dot = 'pi-dot-blue';
  }

  if (mainEl) mainEl.textContent = mainText;

  function setSub(el, dotId, text, dotClass) {
    if (!el) return;
    el.textContent = text;
    var dotEl = el.previousElementSibling;
    if (dotEl) dotEl.className = 'pi-sub-dot ' + dotClass;
  }
  setSub(sub1El, 'pi-dot-1', sub1, sub1Dot);
  setSub(sub2El, 'pi-dot-2', sub2, sub2Dot);
  setSub(sub3El, 'pi-dot-3', sub3, sub3Dot);

  // ── WHY URGENCY IS INCREASING ──
  var urgencyContainer = document.getElementById('pi-urgency-items');
  if (urgencyContainer) {
    var urgencyItems = [];
    
    if (P.egfr < 30) {
      urgencyItems.push({ cls: 'urg-red', text: '<strong>Severe renal decline</strong> — dose adjustments now mandatory; analgesic pathway critically narrowed' });
    } else if (P.egfr < 45) {
      urgencyItems.push({ cls: 'urg-red', text: '<strong>Moderate CKD (eGFR ' + P.egfr + ')</strong> — NSAID pathway closed; monitoring frequency must increase' });
    } else if (P.egfr < 60) {
      urgencyItems.push({ cls: 'urg-amber', text: '<strong>CKD Stage 3a (eGFR ' + P.egfr + ')</strong> — declining trajectory; renal reassessment required before escalation' });
    }
    
    if (giRisk() === 'very-high') {
      urgencyItems.push({ cls: 'urg-red', text: '<strong>Active or recent GI bleed</strong> — NSAID pathway absolutely closed; GI monitoring at every contact' });
    } else if (giRisk() === 'high') {
      urgencyItems.push({ cls: 'urg-amber', text: '<strong>High GI risk (prior peptic ulcer)</strong> — NSAID class contraindicated; benefit-risk balance worsening with duration' });
    }
    
    if (nsaidContraindicated() && P.pain >= 7) {
      urgencyItems.push({ cls: 'urg-amber', text: '<strong>Pain severity rising (NRS ' + P.pain + '/10)</strong> — NSAID pathway closed; escalation options narrowing' });
    } else if (P.pain >= 8) {
      urgencyItems.push({ cls: 'urg-amber', text: '<strong>Severe pain (NRS ' + P.pain + '/10)</strong> — acetaminophen monotherapy likely insufficient; combination threshold reached' });
    }
    
    if (P.adh === 'poor') {
      urgencyItems.push({ cls: 'urg-amber', text: '<strong>Poor adherence documented</strong> — outcomes unreliable; Week 4 response cannot be interpreted without dosing verification' });
    } else if (P.adh === 'partial') {
      urgencyItems.push({ cls: 'urg-blue', text: '<strong>Inconsistent PRN use</strong> — subtherapeutic exposure probable; fixed TID schedule required before escalation' });
    }
    
    if (complexity >= 75) {
      urgencyItems.push({ cls: 'urg-amber', text: '<strong>Polypharmacy complexity (7 agents)</strong> — interaction burden elevated; deprescribing review warranted' });
    }

    if (multimodalFailure()) {
      urgencyItems.push({ cls: 'urg-red', text: '<strong>Multimodal treatment failure</strong> — all non-opioid options exhausted; specialist input required' });
    }

    if (urgencyItems.length === 0) {
      urgencyItems.push({ cls: 'urg-blue', text: '<strong>Stable clinical profile</strong> — no escalating concern identified; standard monitoring applies' });
    }

    urgencyContainer.innerHTML = urgencyItems.map(function(item) {
      return '<div class="pi-urgency-item ' + item.cls + '">' +
        '<svg class="pi-urgency-icon" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>' +
        '<span>' + item.text + '</span></div>';
    }).join('');
  }

  // ── FOLLOW-UP CONSEQUENCES ──
  var followupContainer = document.getElementById('pi-followup-items');
  if (followupContainer) {
    var followupItems = [];

    if (P.egfr < 60) {
      if (P.egfr < 45) {
        followupItems.push({ strong: 'Worsening renal burden', text: ' — delayed reassessment risks undetected eGFR decline and dose accumulation' });
      } else {
        followupItems.push({ strong: 'Progressive renal decline', text: ' — delayed eGFR recheck leaves dosing threshold unvalidated' });
      }
    }
    
    if (giRisk() !== 'low') {
      followupItems.push({ strong: 'Rising GI exposure risk', text: ' — ongoing analgesic use without GI review increases ulceration probability' });
    }
    
    if (P.adh === 'partial' || P.adh === 'poor') {
      followupItems.push({ strong: 'Rising monitoring complexity', text: ' — adherence cannot be confirmed; Week 4 escalation decision will be unreliable' });
    }
    
    if (nsaidContraindicated() && P.pain >= 6) {
      followupItems.push({ strong: 'Therapy benefit becoming outweighed', text: ' — pain burden increases while safe escalation options remain limited' });
    }
    
    if (complexity >= 70) {
      followupItems.push({ strong: 'Polypharmacy burden compounding', text: ' — 7-agent regimen requires regular interaction and safety review' });
    }

    if (followupItems.length === 0) {
      followupItems.push({ strong: 'Delayed NRS review', text: ' — pain trajectory cannot be confirmed; escalation timing becomes unclear' });
    }

    followupContainer.innerHTML = followupItems.map(function(item) {
      return '<div class="pi-followup-item">' +
        '<span class="pi-followup-arrow">›</span>' +
        '<span><strong>' + item.strong + '</strong>' + item.text + '</span>' +
        '</div>';
    }).join('');
  }

  // ── NEXT CONTACT TEXT ──
  var nextContactEl = document.getElementById('pi-next-contact-text');
  if (nextContactEl) {
    if (P.egfr < 30) {
      nextContactEl.textContent = 'Next contact: 1 week — eGFR + safety review';
    } else if (P.egfr < 45) {
      nextContactEl.textContent = 'Next contact: 2 weeks — eGFR + dose adjustment review';
    } else {
      nextContactEl.textContent = 'Next contact: Week 2 — adherence + NRS + eGFR status';
    }
  }

  // ── ACTION PATHWAY STEPS ──
  var pathwayStepsEl = document.getElementById('pi-pathway-steps');
  var pathwayNoteEl = document.getElementById('pi-pathway-note');
  if (pathwayStepsEl) {
    var steps = [];

    if (apapContraindicated() && nsaidContraindicated()) {
      steps = [
        { label: 'NSAIDs', cls: 'pi-step-closed' },
        { label: 'Acetaminophen', cls: 'pi-step-closed' },
        { label: 'Specialist Referral', cls: 'pi-step-active' },
        { label: 'Deprescribing Review', cls: 'pi-step-conditional' }
      ];
      if (pathwayNoteEl) pathwayNoteEl.textContent = 'No safe standard analgesic pathway — specialist assessment required before initiating further pharmacotherapy';
    } else if (P.egfr < 30) {
      steps = [
        { label: 'NSAIDs: Absolute CI', cls: 'pi-step-closed' },
        { label: 'Acetaminophen 2 g/day max', cls: 'pi-step-active' },
        { label: 'Nephrology Review', cls: 'pi-step-conditional' }
      ];
      if (pathwayNoteEl) pathwayNoteEl.textContent = 'Renal protection is the overriding priority — analgesic ceiling applies at all stages';
    } else if (multimodalFailure()) {
      steps = [
        { label: 'NSAIDs', cls: 'pi-step-closed' },
        { label: 'Acetaminophen', cls: 'pi-step-closed' },
        { label: 'Deprescribing Review', cls: 'pi-step-active' },
        { label: 'Opioid Assessment', cls: 'pi-step-conditional' }
      ];
      if (pathwayNoteEl) pathwayNoteEl.textContent = 'Reassess opioid candidacy under specialist oversight — all non-opioid pathways exhausted';
    } else if (P.pain >= 8 && !apapContraindicated()) {
      steps = [
        { label: 'Acetaminophen TID', cls: 'pi-step-active' },
        { label: 'Topical Diclofenac Gel', cls: 'pi-step-conditional' },
        { label: 'Duloxetine 30–60 mg', cls: 'pi-step-conditional' },
        { label: 'NSAIDs', cls: 'pi-step-closed' }
      ];
      if (pathwayNoteEl) pathwayNoteEl.textContent = 'Combination therapy threshold met — escalation at Week 4 if NRS ≥6 on regular acetaminophen';
    } else {
      steps = [
        { label: 'Acetaminophen TID', cls: 'pi-step-active' },
        { label: 'Topical Diclofenac', cls: 'pi-step-conditional' },
        { label: 'Duloxetine 30 mg', cls: 'pi-step-conditional' },
        { label: 'NSAIDs', cls: 'pi-step-closed' }
      ];
      if (pathwayNoteEl) pathwayNoteEl.textContent = 'Reassess pathway at Week 4 — escalation decision pending eGFR and adherence confirmation';
    }

    pathwayStepsEl.innerHTML = steps.map(function(step, i) {
      var arrow = i < steps.length - 1 ? '<span class="pi-pathway-arrow">›</span>' : '';
      return '<span class="pi-pathway-step ' + step.cls + '">' + step.label + '</span>' + arrow;
    }).join('');
  }
}

var _prevNsaidWasContra = null;
var _prevRecDrug = null;
var _prevNsaidState = null;
var _prevEgfr = null;
var _prevGi = null;
var _prevBp = null;
var _prevPain = null;
var _prevAdh = null;
var _prevGiRisk = null;
var _prevBpControl = null;
var _prevApapContra = null;
var _prevMultimodal = null;
var _prevComplexity = null;

// ── Build causality attribution rows ──
function buildCausalityPanel() {
  var panel = document.getElementById('cr-causality-panel');
  var rows = document.getElementById('cr-causality-rows');
  if (!panel || !rows) return;
  
  var items = [];
  
  // eGFR change
  if (_prevEgfr !== null && P.egfr !== _prevEgfr) {
    var egfrDir = P.egfr < _prevEgfr ? 'worse' : 'better';
    var egfrEffect = '';
    if (P.egfr < 30 && _prevEgfr >= 30) egfrEffect = 'NSAIDs now absolutely contraindicated · acetaminophen dose ceiling applies';
    else if (P.egfr < 45 && _prevEgfr >= 45) egfrEffect = 'NSAID pathway unsafe · renal monitoring frequency increased';
    else if (P.egfr >= 60 && _prevEgfr < 60) egfrEffect = 'Renal risk flag cleared · monitoring interval can be relaxed';
    else egfrEffect = 'Renal risk reclassified · monitoring threshold adjusted';
    items.push({ param: 'eGFR', dotClass: egfrDir === 'worse' ? 'cr-causality-param-dot' + ' dot-red' : 'dot-green',
      change: _prevEgfr + ' → ' + P.egfr + ' mL/min', dir: egfrDir, effect: egfrEffect });
  }
  
  // GI change
  if (_prevGi !== null && P.gi !== _prevGi) {
    var giDir = (P.gi === 'bleed' || P.gi === 'ulcer-recent') ? 'worse' : (P.gi === 'none' ? 'better' : 'neutral');
    var giEffect = '';
    if (giRisk() === 'very-high' && _prevGiRisk !== 'very-high') giEffect = 'GI risk now critical — NSAIDs are an absolute contraindication; escalation pathway closed';
    else if (giRisk() === 'high' && (_prevGiRisk === 'low')) giEffect = 'NSAID pathway deprioritized — GI monitoring required at every visit';
    else if (giRisk() === 'low' && _prevGiRisk !== 'low') giEffect = 'GI contraindication resolved — NSAID pathway may now be considered with PPI cover';
    else giEffect = 'GI risk weighting updated · NSAID reasoning recalculated';
    items.push({ param: 'GI History', dotClass: giDir === 'worse' ? 'dot-red' : giDir === 'better' ? 'dot-green' : 'dot-amber',
      change: giLabel(), dir: giDir, effect: giEffect });
  }
  
  // BP change
  if (_prevBp !== null && P.bp !== _prevBp) {
    var bpDir = P.bp > _prevBp ? 'worse' : 'better';
    var bpEffect = '';
    if (bpControl() === 'uncontrolled' && _prevBpControl !== 'uncontrolled') bpEffect = 'BP uncontrolled — NSAIDs now contraindicated; amlodipine efficacy risk elevated';
    else if (bpControl() === 'controlled' && _prevBpControl !== 'controlled') bpEffect = 'BP now controlled — BP-based NSAID contraindication resolved';
    else bpEffect = 'BP risk tier changed (' + bpRiskLabel() + ') · NSAID eligibility recalculated';
    items.push({ param: 'Blood Pressure', dotClass: bpDir === 'worse' ? 'dot-red' : 'dot-green',
      change: _prevBp + ' → ' + P.bp + ' mmHg', dir: bpDir, effect: bpEffect });
  }
  
  // Pain change
  if (_prevPain !== null && P.pain !== _prevPain) {
    var painDir = P.pain > _prevPain ? 'worse' : 'better';
    var painEffect = '';
    if (P.pain >= 8 && _prevPain < 8) painEffect = 'Severe pain threshold crossed — combination therapy (acetaminophen + topical NSAID) is now indicated';
    else if (P.pain < 8 && _prevPain >= 8) painEffect = 'Pain below severe threshold — acetaminophen monotherapy pathway reactivated';
    else if (P.pain >= 6 && _prevPain < 6) painEffect = 'Moderate pain confirmed — fixed TID dosing schedule should be enforced';
    else painEffect = 'Analgesic adequacy threshold reassessed at new severity level';
    items.push({ param: 'Pain NRS', dotClass: painDir === 'worse' ? 'dot-red' : 'dot-green',
      change: _prevPain + '/10 → ' + P.pain + '/10', dir: painDir, effect: painEffect });
  }
  
  // Adherence change
  if (_prevAdh !== null && P.adh !== _prevAdh) {
    var adhDir = P.adh === 'poor' ? 'worse' : P.adh === 'good' ? 'better' : 'neutral';
    var adhEffect = '';
    if (P.adh === 'poor') adhEffect = 'Poor adherence shifts pathway toward simplified regimens; Week 4 NRS response is unreliable without consistent dosing';
    else if (P.adh === 'good') adhEffect = 'Good adherence restores validity of treatment response assessment; NRS outcomes now interpretable';
    else adhEffect = 'Inconsistent PRN use — fixed schedule counselling required before escalation is considered';
    items.push({ param: 'Adherence', dotClass: adhDir === 'worse' ? 'dot-amber' : 'dot-green',
      change: adhLabel(), dir: adhDir, effect: adhEffect });
  }
  
  if (items.length === 0) {
    panel.classList.remove('visible');
    return;
  }
  
  rows.innerHTML = '';
  items.forEach(function(item) {
    var dirClass = item.dir === 'worse' ? 'cr-delta-worse' : item.dir === 'better' ? 'cr-delta-better' : 'cr-delta-neutral';
    var dotBg = item.dotClass.indexOf('red') > -1 ? 'var(--red)' : item.dotClass.indexOf('green') > -1 ? 'var(--green)' : 'var(--amber)';
    rows.innerHTML += '<div class="cr-causality-row">' +
      '<div class="cr-causality-param"><span class="cr-causality-param-dot" style="background:' + dotBg + '"></span>' + item.param + '</div>' +
      '<div class="cr-causality-change"><span class="cr-delta-val ' + dirClass + '">' + item.change + '</span></div>' +
      '<div class="cr-causality-effect">' + item.effect + '</div>' +
      '</div>';
  });
  
  panel.classList.add('visible');
}

// ── Update dominant trade-off strip ──
function updateTradeoffStrip() {
  var strip = document.getElementById('cr-tradeoff-strip');
  var text = document.getElementById('cr-tradeoff-text');
  var deprio = document.getElementById('cr-tradeoff-deprioritized');
  if (!strip || !text || !deprio) return;
  
  strip.className = 'cr-tradeoff-strip';
  
  if (apapContraindicated() && nsaidContraindicated()) {
    strip.classList.add('strip-red');
    text.textContent = 'All standard pathways compromised — specialist assessment required before any analgesic is initiated';
    deprio.textContent = 'No safe first-line available';
  } else if (P.egfr < 30) {
    strip.classList.add('strip-red');
    text.textContent = 'Renal protection is the overriding constraint — all analgesics are deprioritized pending nephrology input; pain tolerance is being traded for organ safety';
    deprio.textContent = 'NSAIDs + acetaminophen ceiling active';
  } else if (giRisk() === 'very-high') {
    strip.classList.add('strip-red');
    text.textContent = 'GI safety is the absolute constraint — maximum GI protection is required; analgesic efficacy is fully subordinated to bleeding risk avoidance';
    deprio.textContent = 'Systemic NSAID pathway closed';
  } else if (multimodalFailure()) {
    strip.classList.add('strip-red');
    text.textContent = 'Multimodal failure — pain control need is now the dominant factor; specialist oversight is required before any further pharmacotherapy';
    deprio.textContent = 'Standard pathway exhausted';
  } else if (nsaidContraindicated() && P.adh === 'poor') {
    strip.classList.add('strip-amber');
    text.textContent = 'Adherence is now the binding clinical variable — analgesic selection is constrained by GI risk, but therapeutic outcomes are primarily limited by dosing consistency';
    deprio.textContent = 'NSAID escalation + PRN dosing both deprioritized';
  } else if (nsaidContraindicated()) {
    strip.classList.add('strip-amber');
    var reasons = [];
    if (giRisk() !== 'low') reasons.push('GI bleed risk');
    if (P.intol === 'both-nsaid' || P.intol === 'bp-nsaid') reasons.push('BP intolerance documented');
    if (ageFlag()) reasons.push('Beers flag');
    text.textContent = 'GI safety is the binding constraint — analgesic efficacy is being traded for gastrointestinal protection' + (reasons.length ? ' (' + reasons.join(' + ') + ')' : '');
    deprio.textContent = 'NSAID escalation deprioritized';
  } else if (P.pain >= 8) {
    strip.classList.add('strip-amber');
    text.textContent = 'Pain severity is now driving the decision — the trade-off has shifted toward adequate analgesia; combination therapy is now clinically justified despite residual risks';
    deprio.textContent = 'Acetaminophen monotherapy insufficient';
  } else if (bpControl() === 'elevated' || bpControl() === 'mildly-elevated') {
    strip.classList.add('strip-amber');
    text.textContent = 'Cardiovascular stability is the active co-constraint — BP management and analgesic safety are competing; amlodipine interaction risk is being monitored';
    deprio.textContent = 'NSAID + high BP combination avoided';
  } else if (P.adh === 'poor') {
    strip.classList.add('strip-amber');
    text.textContent = 'Adherence is the primary clinical variable — the therapeutic question is no longer which drug, but whether any drug is being taken consistently enough to assess';
    deprio.textContent = 'Complex regimens deprioritized';
  } else {
    strip.classList.add('strip-green');
    text.textContent = 'Risk profile is manageable within the acetaminophen pathway — safety and efficacy goals are currently compatible';
    deprio.textContent = 'No pathways actively deprioritized';
  }
}

// ── Update escalation tags on param tiles ──
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
  
  // eGFR tag
  if (P.egfr < 30) setEscTag('egfr', 'NSAIDs: absolute CI', 'esc-critical');
  else if (P.egfr < 45) setEscTag('egfr', 'NSAID-unsafe zone', 'esc-critical');
  else if (P.egfr < 60) setEscTag('egfr', 'Monitor closely', 'esc-monitor');
  else setEscTag('egfr', null);
  
  // GI tag
  if (giRisk() === 'very-high') setEscTag('gi', 'NSAID: absolute CI', 'esc-critical');
  else if (giRisk() === 'high') setEscTag('gi', 'NSAID pathway closed', 'esc-critical');
  else if (P.gi === 'dyspepsia') setEscTag('gi', 'Monitor on escalation', 'esc-monitor');
  else setEscTag('gi', null);
  
  // BP tag
  if (bpControl() === 'uncontrolled') setEscTag('bp', 'NSAID: unsafe', 'esc-critical');
  else if (bpControl() === 'elevated') setEscTag('bp', 'Monitor BP', 'esc-monitor');
  else setEscTag('bp', null);
}

// ── Init on load ──
document.addEventListener('DOMContentLoaded', function() {
  updateParamTiles();
  updateComplexityBar();
  // Initialize reasoning panel with default state
  var rec = buildPrimaryRec();
  var nsaidR = buildNsaidReasoning();
  _isFirstRun = true;
  updateClinicalReasoningPanel(rec, nsaidR);
  // Init trade-off strip and escalation tags on load
  updateTradeoffStrip();
  updateEscalationTags();
  // Init renal dosing block
  updateRenalDosingBlock();
  // Init pharmacist intervention panel
  updateInterventionPanel(rec);
});

// ════════════════════════════════
//  CLINICAL HANDOFF SECTION
// ════════════════════════════════
var _activeHandoffType = 'pharmacist';

function selectHandoffType(type, btn) {
  // Update button states
  document.querySelectorAll('.hf-doc-type').forEach(function(b) { b.classList.remove('active'); });
  btn.classList.add('active');
  _activeHandoffType = type;

  // Show/hide documents
  var docIds = ['pharmacist','monitoring','escalation','attending','risk','rationale','followup'];
  docIds.forEach(function(id) {
    var el = document.getElementById('hf-doc-' + id);
    if (el) el.style.display = (id === type) ? 'block' : 'none';
  });
}

function copyHandoffDocument() {
  var doc = document.getElementById('hf-doc-' + _activeHandoffType);
  if (!doc) return;
  
  // Build plain text version
  var lines = [];
  var header = doc.querySelector('.hf-doc-title');
  var sub = doc.querySelector('.hf-doc-subtitle');
  if (header) lines.push(header.textContent.toUpperCase());
  if (sub) lines.push(sub.textContent);
  lines.push('');

  var sections = doc.querySelectorAll('.hf-section');
  sections.forEach(function(section) {
    var headEl = section.querySelector('.hf-section-head');
    if (headEl) {
      // Remove the dot span text from head
      var headText = headEl.textContent.trim();
      lines.push('── ' + headText + ' ──');
    }
    var contentEls = section.querySelectorAll('.hf-line, .hf-line-flag, .hf-action-item, .hf-risk-row');
    contentEls.forEach(function(el) {
      lines.push(el.textContent.trim().replace(/\s+/g,' '));
    });
    var callout = section.querySelector('.hf-amber-callout, .hf-escalation-callout');
    if (callout) lines.push(callout.textContent.trim().replace(/\s+/g,' '));
    lines.push('');
  });

  var sig = doc.querySelector('.hf-sig-block');
  if (sig) {
    lines.push('──');
    lines.push(sig.textContent.trim().replace(/\s+/g,' '));
  }

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

// Update handoff meta panel when parameters change
function updateHandoffMeta() {
  var painEl = document.getElementById('hf-meta-pain');
  var egfrEl = document.getElementById('hf-meta-egfr');
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

// Hook into existing runReasoningEngine to also update handoff meta
var _origRunReasoningEngine = typeof runReasoningEngine === 'function' ? runReasoningEngine : null;
document.addEventListener('DOMContentLoaded', function() {
  // Patch applyParam to also update handoff meta
  var _origApplyParam = applyParam;
  applyParam = function(key) {
    _origApplyParam(key);
    updateHandoffMeta();
    updatePolypharmacyPanel();
  };
  updateHandoffMeta();
  updatePolypharmacyPanel();
});

// ════════════════════════════════
//  POLYPHARMACY & INTERACTIONS ENGINE
// ════════════════════════════════

function updatePolypharmacyPanel() {
  updateRenalCascadeHighlight();
  updatePolyBurdenBadge();
  updatePolyInteractionFlags();
  updatePolyMonitoringBanner();
  updateReactiveDoseLabels();
}

function updateRenalCascadeHighlight() {
  // Remove active from all rows first
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
  if (P.egfr >= 60) activeId = 'renal-row-60plus';
  else if (P.egfr >= 45) activeId = 'renal-row-4559';
  else if (P.egfr >= 30) activeId = 'renal-row-3044';
  else activeId = 'renal-row-under30';

  var activeEl = document.getElementById(activeId);
  if (activeEl) {
    activeEl.classList.add('renal-active-row');
    var egfrCell = activeEl.querySelector('.renal-cascade-egfr');
    if (egfrCell) egfrCell.classList.add('egfr-current');
    var marker = activeEl.querySelector('.renal-active-marker');
    if (!marker) {
      // Create marker if not present
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

  // Update inline eGFR display
  var inlineEgfr = document.getElementById('poly-egfr-inline');
  if (inlineEgfr) inlineEgfr.textContent = P.egfr;
  var currentEgfrLabel = document.getElementById('poly-renal-current-egfr');
  if (currentEgfrLabel) currentEgfrLabel.textContent = 'Current eGFR: ' + P.egfr + ' mL/min';
}

function updatePolyBurdenBadge() {
  var badge = document.getElementById('poly-burden-badge');
  if (!badge) return;
  var complexity = computeComplexity();
  if (complexity >= 70 || P.egfr < 30) {
    badge.className = 'poly-burden-badge burden-high';
    badge.textContent = 'High burden';
  } else if (complexity >= 45 || P.egfr < 50 || nsaidContraindicated()) {
    badge.className = 'poly-burden-badge burden-mod';
    badge.textContent = 'Moderate burden';
  } else {
    badge.className = 'poly-burden-badge burden-low';
    badge.textContent = 'Low burden';
  }

  // Update interaction rail
  var intVal = document.getElementById('poly-rail-int-val');
  var intNote = document.getElementById('poly-rail-int-note');
  if (intVal && intNote) {
    if (nsaidContraindicated()) {
      intVal.textContent = '0 active interactions';
      intNote.textContent = 'Amlodipine–NSAID interaction fully prevented by NSAID exclusion. Acetaminophen carries no clinically significant interactions with current regimen.';
      document.getElementById('poly-rail-interactions') && (document.getElementById('poly-rail-interactions').className = 'safety-rail-item srl-green');
    } else {
      intVal.textContent = '1–2 monitor-level pairs';
      intNote.textContent = 'NSAID pathway conditionally accessible — amlodipine–NSAID BP interaction monitoring required if initiated. Review before prescribing.';
      document.getElementById('poly-rail-interactions') && (document.getElementById('poly-rail-interactions').className = 'safety-rail-item srl-amber');
    }
  }

  // Update renal rail
  var renalVal = document.getElementById('poly-rail-renal-val');
  var renalNote = document.getElementById('poly-rail-renal-note');
  if (renalVal && renalNote) {
    if (P.egfr < 30) {
      renalVal.textContent = '2 adjustments active';
      renalNote.textContent = 'Severe renal impairment — APAP ceiling 2 g/day, all NSAIDs absolutely contraindicated, opioid metabolite accumulation risk. Nephrology input required.';
      document.getElementById('poly-rail-renal') && (document.getElementById('poly-rail-renal').className = 'safety-rail-item srl-red');
    } else if (P.egfr < 45) {
      renalVal.textContent = '2 adjustments active';
      renalNote.textContent = 'Moderate CKD — APAP max 2.5 g/day, NSAIDs absolutely contraindicated, close monitoring required. Nephrology co-management if declining.';
      document.getElementById('poly-rail-renal') && (document.getElementById('poly-rail-renal').className = 'safety-rail-item srl-red');
    } else if (P.egfr < 60) {
      renalVal.textContent = '1 dose ceiling active';
      renalNote.textContent = 'Acetaminophen ceiling at 3 g/day (older adult + G3a CKD). NSAIDs excluded — renal constraint plus documented intolerance. Monitor eGFR trajectory 6-weekly.' + (P.egfr >= 50 && P.egfr <= 62 ? ' Trajectory unconfirmed — no prior eGFR on record.' : '');
      document.getElementById('poly-rail-renal') && (document.getElementById('poly-rail-renal').className = 'safety-rail-item srl-amber');
    } else {
      renalVal.textContent = 'Standard dosing';
      renalNote.textContent = 'eGFR ≥60 — standard analgesic dosing permissible on renal grounds. Age-adjusted ceiling (older adult 3 g/day) still applies.';
      document.getElementById('poly-rail-renal') && (document.getElementById('poly-rail-renal').className = 'safety-rail-item srl-green');
    }
  }
}

function updatePolyInteractionFlags() {
  // Amlodipine–NSAID flag and severity
  var amlNsaidFlag = document.getElementById('poly-aml-nsaid-flag');
  var amlNsaidDetail = document.getElementById('poly-aml-nsaid-detail');
  var intSev = document.getElementById('poly-int-aml-nsaid-sev');
  var intMech = document.getElementById('poly-int-aml-nsaid-mech');

  if (nsaidContraindicated()) {
    if (amlNsaidFlag) { amlNsaidFlag.className = 'poly-interaction-flag poly-flag-green'; amlNsaidFlag.textContent = '✓ NSAID excluded — interaction prevented'; }
    if (amlNsaidDetail) amlNsaidDetail.textContent = 'NSAIDs are contraindicated in this patient profile. The amlodipine–NSAID interaction is fully mitigated by NSAID exclusion. No monitoring required for this pair on current regimen.';
    if (intSev) { intSev.className = 'poly-int-severity poly-int-sev-ok'; intSev.textContent = 'Risk eliminated'; }
    if (intMech) intMech.textContent = 'NSAIDs excluded from this patient\'s regimen due to documented intolerance and contraindication profile. Amlodipine antihypertensive efficacy is therefore not at risk. This interaction becomes clinically relevant again only if NSAID restrictions are revisited — which would require specialist review.';
  } else {
    if (amlNsaidFlag) { amlNsaidFlag.className = 'poly-interaction-flag poly-flag-amber'; amlNsaidFlag.textContent = '⚠ NSAID: monitor BP'; }
    if (amlNsaidDetail) amlNsaidDetail.textContent = 'NSAIDs are conditionally accessible at current parameters. If initiated: BP monitoring at 2 weeks is mandatory. Prior response (+18 mmHg with diclofenac) indicates high individual sensitivity.';
    if (intSev) { intSev.className = 'poly-int-severity poly-int-sev-avoid'; intSev.textContent = 'Monitor closely'; }
    if (intMech) intMech.textContent = 'NSAIDs impair prostaglandin-mediated vasodilation and promote sodium retention, opposing CCB antihypertensive effect. In this patient, diclofenac previously caused +18 mmHg systolic rise. If NSAID pathway becomes necessary: low-dose, shortest duration, BP check at 2 weeks.';
  }
}

function updateReactiveDoseLabels() {
  // Acetaminophen renal label
  var apapLabel = document.getElementById('poly-apap-renal-label');
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
  var banner = document.getElementById('poly-monitoring-banner');
  var label = document.getElementById('poly-mib-label');
  var text = document.getElementById('poly-mib-text');
  var schedule = document.getElementById('poly-mib-schedule');
  if (!banner || !label || !text || !schedule) return;

  var complexity = computeComplexity();
  
  // Uncertainty modifiers — borderline renal without trend, unverified adherence
  var renalTrendUnknown = (P.egfr >= 50 && P.egfr <= 62);
  var adherenceUnverified = (P.adh === 'partial' || P.adh === 'unknown');

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
    // Conservative uplift: borderline renal + unverified adherence = treated as moderate-elevated
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

// Also call on DOMContentLoaded
document.addEventListener('DOMContentLoaded', function() {
  updatePolypharmacyPanel();
  initLongitudinalProgression();
});

// ════════════════════════════════════════════════════════════════
//  LONGITUDINAL PROGRESSION ENGINE — v14
//  Simulates clinically realistic patient status evolution across
//  follow-up time-points without replacing the interactive P engine.
//  Each time-point applies parameter drift to P, runs the reasoning
//  engine, and surfaces a clinical delta narrative.
// ════════════════════════════════════════════════════════════════

// Baseline patient state — preserved for reset
var P_BASELINE = null;
var LP_CURRENT_TP = 0;  // active timepoint index

// ── Time-point definitions ──
// Each entry describes: label, parameter drift relative to baseline,
// clinical narrative for the delta strip, and pathway outcomes.
// Drift is intentionally realistic and non-dramatic.
var LP_TIMEPOINTS = [
  {
    idx: 0,
    label: 'Day 1',
    sublabel: 'Initiation visit',
    // No drift — baseline state
    drift: {},
    // No delta strip at Day 1
    delta: null,
    // Pathway states: 'active' | 'past' | 'future'
    pathwayStates: ['active', 'future', 'future', 'future', 'future'],
    pathwayOutcomes: [null, null, null, null, null],
    missed: false
  },
  {
    idx: 1,
    label: 'Week 2',
    sublabel: 'Pain & adherence review',
    // Clinically believable 2-week drift:
    // - Pain partially improved (acetaminophen beginning to work, fixed schedule started)
    // - Adherence still inconsistent — patient reverting to PRN pattern
    // - eGFR stable (too early for change)
    // - BP unchanged
    drift: {
      pain: -1,          // mild improvement — drug working but not at goal
      adh: 'partial',    // still inconsistent; no change confirmed
      // egfr same, bp same
    },
    delta: {
      severity: 'warn',  // amber — partial response only, adherence concern persists
      title: 'Status at Week 2 review',
      from: 'Since Day 1 initiation',
      changes: [
        { param: 'Pain (NRS)', text: '<span class="lp-worsened">Still 5/10</span> — partial improvement from 6/10. Target NRS ≤3 not yet reached. Functional limitations persist.', key: 'pain' },
        { param: 'Adherence', text: '<span class="lp-new">PRN pattern resuming</span> — patient reports not taking doses on low-pain days. Fixed-schedule adherence not confirmed at this visit.', key: 'adh' },
        { param: 'Renal (eGFR)', text: '<span class="lp-unchanged">Stable ~58 mL/min</span> — baseline labs obtained at Day 1. No trajectory change detectable at 2 weeks.', key: 'egfr' },
        { param: 'GI tolerance', text: '<span class="lp-improved">Tolerating well</span> — no epigastric symptoms reported. Pantoprazole cover maintained.', key: 'gi' }
      ],
      implication: 'Pain response is partial, but escalation criteria are not yet met on confirmed fixed-schedule therapy. The unresolved adherence gap means apparent non-response cannot be attributed to pharmacological inadequacy — reinforce TID schedule before considering escalation. Escalation at this point would be premature.'
    },
    pathwayStates: ['past', 'active', 'future', 'future', 'future'],
    pathwayOutcomes: [
      { cls: 'outcome-ok', text: '✓ Initiated' },
      { cls: 'outcome-escalated', text: '→ Adherence: unconfirmed' },
      null, null, null
    ],
    missed: false
  },
  {
    idx: 2,
    label: 'Week 4',
    sublabel: 'Escalation decision',
    // 4-week drift — realistic progression under sub-optimal adherence:
    // - Pain partially persisting — patient not reliably taking medication
    // - Adherence deteriorated to poor (missed doses most days)
    // - eGFR very mild early signal (noise level, but worth noting)
    // - BP slightly crept (diet, missed amlodipine occasionally)
    drift: {
      pain: 0,           // Pain unchanged from baseline (adherence-driven)
      adh: 'poor',       // adherence has deteriorated — now confirmed poor
      egfr: -3,          // 58 → 55: small decline, within noise but notable as trend
      bp: +5             // 128 → 133: mildly elevated, diet / medication adherence
    },
    delta: {
      severity: 'warn',
      title: 'Status at Week 4 escalation review',
      from: 'Accumulated since Day 1 initiation',
      changes: [
        { param: 'Pain (NRS)', text: '<span class="lp-worsened">6/10 — unchanged</span> from baseline. Acetaminophen analgesic ceiling may be insufficient, but adherence failure has not been excluded as primary driver.', key: 'pain' },
        { param: 'Adherence', text: '<span class="lp-worsened">Confirmed poor</span> — patient now reporting most-days missed doses. PRN use only on severe pain days. Fixed TID schedule not established despite reinforcement at Week 2.', key: 'adh' },
        { param: 'Renal (eGFR)', text: '<span class="lp-new">eGFR 55 mL/min</span> — small decline from 58 at Day 1. Within biological variability, but directionally declining. G3a range maintained. Trend direction now visible for first time.', key: 'egfr' },
        { param: 'Blood pressure', text: '<span class="lp-new">133 mmHg systolic</span> — mildly elevated from 128. Within acceptable range. Consistent with intermittent amlodipine adherence.', key: 'bp' }
      ],
      implication: 'Escalation at Week 4 is clinically premature while adherence remains unconfirmed. Pain persistence at NRS 6/10 cannot be reliably attributed to pharmacological inadequacy when the patient is not taking medications as prescribed. The renal trend (58→55) is small but now directionally visible — escalation to topical NSAID should be deferred until adherence is established and the renal trajectory is confirmed stable. Polypharmacy burden has increased with adherence-driven therapeutic uncertainty.'
    },
    pathwayStates: ['past', 'past', 'active', 'future', 'future'],
    pathwayOutcomes: [
      { cls: 'outcome-ok', text: '✓ Initiated' },
      { cls: 'outcome-concern', text: '⚠ Adherence gap — unresolved' },
      { cls: 'outcome-escalated', text: '→ Deferred — adherence prerequisite unmet' },
      null, null
    ],
    missed: false
  },
  {
    idx: 3,
    label: 'Week 8',
    sublabel: 'Comprehensive review',
    // 8-week drift — consequences of delayed escalation and continued poor adherence:
    // - eGFR decline now meaningful: 58 → 51 (trending into G3b)
    // - BP further elevated: 133 → 142 (approaching threshold)
    // - Pain still 6/10 — no improvement; conservative management ceiling reached
    // - Adherence still poor — persistent pattern
    // - This combination closes the topical NSAID window via renal decline
    drift: {
      pain: 0,
      adh: 'poor',
      egfr: -7,          // 58 → 51: now a meaningful 12% decline — escalation safety changes
      bp: +14,           // 128 → 142: elevated — approaching but not yet crossing threshold
      cv: 'high'         // CV risk reclassified given trajectory
    },
    delta: {
      severity: 'alert',
      title: 'Status at Week 8 — management reassessment required',
      from: 'Progressive change since Day 1',
      changes: [
        { param: 'Renal (eGFR)', text: '<span class="lp-worsened">eGFR 51 mL/min</span> — down from 58 at baseline. 12% decline over 8 weeks. Trend now confirmed declining. Approaching the 50 mL/min absolute NSAID threshold. Topical NSAID escalation window is closing.', key: 'egfr' },
        { param: 'Blood pressure', text: '<span class="lp-worsened">142 mmHg systolic</span> — progressively elevated. Amlodipine adherence should be reviewed. Not yet triggering the 160 mmHg discontinuation threshold, but trajectory warrants active monitoring.', key: 'bp' },
        { param: 'Cardiovascular risk', text: '<span class="lp-worsened">Reclassified: High</span> — cumulative progression of hypertension trajectory and declining renal function has shifted the CV risk profile.', key: 'cv' },
        { param: 'Pain (NRS)', text: '<span class="lp-worsened">Still 6/10</span> — unchanged over 8 weeks. Conservative management ceiling has been reached under current adherence pattern. Functional goals not met.', key: 'pain' },
        { param: 'Adherence', text: '<span class="lp-worsened">Persistent poor pattern</span> — 8-week pattern now confirmed. Blister packaging was not implemented. Pharmacological efficacy assessment is unreliable.', key: 'adh' }
      ],
      implication: 'The Week 8 picture has materially shifted the risk balance. The eGFR decline from 58 to 51 narrows the escalation corridor — topical NSAID use now requires confirmation that eGFR is ≥50, which it marginally meets but without safety margin. The BP trajectory (128→142) and reclassified CV risk make any systemic NSAID inappropriate. Conservative management ceiling has been reached. Physiotherapy referral (home-based) and orthopedic consultation are now the appropriate next steps, not further pharmacological escalation.'
    },
    pathwayStates: ['past', 'past', 'past', 'active', 'future'],
    pathwayOutcomes: [
      { cls: 'outcome-ok', text: '✓ Initiated' },
      { cls: 'outcome-concern', text: '⚠ Adherence unresolved' },
      { cls: 'outcome-escalated', text: '→ Conservative mgmt ceiling reached' },
      { cls: 'outcome-concern', text: '⚠ Renal + BP trend: active monitoring' },
      null
    ],
    missed: false
  },
  {
    idx: 4,
    label: '3 Months',
    sublabel: 'Stable-phase review',
    // 3-month drift — physiotherapy initiated, partial adherence improvement
    // but renal function has stabilised at a lower level. Key question: surgical candidacy.
    // Assuming physiotherapy was eventually started (delayed) and adherence partially improved.
    drift: {
      pain: -2,          // 6 → 4: partial improvement with physio + better adherence
      adh: 'partial',    // improved from poor to inconsistent — not yet good
      egfr: -9,          // 58 → 49: small further decline from week 8 level (51→49)
                         // NOTE: egfr is applied as delta from BASELINE, not from prev timepoint
      bp: +10,           // 128 → 138: managed better with adherence but still elevated
      cv: 'high'         // maintained reclassification
    },
    delta: {
      severity: 'warn',
      title: 'Status at 3-month stable-phase review',
      from: 'Longitudinal course: Day 1 → 3 months',
      changes: [
        { param: 'Renal (eGFR)', text: '<span class="lp-worsened">eGFR 49 mL/min</span> — crossed the 50 mL/min NSAID threshold. All NSAIDs now absolutely contraindicated. Acetaminophen ceiling reduced to 2.5 g/day. Nephrology co-management now indicated.', key: 'egfr' },
        { param: 'Pain (NRS)', text: '<span class="lp-improved">4/10 — partial improvement</span> from 6/10 baseline. Physiotherapy has contributed to functional progress. Not at target (NRS ≤3) but trend is improving.', key: 'pain' },
        { param: 'Adherence', text: '<span class="lp-improved">Improving — inconsistent</span> but better than prior visits. Blister packaging implemented at Week 10. Fixed-schedule use more consistent.', key: 'adh' },
        { param: 'Blood pressure', text: '<span class="lp-unchanged">138 mmHg systolic</span> — stable at elevated level. Antihypertensive adherence improved. Monitoring ongoing. Amlodipine remains appropriate.', key: 'bp' },
        { param: 'Surgical candidacy', text: '<span class="lp-new">TKA discussion initiated</span> — functional goals not fully met at 3 months. Orthopedic referral submitted. Conservative management ceiling confirmed.', key: null }
      ],
      implication: 'The 3-month trajectory has produced a meaningful shift in the treatment logic. eGFR has crossed 50 mL/min, making all NSAIDs absolutely contraindicated and reducing the acetaminophen ceiling. The previously acceptable topical NSAID escalation path is now closed permanently under the current renal trajectory. Pain has partially improved with physiotherapy. The dominant clinical question is now surgical candidacy assessment (TKA) rather than pharmacological escalation. Nephrology co-management is required for ongoing renal monitoring. The polypharmacy burden has paradoxically simplified — fewer options mean a cleaner, more conservative regimen.'
    },
    pathwayStates: ['past', 'past', 'past', 'past', 'active'],
    pathwayOutcomes: [
      { cls: 'outcome-ok', text: '✓ Initiated' },
      { cls: 'outcome-concern', text: '⚠ Adherence concern (resolved at wk 10)' },
      { cls: 'outcome-escalated', text: '→ Physio referral — delayed' },
      { cls: 'outcome-escalated', text: '→ Ortho referral submitted' },
      { cls: 'outcome-concern', text: '⚠ eGFR <50 — pathway closed' }
    ],
    missed: false
  }
];

// ── Initialise the system ──
function initLongitudinalProgression() {
  // Snapshot baseline state
  P_BASELINE = {
    egfr: P.egfr, gi: P.gi, bp: P.bp, cv: P.cv,
    pain: P.pain, age: P.age, failed: P.failed,
    adh: P.adh, sed: P.sed, intol: P.intol
  };
  // Render Day 1 state
  renderTimepointButtons(0);
  updatePathwayStates(0);
}

// ── Apply a timepoint ──
function setTimepoint(idx) {
  LP_CURRENT_TP = idx;
  var tp = LP_TIMEPOINTS[idx];

  // Reset P to baseline
  Object.assign(P, P_BASELINE);

  // Apply drift
  var d = tp.drift;
  if (d.egfr !== undefined) P.egfr = Math.max(10, P_BASELINE.egfr + d.egfr);
  if (d.bp !== undefined)   P.bp   = Math.max(100, P_BASELINE.bp + d.bp);
  if (d.pain !== undefined) P.pain = Math.max(1, Math.min(10, P_BASELINE.pain + d.pain));
  if (d.adh !== undefined)  P.adh  = d.adh;
  if (d.cv !== undefined)   P.cv   = d.cv;

  // Run reasoning engine (updates all dynamic content)
  runReasoningEngine();
  updatePolypharmacyPanel();

  // Update timepoint button states
  renderTimepointButtons(idx);

  // Render delta strip
  renderDeltaStrip(tp);

  // Missed banner — future feature hook (for now shown if gap ≥ 2 steps)
  renderMissedBanner(idx);

  // Update pathway visual states
  updatePathwayStates(idx);

  // Sync popover range displays to new P values
  var egfrRng = document.getElementById('rng-egfr');
  var bpRng   = document.getElementById('rng-bp');
  var painRng = document.getElementById('rng-pain');
  if (egfrRng) { egfrRng.value = P.egfr; document.getElementById('rng-egfr-val').textContent = P.egfr; }
  if (bpRng)   { bpRng.value   = P.bp;   document.getElementById('rng-bp-val').textContent   = P.bp;   }
  if (painRng) { painRng.value = P.pain; document.getElementById('rng-pain-val').textContent = P.pain; }
}

// ── Render timepoint selector buttons ──
function renderTimepointButtons(activeIdx) {
  for (var i = 0; i < LP_TIMEPOINTS.length; i++) {
    var btn = document.getElementById('lp-tp-' + i);
    if (!btn) continue;
    btn.className = 'lp-tp ' + (i < activeIdx ? 'lp-past' : i === activeIdx ? 'lp-active' : 'lp-future');
    // Dot inside button
    var dotEl = btn.querySelector('.lp-tp-dot');
    if (dotEl) {
      if (i < activeIdx) {
        dotEl.style.background = 'var(--border)';
        dotEl.style.border = 'none';
        dotEl.style.borderRadius = '50%';
        dotEl.style.display = 'inline-block';
        dotEl.style.width = '6px';
        dotEl.style.height = '6px';
      } else if (i === activeIdx) {
        dotEl.style.background = 'var(--blue)';
        dotEl.style.border = 'none';
        dotEl.style.borderRadius = '50%';
        dotEl.style.display = 'inline-block';
        dotEl.style.width = '6px';
        dotEl.style.height = '6px';
      } else {
        dotEl.style.background = 'transparent';
        dotEl.style.border = '1px solid var(--border)';
        dotEl.style.borderRadius = '50%';
        dotEl.style.display = 'inline-block';
        dotEl.style.width = '6px';
        dotEl.style.height = '6px';
      }
    }
    // Status tag for past checkpoints
    var tp = LP_TIMEPOINTS[i];
    var weekDiv = btn.querySelector('.lp-tp-week');
    if (weekDiv) {
      // Remove any existing status tag
      var existingTag = weekDiv.querySelector('.lp-status-tag');
      if (existingTag) existingTag.remove();
      if (i < activeIdx && tp.pathwayOutcomes && tp.pathwayOutcomes[i]) {
        var out = tp.pathwayOutcomes[i];
        var tag = document.createElement('span');
        // Determine class from outcome
        var tagCls = 'lp-status-tag ';
        if (out.cls === 'outcome-ok') tagCls += 'lp-status-ok';
        else if (out.cls === 'outcome-escalated') tagCls += 'lp-status-escalated';
        else if (out.cls === 'outcome-concern') tagCls += 'lp-status-concern';
        else tagCls += 'lp-status-missed';
        tag.className = tagCls;
        tag.style.marginLeft = '5px';
        // Use abbreviated text
        tag.textContent = i === 0 ? 'Done' : out.cls === 'outcome-ok' ? 'Completed' : out.cls === 'outcome-escalated' ? 'Escalated' : 'Concern';
        weekDiv.appendChild(tag);
      }
    }
  }
}

// ── Render delta strip ──
function renderDeltaStrip(tp) {
  var delta = document.getElementById('lp-delta');
  if (!delta) return;

  if (!tp.delta) {
    delta.className = 'lp-delta';
    return;
  }

  var d = tp.delta;
  delta.className = 'lp-delta lp-delta-visible' +
    (d.severity === 'alert' ? ' lp-delta-alert' : d.severity === 'warn' ? ' lp-delta-warn' : '');

  var titleEl = document.getElementById('lp-delta-title');
  var fromEl  = document.getElementById('lp-delta-from');
  var changesEl = document.getElementById('lp-delta-changes');
  var implEl  = document.getElementById('lp-implication-text');
  var implLabel = document.getElementById('lp-implication-label');

  if (titleEl) titleEl.textContent = d.title;
  if (fromEl)  fromEl.textContent  = d.from;
  if (implEl)  implEl.textContent  = d.implication;

  if (implLabel) {
    implLabel.textContent = d.severity === 'alert'
      ? 'Escalation implication'
      : d.severity === 'warn'
      ? 'Management implication'
      : 'Reasoning implication';
  }

  if (changesEl) {
    changesEl.innerHTML = '';
    d.changes.forEach(function(c) {
      var row = document.createElement('div');
      row.className = 'lp-delta-item';
      row.innerHTML = '<span class="lp-delta-param">' + c.param + '</span>'
        + '<span class="lp-delta-change">' + c.text + '</span>';
      changesEl.appendChild(row);
    });
  }
}

// ── Render missed follow-up banner ──
function renderMissedBanner(idx) {
  var banner = document.getElementById('lp-missed-banner');
  if (!banner) return;

  // Show missed banner only at Week 8 (idx=3) given the Week 4 escalation was deferred —
  // the consequence is that monitoring did not alter the drug decision in time.
  if (idx === 3) {
    banner.className = 'lp-missed-banner lp-missed-visible';
    var textEl = document.getElementById('lp-missed-text');
    if (textEl) textEl.textContent = 'Escalation checkpoint at Week 4 was reached without adherence being confirmed. The renal trend that emerged between Weeks 4–8 (eGFR 55→51) occurred without a monitoring-triggered reassessment. Previously acceptable NSAID escalation paths are now narrowed by a decline that went undetected within the monitoring window.';
  } else if (idx === 4) {
    banner.className = 'lp-missed-banner lp-missed-visible';
    var textEl2 = document.getElementById('lp-missed-text');
    if (textEl2) textEl2.textContent = 'The eGFR threshold crossing (below 50 mL/min) at 3 months has closed the topical NSAID escalation pathway that was conditionally available at initiation. This represents a previously acceptable option becoming permanently unsafe due to monitored disease progression — not a prescribing error, but a clinically expected consequence of longitudinal CKD in this patient profile.';
  } else {
    banner.className = 'lp-missed-banner';
  }
}

// ── Update pathway visual states ──
function updatePathwayStates(activeIdx) {
  var tp = LP_TIMEPOINTS[activeIdx];
  if (!tp) return;

  for (var i = 0; i < 5; i++) {
    var item = document.getElementById('lp-pathway-' + i);
    var dot  = document.getElementById('lp-pdot-' + i);
    var outcomeEl = document.getElementById('lp-outcome-' + i);

    if (!item) continue;

    var state = tp.pathwayStates[i];
    var outcomeData = tp.pathwayOutcomes ? tp.pathwayOutcomes[i] : null;

    // Remove prior lp state classes
    item.classList.remove('lp-item-past', 'lp-item-active', 'lp-item-future');
    if (state === 'past') item.classList.add('lp-item-past');
    else if (state === 'active') item.classList.add('lp-item-active');
    else if (state === 'future') item.classList.add('lp-item-future');

    // Pathway dot color
    if (dot) {
      dot.className = 'mn-pathway-dot'
        + (state === 'active' ? ' active' : '')
        + (state === 'future' ? '' : '');
      if (state === 'past') {
        dot.style.background = 'var(--border)';
        dot.style.borderColor = 'var(--border)';
      } else if (state === 'active') {
        dot.style.background = 'var(--blue)';
        dot.style.borderColor = 'var(--blue)';
      } else {
        dot.style.background = '';
        dot.style.borderColor = '';
      }
    }

    // Outcome badge
    if (outcomeEl) {
      if (outcomeData && state !== 'future') {
        // Remove old badge
        var existingBadge = outcomeEl.querySelector('.lp-past-outcome');
        if (existingBadge) existingBadge.remove();
        var badge = document.createElement('span');
        badge.className = 'lp-past-outcome ' + outcomeData.cls;
        badge.textContent = outcomeData.text;
        outcomeEl.appendChild(badge);
      } else {
        outcomeEl.innerHTML = '';
      }
    }
  }
}

/* ════════════════════════════════
   ENTRY PAGE — workflow gate
════════════════════════════════ */
function enterWorkflow() {
  var ep = document.getElementById('entry-page');
  var wp = document.getElementById('workflow-page');
  if (!ep || !wp) return;
  ep.style.transition = 'opacity 0.25s ease';
  ep.style.opacity = '0';
  setTimeout(function() {
    ep.style.display = 'none';
    wp.style.display = 'block';
    window.scrollTo({top: 0, behavior: 'auto'});
  }, 260);
}
