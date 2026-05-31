/* ════════════════════════════════════════════════════════════
   poly.js — Polypharmacy Review workflow: state, helpers,
             reasoning engine, UI updates, monitoring
   Clinstrux · Clinical Decision Infrastructure
════════════════════════════════════════════════════════════ */

/* ════════════════════════════════════════════════════════════
   POLYPHARMACY REVIEW — STATE
════════════════════════════════════════════════════════════ */

var POLY = {
  meds:         11,
  highrisk:     3,
  interactions: 4,
  duplicate:    'yes',
  ach:          5,
  falls:        'high'
};

var _polyActivePopover = null;

/* ════════════════════════════════════════════════════════════
   POLY — NAVIGATION
════════════════════════════════════════════════════════════ */

function polyShowSection(id, btn) {
  document.querySelectorAll('#poly-page .dp-section').forEach(function(s) { s.classList.remove('active'); });
  var t = document.getElementById(id); if (t) t.classList.add('active');
  document.querySelectorAll('#poly-page .dp-nav-item').forEach(function(n) { n.classList.remove('active'); });
  if (btn) btn.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ════════════════════════════════════════════════════════════
   POLY — POPOVERS
════════════════════════════════════════════════════════════ */

function polyOpenPopover(key, e) {
  if (e) e.stopPropagation();
  polyClosePopover(_polyActivePopover);
  var pop  = document.getElementById('poly-pop-' + key);
  var card = document.getElementById('poly-p-' + key);
  if (!pop || !card) return;
  // Sync controls to current state
  var syncMap = { meds:'rng', highrisk:'rng', interactions:'rng', ach:'rng' };
  if (syncMap[key] === 'rng') {
    var r = document.getElementById('poly-rng-' + key);
    var v = document.getElementById('poly-rng-' + key + '-val');
    if (r) { r.value = POLY[key]; if (v) v.textContent = POLY[key]; }
  }
  if (key === 'duplicate') { var s = document.getElementById('poly-sel-duplicate'); if (s) s.value = POLY.duplicate; }
  if (key === 'falls')     { var s = document.getElementById('poly-sel-falls');     if (s) s.value = POLY.falls; }
  pop.style.display = 'block';
  pop.style.top  = (card.offsetTop + card.offsetHeight + 4) + 'px';
  pop.style.left = card.offsetLeft + 'px';
  _polyActivePopover = key;
}

function polyClosePopover(key) {
  if (!key) return;
  var pop = document.getElementById('poly-pop-' + key);
  if (pop) pop.style.display = 'none';
  if (_polyActivePopover === key) _polyActivePopover = null;
}
/* ════════════════════════════════════════════════════════════
   POLY — APPLY PARAM
════════════════════════════════════════════════════════════ */

function polyApplyParam(key) {
  var rngKeys = ['meds','highrisk','interactions','ach'];
  if (rngKeys.indexOf(key) !== -1) {
    var r = document.getElementById('poly-rng-' + key);
    if (r) POLY[key] = parseInt(r.value, 10);
  }
  if (key === 'duplicate') { var s = document.getElementById('poly-sel-duplicate'); if (s) POLY.duplicate = s.value; }
  if (key === 'falls')     { var s = document.getElementById('poly-sel-falls');     if (s) POLY.falls     = s.value; }
  polyClosePopover(key);
  polyRunReasoningEngine();
}

/* ════════════════════════════════════════════════════════════
   POLY — HELPERS
════════════════════════════════════════════════════════════ */

function polyHyperPoly()      { return POLY.meds >= 10; }
function polyHighAch()        { return POLY.ach >= 3; }
function polyVeryHighAch()    { return POLY.ach >= 6; }
function polyFallsHigh()      { return POLY.falls === 'high'; }
function polyFallsModerate()  { return POLY.falls === 'moderate'; }
function polyHasDuplicate()   { return POLY.duplicate === 'yes'; }
function polySigInteractions(){ return POLY.interactions >= 3; }
function polyHighRisk()       { return POLY.highrisk >= 3; }

/* ════════════════════════════════════════════════════════════
   POLY — REASONING ENGINE
════════════════════════════════════════════════════════════ */

function polyRunReasoningEngine() {
  polyUpdateParamCards();
  polyUpdateClinicalStatusSummary();
  polyUpdateClinicalImpression();
  polyUpdateRecommendation();
  polyUpdateMonitoring();
}

/* ── 1. Param cards ───────────────────────────────────────────────────────── */
function polyUpdateParamCards() {
  function setVal(id, v)   { var e = document.getElementById(id); if (e) e.textContent = v; }
  function setCls(id, cls) {
    var e = document.getElementById(id); if (!e) return;
    e.className = e.className.replace(/abx-val-\w+/g,'').trim();
    if (cls) e.classList.add(cls);
  }

  // Meds
  var medsLabel = POLY.meds >= 10 ? 'Hyper-polypharmacy' : POLY.meds >= 5 ? 'Polypharmacy' : 'Low burden';
  var medsCls   = POLY.meds >= 10 ? 'abx-val-red' : POLY.meds >= 5 ? 'abx-val-amber' : 'abx-val-green';
  setVal('poly-val-meds', POLY.meds); setVal('poly-status-meds', medsLabel); setCls('poly-val-meds', medsCls);

  // High-risk
  var hrLabel = POLY.highrisk >= 4 ? 'Very high — ' + POLY.highrisk + ' agents' : POLY.highrisk >= 2 ? 'Warfarin · opioid · hypnotic' : POLY.highrisk === 1 ? '1 high-risk agent' : 'None identified';
  var hrCls   = POLY.highrisk >= 3 ? 'abx-val-red' : POLY.highrisk >= 1 ? 'abx-val-amber' : 'abx-val-green';
  setVal('poly-val-highrisk', POLY.highrisk); setVal('poly-status-highrisk', hrLabel); setCls('poly-val-highrisk', hrCls);

  // Interactions
  var intSig   = POLY.interactions >= 4 ? '2 clinically significant' : POLY.interactions >= 2 ? '1 clinically significant' : 'No significant interactions';
  var intCls   = POLY.interactions >= 4 ? 'abx-val-red' : POLY.interactions >= 2 ? 'abx-val-amber' : 'abx-val-green';
  setVal('poly-val-interactions', POLY.interactions); setVal('poly-status-interactions', intSig); setCls('poly-val-interactions', intCls);

  // Duplicate
  var dupLabel = POLY.duplicate === 'yes' ? 'Dual antihypertensive overlap' : 'No duplication detected';
  var dupCls   = POLY.duplicate === 'yes' ? 'abx-val-amber' : 'abx-val-green';
  setVal('poly-val-duplicate', POLY.duplicate === 'yes' ? 'Yes' : 'No'); setVal('poly-status-duplicate', dupLabel); setCls('poly-val-duplicate', dupCls);

  // ACH
  var achLabel = POLY.ach >= 6 ? 'Very high — severe cognitive risk' : POLY.ach >= 3 ? 'High — oxybutynin + amitriptyline + promethazine' : POLY.ach >= 1 ? 'Mild — monitor' : 'Minimal';
  var achCls   = POLY.ach >= 6 ? 'abx-val-red' : POLY.ach >= 3 ? 'abx-val-amber' : '';
  setVal('poly-val-ach', POLY.ach); setVal('poly-status-ach', achLabel); setCls('poly-val-ach', achCls);

  // Falls
  var fallsLabels = { low:'Low — no significant FRIDs', moderate:'Moderate — 1–2 FRIDs present', high:'Opioid + hypnotic + antihypertensive' };
  var fallsCls    = { low:'abx-val-green', moderate:'abx-val-amber', high:'abx-val-red' };
  var fallsDisplay= { low:'Low', moderate:'Moderate', high:'High' };
  setVal('poly-val-falls', fallsDisplay[POLY.falls] || 'High');
  setVal('poly-status-falls', fallsLabels[POLY.falls] || '');
  setCls('poly-val-falls', fallsCls[POLY.falls] || 'abx-val-red');
}

/* ── 2. Clinical Status Summary ──────────────────────────────────────────── */
function polyUpdateClinicalStatusSummary() {
  function setVal(id, v) { var e = document.getElementById(id); if (e) e.textContent = v; }
  function setCls(id, cls) {
    var e = document.getElementById(id); if (!e) return;
    e.className = e.className.replace(/css-val-\w+/g,'').trim();
    if (cls) e.classList.add(cls);
  }

  // Burden
  var burdenVal = polyHyperPoly() ? 'Hyper-polypharmacy' : POLY.meds >= 5 ? 'Polypharmacy' : 'Low burden';
  var burdenSub = POLY.meds + ' medications · ' + (polyHyperPoly() ? '≥10 threshold' : '≥5 threshold');
  var burdenCls = polyHyperPoly() ? 'css-val-red' : POLY.meds >= 5 ? 'css-val-amber' : 'css-val-green';
  setVal('poly-m-burden', burdenVal); setVal('poly-m-burden-sub', burdenSub); setCls('poly-m-burden', burdenCls);

  // ACH
  var achVal = polyVeryHighAch() ? 'Very High (ACB ' + POLY.ach + ')' : polyHighAch() ? 'High (ACB ' + POLY.ach + ')' : 'Low (ACB ' + POLY.ach + ')';
  var achSub = polyHighAch() ? 'Threshold ≥3 — cognitive risk' : 'Within acceptable range';
  var achCls = polyVeryHighAch() ? 'css-val-red' : polyHighAch() ? 'css-val-amber' : 'css-val-green';
  setVal('poly-m-ach', achVal); setVal('poly-m-ach-sub', achSub); setCls('poly-m-ach', achCls);

  // Falls
  var fallsVal = { high:'Elevated', moderate:'Moderate', low:'Low' }[POLY.falls];
  var fallsSub = { high:'3 FRIDs · opioid + hypnotic + AHT', moderate:'1–2 FRIDs present', low:'No significant FRIDs' }[POLY.falls];
  var fallsCls = { high:'css-val-red', moderate:'css-val-amber', low:'css-val-green' }[POLY.falls];
  setVal('poly-m-falls', fallsVal); setVal('poly-m-falls-sub', fallsSub); setCls('poly-m-falls', fallsCls);

  // Interactions
  var intVal = POLY.interactions >= 4 ? 'Moderate–High' : POLY.interactions >= 2 ? 'Moderate' : 'Low';
  var intSub = POLY.interactions + ' interactions · ' + (POLY.interactions >= 4 ? '2 significant' : POLY.interactions >= 2 ? '1 significant' : 'none significant');
  var intCls = POLY.interactions >= 4 ? 'css-val-amber' : POLY.interactions >= 2 ? 'css-val-amber' : 'css-val-green';
  setVal('poly-m-interactions', intVal); setVal('poly-m-interactions-sub', intSub); setCls('poly-m-interactions', intCls);

  // Overall text
  var parts = [];
  parts.push('Patient carries a ' + (polyHyperPoly() ? 'high' : 'significant') + ' medication burden with ' + POLY.meds + ' concurrent agents' + (polyHighRisk() ? ' including ' + POLY.highrisk + ' high-risk medications' : '') + '.');
  if (polyHighAch()) parts.push('Anticholinergic burden is ' + (polyVeryHighAch() ? 'very high' : 'high') + ' (ACB ' + POLY.ach + ') and represents a significant risk for cognitive impairment and falls in this patient.');
  if (polyFallsHigh()) parts.push('Medication-related falls risk is elevated with multiple fall-risk-increasing drugs present concurrently.');
  if (polySigInteractions()) parts.push('Multiple clinically significant drug interactions require active management.');
  parts.push('Structured deprescribing review is indicated.');
  var el = document.getElementById('poly-overall-text'); if (el) el.textContent = parts.join(' ');

  // Badge
  var badge = document.getElementById('poly-css-badge');
  var lbl   = document.getElementById('poly-css-badge-label');
  if (badge && lbl) {
    badge.className = 'css-overall-badge';
    if (polyHyperPoly() || polyFallsHigh() || polyVeryHighAch()) {
      badge.classList.add('css-badge-red'); lbl.textContent = 'High burden — review required';
    } else if (POLY.meds >= 5 || polyHighAch()) {
      badge.classList.add('css-badge-amber'); lbl.textContent = 'Elevated burden — optimise';
    } else {
      lbl.textContent = 'Acceptable burden';
    }
  }
}

/* ── 3. Clinical Impression ──────────────────────────────────────────────── */
function polyUpdateClinicalImpression() {
  var lines = [];

  // 1. Opening — overall burden framing
  if (polyHyperPoly()) {
    lines.push({ tone:'red',   text: 'Patient carries a hyper-polypharmacy regimen of ' + POLY.meds + ' concurrent medications. At this level of medication burden, the probability of an adverse drug event, medication error, or adherence failure is substantially elevated. Hyper-polypharmacy in frail older adults is independently associated with increased hospitalisation, falls, and mortality.' });
  } else if (POLY.meds >= 5) {
    lines.push({ tone:'amber', text: 'Patient is currently prescribed ' + POLY.meds + ' medications, meeting the threshold for polypharmacy. While each individual agent may be clinically indicated, the cumulative burden — particularly in the context of frailty and multiple comorbidities — warrants systematic review.' });
  } else {
    lines.push({ tone:'green', text: 'Current medication count (' + POLY.meds + ') is below the polypharmacy threshold. Targeted review of any high-risk agents or interactions remains appropriate.' });
  }

  // 2. Anticholinergic burden
  if (polyVeryHighAch()) {
    lines.push({ tone:'red',   text: 'Anticholinergic burden is very high (ACB score ' + POLY.ach + '). ACB scores above 4 are associated with a significantly increased risk of dementia, falls, urinary retention, and all-cause hospitalisation in older adults. Reducing the anticholinergic load is one of the highest-value interventions available in this case.' });
  } else if (polyHighAch()) {
    lines.push({ tone:'amber', text: 'Anticholinergic burden is clinically significant (ACB score ' + POLY.ach + '). An ACB score of 3 or above is the accepted threshold for harm risk in older adults. Multiple agents are contributing simultaneously — oxybutynin carries the highest individual score and should be the primary deprescribing target.' });
  }

  // 3. Falls risk
  if (polyFallsHigh()) {
    lines.push({ tone:'red',   text: 'Medication-related falls risk is elevated. The concurrent prescription of an opioid, a Z-drug hypnotic, and antihypertensive therapy creates compound sedative and orthostatic risk. Each agent is a recognised fall-risk-increasing drug (FRID); their combination in a frail 81-year-old patient represents a preventable harm risk that warrants immediate attention.' });
  } else if (polyFallsModerate()) {
    lines.push({ tone:'amber', text: 'Medication-related falls risk is moderate. One or two fall-risk-increasing drugs are present. A falls risk assessment should be completed and medication contribution formally documented.' });
  }

  // 4. Drug interactions
  if (POLY.interactions >= 4) {
    lines.push({ tone:'amber', text: 'Multiple drug interactions have been identified (' + POLY.interactions + ' in total). The tramadol–sertraline combination carries clinically significant serotonin syndrome risk and requires urgent prescriber review — this interaction cannot be monitored passively. The remaining interactions should be triaged by severity and managed systematically.' });
  } else if (POLY.interactions >= 2) {
    lines.push({ tone:'amber', text: POLY.interactions + ' drug interactions are present. At least one is clinically significant and requires active management rather than passive monitoring.' });
  }

  // 5. Duplicate therapy
  if (polyHasDuplicate()) {
    lines.push({ tone:'amber', text: 'Duplicate therapeutic class prescribing has been identified. Dual antihypertensive use may be intentional if the clinical target has not been achieved on monotherapy — however, this should be explicitly confirmed. Unintentional duplication is a common source of preventable harm in complex regimens.' });
  }

  // 6. Clinical direction framing
  var conclusion;
  if (polyHyperPoly() && polyFallsHigh() && polyHighAch()) {
    conclusion = 'This regimen represents compound, multi-axis risk and requires urgent structured review. Deprescribing should begin with the highest-risk targets — the serotonin interaction, oxybutynin, and zopiclone — in a stepwise, patient-centred process. A target of ≤8 medications is a reasonable initial goal within 8 weeks.';
  } else if (polyHyperPoly() || polyFallsHigh()) {
    conclusion = 'Structured deprescribing review is indicated. Prioritise the highest-risk agents and interactions, and take one change at a time to allow clear attribution of any symptom changes. Document each decision with patient agreement.';
  } else if (polyHighAch() || polySigInteractions()) {
    conclusion = 'Targeted medication optimisation is recommended. The anticholinergic burden and drug interactions identified represent modifiable risk factors. A focused review addressing these specific issues — without necessarily reducing the total medication count — is the appropriate next step.';
  } else {
    conclusion = 'Current regimen complexity warrants a scheduled medication review. No urgent deprescribing targets are identified, but ongoing monitoring and an annual medication reconciliation are recommended given the patient\'s age and comorbidity profile.';
  }

  var parasEl = document.getElementById('poly-ci-paragraphs');
  if (parasEl) {
    parasEl.innerHTML = lines.map(function(l) {
      return '<div class="ci-line ci-line-' + l.tone + '">' + l.text + '</div>';
    }).join('');
  }
  var concEl = document.getElementById('poly-ci-conclusion-text');
  if (concEl) concEl.textContent = conclusion;
}

/* ── 4. Recommendation ───────────────────────────────────────────────────── */
function polyUpdateRecommendation() {
  function setText(id, v) { var e = document.getElementById(id); if (e) e.textContent = v; }
  function setHTML(id, v) { var e = document.getElementById(id); if (e) e.innerHTML = v; }

  var action, state, rationale, conf, confLabel, confDesc;

  if (polyHyperPoly() && polyFallsHigh() && polyHighAch()) {
    action = 'Structured<br>Deprescribing Review'; state = 'Urgent — multiple targets identified';
    conf = 91; confLabel = 'High confidence'; confDesc = 'Multiple STOPP criteria met · immediate deprescribing targets identified';
    rationale = 'The current regimen carries compound risk across multiple axes — elevated anticholinergic burden (ACB ' + POLY.ach + '), significant falls risk with ' + POLY.highrisk + ' high-risk medications, a clinically important serotonin interaction, and ' + (polyHasDuplicate() ? 'duplicate antihypertensive therapy. ' : 'complex drug interactions. ') + 'Three medications have been identified as primary deprescribing candidates alongside one urgent interaction requiring management. A structured, stepwise review is indicated — addressing the highest-risk agents first.';
  } else if (polyFallsHigh() || polySigInteractions()) {
    action = 'Medication Review<br>Recommended'; state = 'Prompt — active risk factors present';
    conf = 82; confLabel = 'High confidence'; confDesc = 'Falls risk and interaction burden identified';
    rationale = 'Active medication-related risk factors are present — ' + (polyFallsHigh() ? 'elevated falls risk from multiple FRIDs ' : '') + (polySigInteractions() ? 'and clinically significant drug interactions ' : '') + 'require prompt prescriber and pharmacist review. A comprehensive medication review should be scheduled within 1–2 weeks, with any urgent interactions addressed immediately.';
  } else if (polyHighAch() || polyHasDuplicate()) {
    action = 'Targeted Optimisation<br>Recommended'; state = 'Routine — modifiable risks identified';
    conf = 74; confLabel = 'Moderate-high confidence'; confDesc = 'Anticholinergic burden and/or duplicate therapy identified';
    rationale = 'Targeted medication optimisation is appropriate. ' + (polyHighAch() ? 'Anticholinergic burden (ACB ' + POLY.ach + ') is above the threshold for harm in older adults. ' : '') + (polyHasDuplicate() ? 'Duplicate therapeutic class prescribing should be reviewed and confirmed as intentional. ' : '') + 'These are modifiable risk factors that can be addressed within a structured review without necessarily requiring urgent action.';
  } else {
    action = 'Annual Review<br>Recommended'; state = 'Routine — scheduled review appropriate';
    conf = 65; confLabel = 'Moderate confidence'; confDesc = 'No urgent targets — routine reconciliation recommended';
    rationale = 'No urgent deprescribing targets are identified at this review. A scheduled annual medication reconciliation is recommended given the patient\'s age, frailty status, and comorbidity profile. Each medication\'s ongoing indication, dose, and tolerability should be formally reviewed.';
  }

  setHTML('poly-rec-action', action);
  setText('poly-rec-state', state);
  setText('poly-rec-rationale', rationale);
  setText('poly-conf-pct', conf + '%');
  setText('poly-conf-label', confLabel);
  setText('poly-conf-desc', confDesc);
  var bar = document.getElementById('poly-conf-bar'); if (bar) bar.style.width = conf + '%';

  // Update chips
  var chips = document.getElementById('poly-chips');
  if (chips) {
    var c = '<span class="ds-primary-ev-chip strong">STOPP/START v3 criteria</span>';
    c += '<span class="ds-primary-ev-chip strong">AGS Beers Criteria 2023</span>';
    if (polySigInteractions()) c += '<span class="ds-primary-ev-chip caution">Serotonin interaction — action required</span>';
    if (polyHighAch()) c += '<span class="ds-primary-ev-chip caution">ACB ≥3 — cognitive risk</span>';
    if (polyFallsHigh()) c += '<span class="ds-primary-ev-chip caution">Falls risk — FRIDs present</span>';
    if (polyHasDuplicate()) c += '<span class="ds-primary-ev-chip caution">Duplicate therapy — confirm</span>';
    chips.innerHTML = c;
  }

  // Deprescribing target count in monitoring
  var targets = 0;
  if (polyFallsHigh() || polyHighAch()) targets += 3;
  else if (polyFallsModerate() || POLY.interactions >= 2) targets += 2;
  else targets = 1;
  if (polyHasDuplicate()) targets += 1;
  var tEl = document.getElementById('poly-mon-targets'); if (tEl) tEl.textContent = targets;
}

/* ── 5. Monitoring ───────────────────────────────────────────────────────── */
function polyUpdateMonitoring() {
  // Nothing dynamic needed beyond recommendation updates — static schedule is appropriate
}
