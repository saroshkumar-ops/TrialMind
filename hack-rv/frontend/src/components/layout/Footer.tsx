export default function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-400 py-12 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-8 mb-10">

          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 bg-teal-500 rounded-md flex items-center justify-center">
                <span className="text-white text-xs font-bold">T</span>
              </div>
              <span className="text-white font-semibold">TrialMind</span>
            </div>
            <p className="text-sm text-gray-500 max-w-xs">
              An explainable AI co-pilot for clinical trials. Built for clinicians, auditors, and trial coordinators.
            </p>
          </div>

          {/* Links */}
          <nav>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Navigate</p>
            <ul className="space-y-2 list-none">
              <li><a href="#how-it-works" className="text-sm hover:text-teal-400 transition-colors">How It Works</a></li>
              <li><a href="#features" className="text-sm hover:text-teal-400 transition-colors">Features</a></li>
              <li><a href="/dashboard" className="text-sm hover:text-teal-400 transition-colors">Dashboard</a></li>
            </ul>
          </nav>

          {/* Compliance */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Compliance</p>
            <ul className="space-y-2 list-none text-sm">
              <li>HIPAA</li>
              <li>21 CFR Part 11</li>
              <li>ICH E6 GCP</li>
              <li>GDPR</li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-gray-800 pt-6 flex flex-col sm:flex-row justify-between items-center gap-3">
          <p className="text-xs text-gray-600">&copy; {new Date().getFullYear()} TrialMind. All rights reserved.</p>
          <p className="text-xs text-gray-600">Powered by Claude · FHIR R4 · Synthea</p>
        </div>
      </div>
    </footer>
  );
}