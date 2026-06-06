"use client";
import Link from "next/link";

export default function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-teal-600 rounded-lg flex items-center justify-center">
            <span className="text-white text-sm font-bold">T</span>
          </div>
          <div>
            <span className="font-semibold text-gray-900 text-base">TrialMind</span>
            <span className="hidden sm:inline text-xs text-gray-400 ml-2">AI Co-Pilot</span>
          </div>
        </Link>

        {/* Nav links */}
        <ul className="hidden md:flex items-center gap-8 list-none">
          <li><a href="#how-it-works" className="text-sm text-gray-600 hover:text-teal-600 transition-colors">How It Works</a></li>
          <li><a href="#features" className="text-sm text-gray-600 hover:text-teal-600 transition-colors">Features</a></li>
        </ul>

        {/* CTA */}
        <Link href="/dashboard">
          <button className="bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            Go to Dashboard
          </button>
        </Link>
      </div>
    </nav>
  );
}