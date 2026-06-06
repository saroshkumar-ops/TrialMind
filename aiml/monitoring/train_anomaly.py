"""
monitoring/train_anomaly.py
---------------------------
Train + persist the safety anomaly model.

Usage (from the aiml/ dir):
    python -m monitoring.train_anomaly      # preferred
    python monitoring/train_anomaly.py      # also works (sys.path bootstrap below)
    # writes -> aiml/models/anomaly_model.pkl
"""

import sys
from pathlib import Path

# Allow running as a bare script (python monitoring/train_anomaly.py) by putting
# the aiml/ root on sys.path.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from monitoring.vitals_anomaly import train

if __name__ == "__main__":
    info = train()
    print(f"Anomaly model trained: {info}")
