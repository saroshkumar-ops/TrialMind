const FEATURES = [
  {
    id: "explainability",
    title: "Glass-Box Explainability",
    description:
      "Every agent decision comes with cited evidence, source references, and a confidence score. No black boxes — clinicians see exactly why the AI made each call.",
    icon: "🔍",
  },
  {
    id: "fairness",
    title: "Built-in Fairness Auditing",
    description:
      "The Screening Agent compares your recruited cohort's demographics against the target population and flags underrepresentation automatically.",
    icon: "⚖️",
  },
  {
    id: "audit",
    title: "Compliance-Grade Audit Trail",
    description:
      "Every agent action is logged with a timestamp and hash-chained for tamper evidence. Designed for FDA 21 CFR Part 11 and ICH E6 GCP out of the box.",
    icon: "📋",
  },
  {
    id: "fhir",
    title: "FHIR R4 Native",
    description:
      "Built on HL7 FHIR R4 via HAPI FHIR. Accepts Synthea synthetic data or real EHR through standard FHIR APIs — HIPAA-safe by design.",
    icon: "🏥",
  },
  {
    id: "hitl",
    title: "Human-in-the-Loop by Design",
    description:
      "AI recommendations never act autonomously. Clinicians approve, override, or escalate every decision — and that action is written into the audit trail.",
    icon: "👨‍⚕️",
  },
  {
    id: "synthesis",
    title: "Cross-Agent Synthesis",
    description:
      "When multiple agents flag the same patient — a biomarker spike AND high dropout risk — the orchestrator auto-escalates before it becomes a problem.",
    icon: "🔗",
  },
];

export default function FeaturesSection() {
  return (
    <section id="features" className="py-20 px-6 bg-gray-50">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Why TrialMind</h2>
          <p className="text-gray-500 text-base max-w-xl mx-auto">
            The only clinical trial AI a hospital could actually deploy —
            explainable, fair, and compliance-ready from the ground up.
          </p>
        </div>

        {/* Feature grid */}
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 list-none">
          {FEATURES.map((feature) => (
            <li key={feature.id} className="bg-white border border-gray-200 rounded-xl p-6 hover:border-teal-300 hover:shadow-sm transition-all">
              <div className="text-2xl mb-4">{feature.icon}</div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">{feature.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{feature.description}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}