"""
gen_report.py — one-page TrialMind project report (A4, single page).
Run from aiml/ with the venv:  python scripts/gen_report.py
Output: ~/Desktop/TrialMind_OnePager.pdf
"""

from pathlib import Path
from fpdf import FPDF

OUT = Path.home() / "Desktop" / "TrialMind_OnePager.pdf"

# ---- EDIT THESE THREE LINES with your real details ----
TRACK = "Data / AI-ML"
TEAM = "Sarosh, [Teammate 2], [Teammate 3], [Teammate 4]"
UNIVERSITY = "[Your University]"
# -------------------------------------------------------

# Palette
INK = (26, 32, 46)
MUTED = (95, 105, 125)
ACCENT = (13, 124, 128)      # teal
ACCENT_DK = (9, 78, 84)
LIGHT = (240, 245, 248)
BORDER = (205, 214, 226)
WHITE = (255, 255, 255)

LM, RM, TM = 14, 14, 12
PW = 210
CW = PW - LM - RM            # content width = 182


class Report(FPDF):
    pass


pdf = Report(orientation="P", unit="mm", format="A4")
pdf.set_auto_page_break(False)
pdf.set_margins(LM, TM, RM)
pdf.add_page()


def set_ink(c):
    pdf.set_text_color(*c)


def section(label: str, y: float) -> float:
    pdf.set_xy(LM, y)
    # accent tick
    pdf.set_fill_color(*ACCENT)
    pdf.rect(LM, y + 0.6, 2.2, 3.6, "F")
    pdf.set_xy(LM + 4.5, y)
    pdf.set_font("Helvetica", "B", 10)
    set_ink(ACCENT_DK)
    pdf.cell(0, 5, label.upper())
    # rule
    pdf.set_draw_color(*BORDER)
    pdf.set_line_width(0.2)
    lab_w = pdf.get_string_width(label.upper())
    pdf.line(LM + 6 + lab_w + 3, y + 2.6, PW - RM, y + 2.6)
    return y + 7.4


def body(text: str, y: float, size=9.3, lh=4.7, color=INK, align="J") -> float:
    pdf.set_xy(LM, y)
    pdf.set_font("Helvetica", "", size)
    set_ink(color)
    pdf.multi_cell(CW, lh, text, align=align)
    return pdf.get_y()


def arrowhead(x, y, direction):
    pdf.set_draw_color(*ACCENT)
    pdf.set_line_width(0.4)
    s = 1.7
    if direction == "right":
        pdf.line(x - s, y - s, x, y); pdf.line(x - s, y + s, x, y)
    elif direction == "left":
        pdf.line(x + s, y - s, x, y); pdf.line(x + s, y + s, x, y)
    elif direction == "down":
        pdf.line(x - s, y - s, x, y); pdf.line(x + s, y - s, x, y)


def hline(x1, x2, y):
    pdf.set_draw_color(*ACCENT)
    pdf.set_line_width(0.4)
    pdf.line(x1, y, x2, y)
    arrowhead(x2 if x2 > x1 else x2, y, "right" if x2 > x1 else "left")


def vline(x, y1, y2):
    pdf.set_draw_color(*ACCENT)
    pdf.set_line_width(0.4)
    pdf.line(x, y1, x, y2)
    arrowhead(x, y2, "down")


def box(x, y, w, h, num, title, sub):
    pdf.set_fill_color(*LIGHT)
    pdf.set_draw_color(*BORDER)
    pdf.set_line_width(0.2)
    pdf.rect(x, y, w, h, "DF")
    pdf.set_fill_color(*ACCENT)
    pdf.rect(x, y, 1.8, h, "F")          # accent spine
    pdf.set_xy(x + 4, y + 3.2)
    pdf.set_font("Helvetica", "B", 8.6)
    set_ink(ACCENT_DK)
    pdf.cell(5, 4, str(num))
    pdf.set_xy(x + 8, y + 3.2)
    set_ink(INK)
    pdf.cell(w - 9, 4, title)
    pdf.set_xy(x + 8, y + 7.6)
    pdf.set_font("Helvetica", "I", 6.9)
    set_ink(MUTED)
    pdf.multi_cell(w - 10, 3.2, sub)


