import Link from "next/link";

export default function HeroSection() {
  return (
    <section className="pt-32 pb-20 px-6 bg-gradient-to-b from-teal-50 to-white">
      <div className="max-w-4xl mx-auto text-center">

        {/* Eyebrow */}
        <span className="inline-block bg-teal-100 text-teal-700 text-xs font-semibold px-3 py-1 rounded-full mb-6 tracking-wide uppercase">
          Explainable AI · HIPAA-Safe · GCP Compliant
        </span>

        {/* Headline */}
        <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 leading-tight mb-6">
          The AI Co-Pilot That <br />
          <span className="text-teal-600">Runs Your Clinical Trial</span>
        </h1>

        {/* Subtext */}
        <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-10 leading-relaxed">
          TrialMind screens participants, monitors adherence, and predicts patient
          risk — and shows its reasoning for every decision so your team can
          trust, approve, and audit it.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-14">
          <Link href="/dashboard">
            <button className="bg-teal-600 hover:bg-teal-700 text-white font-semibold px-8 py-3 rounded-lg transition-colors text-sm w-full sm:w-auto">
              Get Started
            </button>
          </Link>
          <a href="#how-it-works">
            <button className="border border-gray-300 hover:border-teal-400 text-gray-700 hover:text-teal-600 font-semibold px-8 py-3 rounded-lg transition-colors text-sm w-full sm:w-auto">
              See How It Works
            </button>
          </a>
        </div>

        {/* Trust badges */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          {["HIPAA Safe", "21 CFR Part 11", "ICH E6 GCP", "Synthea FHIR R4"].map((badge) => (
            <span key={badge} className="bg-white border border-gray-200 text-gray-500 text-xs font-medium px-3 py-1.5 rounded-full">
              {badge}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}