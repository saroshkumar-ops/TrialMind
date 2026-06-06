# Why TrialMind — The India Problem (pitch + sources)

Use this for the "why we built this" slide. Every pain point below is documented
**and** maps onto a feature we already built — that's the story judges buy.

---

## The opportunity (opening slide)

- India's clinical trials market: **~$1.4–2.0B in 2024 → ~$4.3B by 2033–34** (CAGR ~8–9%).
- India is now a global trial hub: **60% of its first-in-human Phase I trials (1,641) ran in
  2019–2024.**
- The **New Drugs & Clinical Trials Rules 2019** cut approval timelines **30–40%**.

> A fast-growing, newly-deregulated market that *needs* better tooling.

Sources: [Invest India](https://www.investindia.gov.in/team-india-blogs/indias-clinical-trials-surge-emerging-global-innovation-powerhouse),
[IMARC](https://www.imarcgroup.com/india-clinical-trials-market),
[Grand View Research](https://www.grandviewresearch.com/industry-analysis/india-clinical-trials-market)

---

## Pain points → the feature that kills each one

### 1. Dropout is dominated by "lost to follow-up" (India-specific)
**~90% of dropouts in Indian trials are lost-to-follow-up**, driven by changed contact numbers,
inability to reach patients, and **migration / geographic mobility** — plus fear of procedures
(47%) and side effects (44%).
→ **Our Risk + Adherence agents.** The dropout model uses **travel distance, missed visits, and
engagement gaps** — direct proxies for the mobility/follow-up problem. Flag at-risk patients
early so coordinators intervene before they vanish.

Sources: [PMC five-year audit](https://pmc.ncbi.nlm.nih.gov/articles/PMC7342334/),
[PMC recruitment & retention](https://pmc.ncbi.nlm.nih.gov/articles/PMC7342339/)

### 2. Protocol deviations & eligibility breaches caught too late
Without proactive checks, **inclusion/exclusion breaches and protocol violations slip through and
are only caught later during manual data cleaning** — when data may already be compromised.
→ **Our Adherence agent's real-time deviation alerts + automated inclusion/exclusion screening**
catch these *at entry*, not months later. "Shift-left monitoring."

Sources: [Slope](https://www.slopeclinical.com/blog/3-ways-to-fine-tune-your-clinical-trial-monitoring-strategy-to-minimize-protocol-deviations),
[CCRPS data management](https://ccrps.org/clinical-research-blog/challenges-in-clinical-trial-data-management)

### 3. Recruitment is slow and complex
Barriers: **complex study designs, low patient education, ethics-approval delays (median ~59.5
days)**, and **language barriers** complicating consent.
→ **Our automated screening + plain-language consent generation** attack complexity and the
education gap directly.

Sources: [Language Connections](https://www.languageconnections.com/clinical-trials-in-india-what-are-the-challenges/),
[ProRelix](https://prorelixresearch.com/global-clinical-trials-2025-regulatory-guides/)

### 4. Diversity must be designed in from the start
India's value is its diverse genetic pool, and 2025 guidance says **recruitment diversity should
be built in from the start.**
→ **Our fairness/diversity panel** flags underrepresentation *during* screening, not after.

Sources: [ProRelix](https://prorelixresearch.com/global-clinical-trials-2025-regulatory-guides/),
[Invest India](https://www.investindia.gov.in/team-india-blogs/indias-clinical-trials-surge-emerging-global-innovation-powerhouse)

### 5. Compliance under the post-2019 regime
The new rules raised the bar on transparency and data integrity.
→ **Our hash-chained audit trail + human-in-the-loop approval** = the GCP / 21-CFR-Part-11 story.

---

## The one-liner for judges

> "India's trial market is doubling to $4B+, but it's bottlenecked by the same problems
> everywhere — except here, **90% of dropouts are lost-to-follow-up from patient mobility**, and
> **eligibility/protocol violations get caught months too late in manual review**. TrialMind
> predicts those dropouts early, enforces eligibility at entry, flags deviations in real time,
> builds diversity in from day one — every decision explainable and audit-logged for the
> post-2019 regulatory regime."
