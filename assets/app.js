(function () {
  "use strict";
  const engine = window.EchoMoralRecruiting;
  if (!engine) return;
  let lastRes = null;
  const el = (id) => document.getElementById(id);
  const esc = (s) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  function readPayload() {
    return {
      role_title: el("roleTitle").value,
      candidate_alias: el("candAlias").value,
      criteria_text: el("criteriaText").value,
      screening_notes: el("notesText").value,
      score_skills: Number(el("scoreSkills").value || 0),
      score_experience: Number(el("scoreExp").value || 0),
      score_work_sample: Number(el("scoreWork").value || 0),
      score_domain_fit: Number(el("scoreDom").value || 0),
      blind_pii_masked: el("chkBlind").checked,
      candidate_ai_notice: el("chkNotice").checked,
      human_in_the_loop: el("chkHitl").checked,
      recruiter_ai_literacy: el("chkLit").checked,
      dsgvo_retention_6m: el("chkDsgvo").checked,
    };
  }

  function applySample(s) {
    el("roleTitle").value = s.role_title;
    el("candAlias").value = s.candidate_alias;
    el("criteriaText").value = s.criteria_text;
    el("notesText").value = s.screening_notes;
    el("scoreSkills").value = s.score_skills;
    el("scoreExp").value = s.score_experience;
    el("scoreWork").value = s.score_work_sample;
    el("scoreDom").value = s.score_domain_fit;
    el("chkBlind").checked = Boolean(s.blind_pii_masked);
    el("chkNotice").checked = Boolean(s.candidate_ai_notice);
    el("chkHitl").checked = Boolean(s.human_in_the_loop);
    el("chkLit").checked = Boolean(s.recruiter_ai_literacy);
    el("chkDsgvo").checked = Boolean(s.dsgvo_retention_6m);
    runCheck();
  }

  function runCheck() {
    const res = engine.evaluateScreeningRubric(readPayload());
    lastRes = res;
    el("resultCard").classList.remove("hidden");
    el("scoreKpi").textContent = `${res.weighted_score} / 100`;
    el("compKpi").textContent = `${res.compliance_percent} %`;
    el("hitsKpi").textContent = res.proxy_hits.length ? res.proxy_hits.join(", ") : "Keine (0)";
    el("aliasKpi").textContent = res.candidate_alias;
    el("resultHeadline").textContent = res.compliant ? `${res.role_title}: AGG & EU AI Act konform` : `${res.role_title}: ${res.summary.fail} Compliance-Mängel`;
    el("checksBody").innerHTML = res.checks.map((c) => {
      const cls = c.status === "PASS" ? "badge-pass" : c.status === "WARN" ? "badge-warn" : "badge-fail";
      return `<tr><td><code>${esc(c.id)}</code></td><td><strong>${esc(c.law)}</strong></td><td><span class="badge ${cls}">${esc(c.status)}</span></td><td><strong>${esc(c.field)}</strong><div class="muted">${esc(c.detail)}</div></td></tr>`;
    }).join("");
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (!el("runCheckBtn")) return;
    el("runCheckBtn").addEventListener("click", runCheck);
    el("sampleBadBtn").addEventListener("click", () => applySample(engine.SAMPLES.biased_uncompliant));
    el("sampleGoodBtn").addEventListener("click", () => applySample(engine.SAMPLES.compliant_blind_rubric));
    el("sampleFinBtn").addEventListener("click", () => applySample(engine.SAMPLES.senior_engineer_pass));
    el("copyMdBtn").addEventListener("click", async () => {
      if (!lastRes || !navigator.clipboard) return;
      await navigator.clipboard.writeText(engine.formatAuditReportMarkdown(lastRes));
      el("copyMdBtn").textContent = "Protokoll kopiert!";
      setTimeout(() => (el("copyMdBtn").textContent = "Markdown-Protokoll kopieren"), 1800);
    });
    el("dlJsonBtn").addEventListener("click", () => {
      if (!lastRes) return;
      const blob = new Blob([engine.formatAuditReportJson(lastRes)], { type: "application/json" });
      const u = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = u;
      a.download = "echomoral_recruiting_audit.json";
      a.click();
      URL.revokeObjectURL(u);
    });
    applySample(engine.SAMPLES.biased_uncompliant);
  });
})();
