/**
 * EchoMoral Fair Recruiting (by VeriTakt Collective) — P5 Client-Side Screening & AGG/AI-Act Engine
 * Scans job rubrics for AGG § 1/7 bias proxies, validates EU AI Act Anhang III + DSGVO Art. 22 guardrails,
 * and computes weighted blind-screening scores (100 % local in browser).
 */

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.EchoMoralRecruiting = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const AGG_BIAS_TERMS = [
    "jung", "junge", "junges", "digital native", "muttersprachler", "muttersprachlich",
    "native speaker", "männlich", "weiblich", "geschlecht", "alter", "geburtsdatum",
    "familienstand", "kinderwunsch", "schwanger", "religion", "konfession", "herkunft",
    "staatsangehörigkeit", "gesundheitszustand", "schwerbehinderung",
  ];

  function scanAggProxies(text) {
    const lower = String(text || "").toLowerCase();
    const hits = [];
    for (const term of AGG_BIAS_TERMS) {
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(`(^|[^a-zäöüß])${escaped}([^a-zäöüß]|$)`, "i");
      if (re.test(lower)) hits.push(term);
    }
    return hits;
  }

  function clamp100(n) {
    const v = Number(n);
    if (!Number.isFinite(v)) return 0;
    return Math.max(0, Math.min(100, v));
  }

  function evaluateScreeningRubric(raw) {
    const d = raw || {};
    const roleTitle = String(d.role_title || "Unbenannte Stelle").trim();
    const rubricText = `${roleTitle}\n${d.criteria_text || ""}\n${d.screening_notes || ""}`;
    const candidateAlias = String(d.candidate_alias || "Kandidat #01").trim();

    const sSkills = clamp100(d.score_skills);
    const sExp = clamp100(d.score_experience);
    const sWork = clamp100(d.score_work_sample);
    const sDomain = clamp100(d.score_domain_fit);

    const wSkills = Math.max(0, Number(d.weight_skills ?? 40));
    const wExp = Math.max(0, Number(d.weight_experience ?? 20));
    const wWork = Math.max(0, Number(d.weight_work_sample ?? 25));
    const wDomain = Math.max(0, Number(d.weight_domain_fit ?? 15));
    const totalW = wSkills + wExp + wWork + wDomain || 100;

    const weightedScore = Math.round(
      ((sSkills * wSkills + sExp * wExp + sWork * wWork + sDomain * wDomain) / totalW) * 10
    ) / 10;

    const checks = [];
    const add = (id, law, status, field, detail) => checks.push({ id, law, status, field, detail });

    // AGG-01: Bias & Proxy Scanner
    const proxyHits = scanAggProxies(rubricText);
    if (proxyHits.length === 0) {
      add("AGG-01", "AGG § 1 / § 7", "PASS", "Stellen- & Bewertungs-Text", "Keine unzulässigen AGG-Merkmale oder Bias-Proxy-Begriffe erkannt.");
    } else {
      add("AGG-01", "AGG § 1 / § 7", "FAIL", "AGG-Risikobegriffe gefunden", `Gefundene Risiko-Begriffe: ${proxyHits.join(", ")} — durch rein tätigkeitsbezogene Kompetenzkriterien ersetzen.`);
    }

    // BLIND-01: Blind PII Masking
    if (d.blind_pii_masked) {
      add("BLIND-01", "AGG / Best Practice", "PASS", "Blinde Vorauswahl (PII maskiert)", "Name, Foto, Geburtsdatum und Geschlecht im Erstscreening ausgeblendet.");
    } else {
      add("BLIND-01", "AGG / Best Practice", "WARN", "Keine blinde Vorauswahl", "Empfehlung: Name/Foto/Alter vor dem Rubrik-Scoring verbergen.");
    }

    // AIA-REC-01: EU AI Act Anhang III Transparenz
    if (d.candidate_ai_notice) {
      add("AIA-REC-01", "EU AI Act Art. 26 / 50", "PASS", "Bewerber-Transparenzhinweis", "Kandidaten wurden vorab über KI-/Struktur-Triage informiert.");
    } else {
      add("AIA-REC-01", "EU AI Act Art. 26 / 50", "FAIL", "Transparenzhinweis fehlt", "Bei KI-Unterstützung im Recruiting (Anhang III Hochrisiko) ist eine Vorab-Information der Bewerbenden Pflicht.");
    }

    // AIA-REC-02: Human-in-the-Loop & DSGVO Art. 22
    if (d.human_in_the_loop) {
      add("AIA-REC-02", "EU AI Act Art. 14 / DSGVO Art. 22", "PASS", "Menschliche Letztentscheidung", "Keine vollautomatisierte Absage; Recruiter/Fachbereich entscheidet final.");
    } else {
      add("AIA-REC-02", "EU AI Act Art. 14 / DSGVO Art. 22", "FAIL", "Human-in-the-Loop fehlt", "Vollautomatisierte Recruiting-Absagen verstoßen gegen DSGVO Art. 22 & EU AI Act Art. 14.");
    }

    // AIA-REC-03: Art. 4 AI Literacy
    if (d.recruiter_ai_literacy) {
      add("AIA-REC-03", "EU AI Act Art. 4", "PASS", "Recruiter AI-Literacy", "Recruiting-Team über Grenzen & Verzerrungen von KI-Tools geschult.");
    } else {
      add("AIA-REC-03", "EU AI Act Art. 4", "FAIL", "AI-Literacy-Nachweis fehlt", "Seit 02.02.2025 müssen Recruiting-Teams nachweisbar KI-Kompetenz besitzen.");
    }

    // DSGVO-01: 6-Monats-Löschfrist
    if (d.dsgvo_retention_6m) {
      add("DSGVO-01", "DSGVO Art. 5 / AGG § 15", "PASS", "6-Monats-Löschkonzept", "Bewerberdaten-Löschfrist nach Abschluss des Verfahrens dokumentiert.");
    } else {
      add("DSGVO-01", "DSGVO Art. 5 / AGG § 15", "FAIL", "Löschfrist nicht hinterlegt", "Ohne dokumentierte 6-Monats-Frist (AGG-Verteidigung / DSGVO) drohen Bußgelder.");
    }

    const summary = {
      pass: checks.filter((c) => c.status === "PASS").length,
      warn: checks.filter((c) => c.status === "WARN").length,
      fail: checks.filter((c) => c.status === "FAIL").length,
    };
    const compliancePercent = Math.round(((summary.pass + summary.warn * 0.5) / checks.length) * 100);

    return {
      compliant: summary.fail === 0,
      role_title: roleTitle,
      candidate_alias: candidateAlias,
      weighted_score: weightedScore,
      compliance_percent: compliancePercent,
      proxy_hits: proxyHits,
      summary,
      checks,
    };
  }

  function formatAuditReportJson(res) {
    return JSON.stringify({ tool: "EchoMoral Fair Recruiting & AGG/AI-Act Audit", provider: "EchoMoral by VeriTakt Collective", checked_at: new Date().toISOString(), ...res }, null, 2);
  }

  function formatAuditReportMarkdown(res) {
    const lines = [
      `# EchoMoral Fair-Recruiting Scorecard — ${res.role_title}`,
      ``,
      `- **Kandidat (Alias):** ${res.candidate_alias} · **Objektiver Score:** **${res.weighted_score} / 100**`,
      `- **Compliance Status:** **${res.compliant ? "PASS" : "FAIL"}** (${res.compliance_percent} % · FAIL ${res.summary.fail})`,
      ``,
      `| ID | Rechtsrahmen | Status | Befund |`,
      `| :--- | :--- | :--- | :--- |`,
    ];
    for (const c of res.checks) lines.push(`| ${c.id} | ${c.law} | **${c.status}** | ${String(c.detail).replace(/\|/g, "/")} |`);
    lines.push(``);
    lines.push(`*100 % lokal im Browser erstellt ohne Bewerberdaten-Upload via EchoMoral (by VeriTakt Collective).*`);
    return lines.join("\n");
  }

  const SAMPLES = {
    biased_uncompliant: {
      role_title: "Junior Sales Digital Native (m/w)",
      candidate_alias: "Kandidat A",
      criteria_text: "Wir suchen ein junges Verkaufstalent, Muttersprachler Deutsch, ungebunden ohne Familienstand-Einschränkung.",
      screening_notes: "Automatisches Absage-Scoring aktiv.",
      blind_pii_masked: false,
      candidate_ai_notice: false,
      human_in_the_loop: false,
      recruiter_ai_literacy: false,
      dsgvo_retention_6m: false,
      score_skills: 78,
      score_experience: 65,
      score_work_sample: 82,
      score_domain_fit: 70,
    },
    compliant_blind_rubric: {
      role_title: "Senior Backend Engineer (Go / PostgreSQL)",
      candidate_alias: "Blind-ID #407",
      criteria_text: "Nachgewiesene Systemarchitektur-Praxis, Code-Qualität in der Arbeitsprobe und strukturierte Fehleranalyse.",
      screening_notes: "Bewertet anhand verdeckter Arbeitsprobe durch zwei Fachprüfer.",
      blind_pii_masked: true,
      candidate_ai_notice: true,
      human_in_the_loop: true,
      recruiter_ai_literacy: true,
      dsgvo_retention_6m: true,
      score_skills: 92,
      score_experience: 88,
      score_work_sample: 95,
      score_domain_fit: 85,
    },
    senior_engineer_pass: {
      role_title: "Finance & DATEV Operations Lead",
      candidate_alias: "Blind-ID #512",
      criteria_text: "EN 16931 E-Rechnungs-Kenntnisse, DATEV-Kontierungslogik und strukturierte Prozessdokumentation.",
      screening_notes: "Menschliche Zweitprüfung durch CFO vorgesehen.",
      blind_pii_masked: true,
      candidate_ai_notice: true,
      human_in_the_loop: true,
      recruiter_ai_literacy: true,
      dsgvo_retention_6m: true,
      score_skills: 86,
      score_experience: 90,
      score_work_sample: 84,
      score_domain_fit: 92,
    },
  };

  return { evaluateScreeningRubric, scanAggProxies, formatAuditReportJson, formatAuditReportMarkdown, SAMPLES };
});