# ============================ HEADER ============================
y = TM
set_ink(INK)
pdf.set_xy(LM, y)
pdf.set_font("Helvetica", "B", 23)
pdf.cell(0, 10, "TrialMind")
# small accent dot after wordmark
tw = pdf.get_string_width("TrialMind")
pdf.set_fill_color(*ACCENT)
pdf.ellipse(LM + tw + 2.4, y + 7.6, 1.8, 1.8, "F")
pdf.set_xy(LM, y + 10.4)
pdf.set_font("Helvetica", "", 10.5)
set_ink(MUTED)
pdf.cell(0, 5, "Explainable AI for the clinical-trial lifecycle - screen, retain, and monitor with an audit trail")
y = y + 17.5
pdf.set_draw_color(*ACCENT)
pdf.set_line_width(0.5)
pdf.line(LM, y, PW - RM, y)

# ============================ META STRIP ============================
y += 3.2
pdf.set_fill_color(*LIGHT)
pdf.set_draw_color(*BORDER)
pdf.set_line_width(0.2)
mb_h = 13.5
pdf.rect(LM, y, CW, mb_h, "DF")


def meta(label, value, x, w, yy):
    pdf.set_xy(x, yy + 2.2)
    pdf.set_font("Helvetica", "B", 7.2)
    set_ink(ACCENT_DK)
    pdf.cell(w, 3.4, label.upper())
    pdf.set_xy(x, yy + 6.0)
    pdf.set_font("Helvetica", "", 9)
    set_ink(INK)
    pdf.multi_cell(w, 3.8, value)


meta("Track", TRACK, LM + 4, 40, y)
meta("University", UNIVERSITY, LM + 50, 60, y)
meta("Team", TEAM, LM + 114, CW - 118, y)
y += mb_h + 3.6

# ============================ PROBLEM ============================
y = section("Problem Statement", y)
y = body(
    "Running a clinical trial in India is slow, manual, and hard to trust. Coordinators screen "
    "candidates by hand against dense eligibility rules; close to nine in ten trial dropouts are "
    "simply lost to follow-up; and protocol deviations often surface too late to act on. Patient "
    "records sit fragmented across systems, and the black-box AI that could help is neither "
    "explainable nor auditable enough for a regulated medical setting. With India's clinical-trials "
    "market projected to approach $4.3B by 2033, the bottleneck is no longer ambition - it is "
    "trustworthy execution.",
    y,
)
y += 3.4

# ============================ SOLUTION + TECH ============================
y = section("Solution Developed", y)
y = body(
    "TrialMind is an explainable AI platform that covers the whole trial lifecycle rather than a "
    "single step. A coordinator uploads a protocol PDF; the system extracts the inclusion and "
    "exclusion criteria and uses them to generate the patient-intake form automatically. It then "
    "screens an entire cohort in seconds, ranking candidates by eligibility and dropout risk. For "
    "any patient a clinician opens, it returns an evidence-backed decision with SHAP feature "
    "attributions and a plain-language rationale. A human-in-the-loop gate lets clinicians approve, "
    "override, or escalate. Approved patients enter active monitoring, where a safety model flags "
    "anomalous vitals and an efficacy model checks treatment response against the protocol's "
    "expected trajectory - and every decision is written to a tamper-evident, hash-chained log.",
    y,
)
y += 1.6
pdf.set_xy(LM, y)
pdf.set_font("Helvetica", "B", 7.6)
set_ink(ACCENT_DK)
pdf.cell(16, 4.4, "STACK")
pdf.set_font("Helvetica", "", 8.7)
set_ink(MUTED)
pdf.set_xy(LM + 16, y)
pdf.multi_cell(
    CW - 16, 4.4,
    "Python  -  FastAPI  -  XGBoost (ROC-AUC 0.87)  -  SHAP  -  Isolation Forest  -  Groq LLM  -  "
    "SQLite  -  Synthea (synthetic FHIR R4)  -  Next.js  -  React  -  Tailwind CSS",
)
y = pdf.get_y() + 3.4

# ============================ ARCHITECTURE ============================
y = section("How It Works", y)
y += 0.5
bw = (CW - 22) / 3          # box width
bh = 17
X1 = LM
X2 = LM + bw + 11
X3 = LM + 2 * (bw + 11)
r1 = y
r2 = y + bh + 14
cy1 = r1 + bh / 2
cy2 = r2 + bh / 2

