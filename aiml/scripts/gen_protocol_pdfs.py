"""
scripts/gen_protocol_pdfs.py
----------------------------
Generate 3 demo protocol PDFs (one per seeded trial) so judges can drag-and-drop a
protocol and watch the enrollment form change. Output -> data/seed/protocols/.

Usage (from aiml/):  python scripts/gen_protocol_pdfs.py
Requires fpdf2 (already installed).
"""

from pathlib import Path

from fpdf import FPDF

OUT = Path(__file__).resolve().parent.parent.parent / "data" / "seed" / "protocols"

PROTOCOLS = [
    {
        "file": "t2dm_protocol.pdf",
        "title": "T2DM Glycemic Control Trial - Protocol Summary",
        "body": [
            "Phase III randomized, double-blind trial of an investigational once-daily oral",
            "agent for glycemic control in adults with type 2 diabetes mellitus.",
            "",
            "Inclusion criteria:",
            "Age 18-75",
            "HbA1c 6.5-9.0",
            "BMI 25-40",
            "",
            "Exclusion criteria:",
            "Chronic kidney disease",
            "Pregnancy",
        ],
    },
    {
        "file": "htn_protocol.pdf",
        "title": "Resistant Hypertension CV Outcomes Trial - Protocol Summary",
        "body": [
            "Phase III trial of a novel antihypertensive agent in adults with resistant",
            "hypertension despite three background therapies.",
            "",
            "Inclusion criteria:",
            "Age 40-80",
            "Systolic BP 140-180",
            "Diastolic BP 90-110",
            "",
            "Exclusion criteria:",
            "Prior stroke",
            "Pregnancy",
        ],
    },
    {
        "file": "copd_protocol.pdf",
        "title": "COPD Maintenance Inhaler Trial - Protocol Summary",
        "body": [
            "Phase III trial of a dual long-acting bronchodilator maintenance inhaler in",
            "patients with moderate-to-severe chronic obstructive pulmonary disease.",
            "",
            "Inclusion criteria:",
            "Age 40-75",
            "FEV1 30-70",
            "Smoking history",
            "",
            "Exclusion criteria:",
            "Active respiratory infection",
        ],
    },
]


def build(spec: dict) -> None:
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 14)
    pdf.multi_cell(0, 9, spec["title"])
    pdf.ln(2)
    pdf.set_font("Helvetica", "", 11)
    for line in spec["body"]:
        if line.endswith("criteria:"):
            pdf.set_font("Helvetica", "B", 11)
            pdf.multi_cell(0, 7, line)
            pdf.set_font("Helvetica", "", 11)
        else:
            pdf.multi_cell(0, 7, line if line else " ")
    OUT.mkdir(parents=True, exist_ok=True)
    pdf.output(str(OUT / spec["file"]))
    print(f"wrote {OUT / spec['file']}")


if __name__ == "__main__":
    for s in PROTOCOLS:
        build(s)
