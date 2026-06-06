const STEPS = [
  {
    step: "01",
    title: "Upload Your Trial Protocol",
    description:
      "Drop in a real trial protocol PDF. Our AI auto-extracts inclusion and exclusion criteria and converts them into a live eligibility rules engine — no manual data entry needed.",
    agent: "Protocol Ingestion",
    color: "bg-teal-100 text-teal-700",
  },
  {
    step: "02",
    title: "Screen Participants Automatically",
    description:
      "The Screening Agent reads patient EHR records and matches them against your criteria. Every decision comes with cited evidence so your team can verify each result.",
    agent: "Screening Agent",
    color: "bg-blue-100 text-blue-700",
  },
  {
    step: "03",
    title: "Predict Dropout & Adverse Risk",
    description:
      "The Risk Prediction Agent scores each participant's likelihood of dropping out or having an adverse event, with a plain-English explanation of the driving factors.",
    agent: "Risk Agent",
    color: "bg-red-100 text-red-700",
  },
  {
    step: "04",
    title: "Monitor Adherence in Real Time",
    description:
      "The Adherence Agent tracks dose timings, flags missed visits, and raises protocol deviation alerts the moment they happen — not at the next review meeting.",
    agent: "Adherence Agent",
    color: "bg-amber-100 text-amber-700",
  },
  {
    step: "05",
    title: "Clinician Approves, Overrides, or Escalates",
    description:
      "Every AI recommendation goes through a human-in-the-loop gate. When two agents flag the same patient, the system auto-escalates to a clinician for review.",
    agent: "Human-in-the-Loop",
    color: "bg-purple-100 text-purple-700",
  },
];

export default function HowItWorksSection() {
  return (
    <section id="how-it-works" className="py-20 px-6 bg-white">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">How It Works</h2>
          <p className="text-gray-500 text-base max-w-xl mx-auto">
            Five intelligent agents work together under a single orchestrator —
            each one specialised, each one explainable.
          </p>
        </div>

        {/* Steps */}
        <ol className="relative border-l-2 border-gray-100 space-y-10 list-none pl-8">
          {STEPS.map((item) => (
            <li key={item.step} className="relative">
              {/* Step number dot */}
              <div className="absolute -left-11 top-0 w-8 h-8 rounded-full bg-gray-900 text-white text-xs font-bold flex items-center justify-center">
                {item.step}
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-xl p-6">
                {/* Agent badge */}
                <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full mb-3 ${item.color}`}>
                  {item.agent}
                </span>
                <h3 className="text-base font-semibold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{item.description}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}