box(X1, r1, bw, bh, 1, "Protocol PDF", "uploaded by the coordinator")
box(X2, r1, bw, bh, 2, "Criteria extraction", "LLM reads inclusion / exclusion")
box(X3, r1, bw, bh, 3, "Screening + risk", "XGBoost + SHAP, cohort ranked")
box(X3, r2, bw, bh, 4, "Clinician review", "approve / override / escalate")
box(X2, r2, bw, bh, 5, "Active monitoring", "safety + efficacy models")
box(X1, r2, bw, bh, 6, "Audit trail", "tamper-evident hash chain")

hline(X1 + bw + 1.5, X2 - 1.5, cy1)             # 1 -> 2
hline(X2 + bw + 1.5, X3 - 1.5, cy1)             # 2 -> 3
vline(X3 + bw / 2, r1 + bh + 1.5, r2 - 1.5)     # 3 -> 4 (down)
hline(X3 - 1.5, X2 + bw + 1.5, cy2)             # 4 -> 5 (left)
hline(X2 - 1.5, X1 + bw + 1.5, cy2)             # 5 -> 6 (left)
y = r2 + bh + 4.2

# ============================ IMPACT ============================
y = section("Social Relevance & Potential Impact", y)
impacts = [
    ("Faster, fairer screening:", "an entire cohort is screened in seconds, replacing weeks of "
     "manual chart review and surfacing eligible patients a coordinator might otherwise miss."),
    ("Fewer lost patients:", "per-visit dropout risk and live monitoring trigger retention "
     "outreach before a participant disappears - directly attacking the lost-to-follow-up problem."),
    ("Representative trials:", "a built-in fairness audit flags under-represented age and gender "
     "groups, so results generalize to the people who will actually take the drug."),
    ("Usable in medicine:", "glass-box explanations and a tamper-evident log give clinicians and "
     "regulators (e.g. CDSCO) something they can inspect and sign off on - trust, not a black box."),
]
pdf.set_y(y)
pdf.set_left_margin(LM + 5)
for lead, rest in impacts:
    yb = pdf.get_y()
    pdf.set_fill_color(*ACCENT)
    pdf.rect(LM, yb + 1.4, 2, 2, "F")
    pdf.set_xy(LM + 5, yb)
    pdf.set_font("Helvetica", "B", 9.1)
    set_ink(INK)
    pdf.write(4.6, lead + " ")
    pdf.set_font("Helvetica", "", 9.1)
    set_ink((60, 68, 86))
    pdf.write(4.6, rest)
    pdf.ln(5.8)
pdf.set_left_margin(LM)
y = pdf.get_y() + 4.0

# ============================ BY THE NUMBERS ============================
y = section("By the Numbers", y)
y += 0.5
stats = [
    ("0.87", "ROC-AUC of the dropout-risk model"),
    ("~3 s", "to screen the full 222-patient cohort"),
    ("3 -> 1", "disease trials on one platform"),
    ("100%", "of AI decisions in the audit trail"),
]
gap = 5
sw = (CW - gap * (len(stats) - 1)) / len(stats)
sh = 17
for i, (big, small) in enumerate(stats):
    sx = LM + i * (sw + gap)
    pdf.set_fill_color(*LIGHT)
    pdf.set_draw_color(*BORDER)
    pdf.set_line_width(0.2)
    pdf.rect(sx, y, sw, sh, "DF")
    pdf.set_fill_color(*ACCENT)
    pdf.rect(sx, y, sw, 1.4, "F")
    pdf.set_xy(sx, y + 3.0)
    pdf.set_font("Helvetica", "B", 15)
    set_ink(ACCENT_DK)
    pdf.cell(sw, 7, big, align="C")
    pdf.set_xy(sx + 3, y + 10.4)
    pdf.set_font("Helvetica", "", 6.9)
    set_ink(MUTED)
    pdf.multi_cell(sw - 6, 3.1, small, align="C")

# ============================ FOOTER ============================
pdf.set_draw_color(*BORDER)
pdf.set_line_width(0.2)
pdf.line(LM, 287, PW - RM, 287)
pdf.set_xy(LM, 288.2)
pdf.set_font("Helvetica", "I", 7.4)
set_ink(MUTED)
pdf.cell(0, 4, "TrialMind  -  built on synthetic patient data (Synthea FHIR R4)  -  hackathon prototype")

pdf.output(str(OUT))
print(f"wrote {OUT}  (pages: {pdf.page_no()})")
