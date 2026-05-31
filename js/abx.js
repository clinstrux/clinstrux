/* ════════════════════════════════════════════════════════════
   abx.js — Antibiotic Stewardship workflow: state, helpers,
            reasoning engine, UI updates, monitoring
   Clinstrux · Clinical Decision Infrastructure
════════════════════════════════════════════════════════════ */

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

  // 1. Clinical trajectory — always the opening observation, always primary
  if (abxWorsening()) {
    lines.push({ tone: 'red',   text: 'Clinical trajectory is deteriorating on current antimicrobial therapy. This represents the primary stewardship concern at this review and takes precedence over laboratory data. Symptomatic worsening in the context of ongoing treatment is the accepted definition of treatment failure until an alternative explanation is established.' });
  } else if (abxImproving()) {
    lines.push({ tone: 'green', text: 'Patient is demonstrating meaningful clinical improvement on Day 3 of therapy. Return of oral tolerance and improved mobility are recognised step-down criteria. Clinical trajectory is the primary determinant of the stewardship decision at this stage.' });
  } else {
    lines.push({ tone: 'amber', text: 'Clinical trajectory is stable without clear improvement. The patient has not deteriorated, but the response to current therapy is incomplete. This intermediate position does not provide a firm basis for de-escalation and warrants a further period of observation before any pathway change is made.' });
  }

  // 2. Inflammatory markers — always contextualised against trajectory, never in isolation
  if (abxWbcSeverely() || abxCrpVeryHigh()) {
    if (abxWorsening()) {
      lines.push({ tone: 'red',   text: 'Inflammatory markers are severely elevated (WBC ' + ABX.wbc + ' ×10\u2079/L, CRP ' + ABX.crp + ' mg/L). In the context of clinical deterioration, this pattern is consistent with inadequate antimicrobial treatment response.' });
    } else {
      lines.push({ tone: 'amber', text: 'Inflammatory markers remain significantly elevated (WBC ' + ABX.wbc + ' ×10\u2079/L, CRP ' + ABX.crp + ' mg/L). In a clinically improving patient, markedly elevated CRP should not independently prevent de-escalation — biochemical normalisation typically lags clinical response by 48–72 hours and should not be the primary decision driver.' });
    }
  } else if (abxWbcElevated() || abxCrpHigh()) {
    lines.push({ tone: 'amber', text: 'Inflammatory markers remain above normal range (WBC ' + ABX.wbc + ' ×10\u2079/L, CRP ' + ABX.crp + ' mg/L). This is expected at Day 3 of an acute infective process. Markers should inform but not override the clinical assessment — trajectory is more meaningful than any single value.' });
  } else {
    lines.push({ tone: 'green', text: 'Inflammatory markers are settling (WBC ' + ABX.wbc + ' ×10\u2079/L, CRP ' + ABX.crp + ' mg/L). Biochemical improvement alongside clinical improvement provides strong composite support for de-escalation.' });
  }

  // 3. Fever status
  if (ABX.temp >= 38.5) {
    lines.push({ tone: 'red',   text: 'Patient remains febrile at ' + ABX.temp.toFixed(1) + '\u00b0C. Active fever in this context is a caution against step-down — clinical reassessment is required to determine whether this represents ongoing infective activity or post-infective inflammation.' });
  } else if (abxFeverActive()) {
    lines.push({ tone: 'amber', text: 'Low-grade fever persists at ' + ABX.temp.toFixed(1) + '\u00b0C. In the context of ' + (abxImproving() ? 'overall clinical improvement, this may represent residual post-infective inflammation rather than active infection. Clinical assessment should guide interpretation.' : 'a stable trajectory, this requires monitoring before step-down is considered.') });
  } else {
    lines.push({ tone: 'green', text: 'Defervescence has been achieved (' + ABX.temp.toFixed(1) + '\u00b0C). Resolution of fever alongside clinical improvement satisfies a key IV-to-oral step-down criterion.' });
  }

  // 4. Culture data — the microbiological anchor of the decision
  if (abxCultureResistant()) {
    lines.push({ tone: 'red',   text: 'Culture has confirmed a resistant organism. Broad-spectrum IV cover must be maintained. The de-escalation pathway is closed pending full susceptibility review in conjunction with microbiology or infectious diseases.' });
  } else if (abxCultureSensitive()) {
    lines.push({ tone: 'green', text: 'Culture has identified a sensitive organism amenable to narrow-spectrum oral therapy. This is the strongest available microbiological argument for IV-to-oral step-down and supports de-escalation alongside the clinical picture.' });
  } else if (abxCultureNoGrowth()) {
    lines.push({ tone: 'green', text: 'Blood cultures are negative at 72 hours. No growth on adequate incubation in a clinically improving patient supports step-down from empirical broad-spectrum IV cover. Continued broad-spectrum therapy is not justified by the microbiological data.' });
  } else {
    lines.push({ tone: 'amber', text: 'Culture data remains pending. The final de-escalation decision should account for this result; however, clinical criteria can be evaluated independently and a step-down plan prepared so that the transition can proceed promptly once the result is available.' });
  }

  // 5. Renal — dosing implications, concise
  if (abxGfrSevere()) {
    lines.push({ tone: 'red',   text: 'Severe renal impairment (eGFR ' + ABX.gfr + ' mL/min) requires urgent dose review. All renally-cleared antimicrobials including piperacillin-tazobactam need significant interval adjustment, and any nephrotoxic agent is contraindicated.' });
  } else if (abxGfrImpaired()) {
    lines.push({ tone: 'amber', text: 'Mild renal impairment (eGFR ' + ABX.gfr + ' mL/min) has been accounted for in the current dosing. eGFR should be rechecked at 72 hours, as acute illness can cause further transient deterioration.' });
  }

  // ── Clinical direction ───────────────────────────────────────────────────
  var conclusion;
  if (abxWorsening()) {
    conclusion = 'Treat as treatment failure until an alternative explanation is established. Escalation of antimicrobial spectrum, repeat cultures prior to any agent change, and urgent infectious diseases input are all indicated.';
  } else if (abxImproving() && (abxCultureSensitive() || abxCultureNoGrowth())) {
    conclusion = 'IV-to-oral de-escalation is supported on both clinical and microbiological grounds. Step-down should be initiated at the next prescriber review — continued IV therapy beyond this point is not consistent with stewardship principles.';
  } else if (abxImproving() && abxCulturePending()) {
    conclusion = 'Clinical step-down criteria are met. De-escalation should be planned now and executed once culture data is available — a pending result is not in itself a reason to delay in a clinically improving patient.';
  } else if (abxImproving() && abxCultureResistant()) {
    conclusion = 'Clinical improvement is evident but the identified organism requires continued broad-spectrum IV cover. Stewardship focus should shift to duration optimisation and selection of the narrowest effective agent based on susceptibility data.';
  } else {
    conclusion = 'Continue current therapy and reassess formally in 48 hours. Use the interval to obtain or review culture data, recheck inflammatory markers, and document the clinical trajectory criteria against which the next decision will be made.';
  }

  var parasEl = document.getElementById('abx-ci-paragraphs');
  if (parasEl) {
    parasEl.innerHTML = lines.map(function(l) {
      return '<div class="ci-line ci-line-' + l.tone + '">' + l.text + '</div>';
    }).join('');
  }
  var concTextEl = document.getElementById('abx-ci-conclusion-text');
  if (concTextEl) concTextEl.textContent = conclusion;
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

