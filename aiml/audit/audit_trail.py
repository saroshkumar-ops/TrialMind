"""
audit/audit_trail.py
---------------------
Hash-chained, tamper-evident audit trail for TrialMind.

Every decision, escalation, and human review action is persisted as a
signed entry where each entry's SHA-256 hash incorporates the previous
entry's hash — forming a chain that can be verified at any time.

Storage: aiml/data/audit_trail.json  (append-only JSON array)

Public API:
  log_decision(action, patient_id, actor, payload) -> str  (entry id)
  get_audit_trail()                                 -> list[dict]
  verify_chain()                                    -> (bool, str)
"""

from __future__ import annotations

import hashlib
import json
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Tuple

from utils.logger import get_logger

logger = get_logger(__name__)

# ---------------------------------------------------------------------------
# Storage path
# ---------------------------------------------------------------------------
_DATA_DIR = Path(__file__).resolve().parent.parent / "data"
_TRAIL_PATH = _DATA_DIR / "audit_trail.json"

# Thread-safety: writes use a per-process lock (sufficient for uvicorn single-worker dev)
_LOCK = threading.Lock()

# Sentinel hash for the genesis (first) entry
_GENESIS_HASH = "0" * 64


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _sha256(data: str) -> str:
    return hashlib.sha256(data.encode("utf-8")).hexdigest()


def _load_raw() -> List[Dict[str, Any]]:
    """Load the existing trail from disk, returning [] if absent or corrupt."""
    if not _TRAIL_PATH.exists():
        return []
    try:
        with open(_TRAIL_PATH, "r", encoding="utf-8") as fh:
            data = json.load(fh)
        return data if isinstance(data, list) else []
    except (json.JSONDecodeError, OSError) as exc:
        logger.error("Audit trail read error (treating as empty): %s", exc)
        return []


def _save_raw(entries: List[Dict[str, Any]]) -> None:
    _DATA_DIR.mkdir(parents=True, exist_ok=True)
    with open(_TRAIL_PATH, "w", encoding="utf-8") as fh:
        json.dump(entries, fh, indent=2)


def _compute_entry_hash(entry: Dict[str, Any]) -> str:
    """
    Hash = SHA-256 of a canonical JSON string that excludes the 'hash' field itself.
    Fields included: id, timestamp, action, patient_id, actor, payload, prev_hash
    """
    canonical = json.dumps(
        {k: v for k, v in entry.items() if k != "hash"},
        sort_keys=True,
        separators=(",", ":"),
    )
    return _sha256(canonical)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def log_decision(
    action: str,
    patient_id: str,
    actor: str,
    payload: Dict[str, Any],
) -> str:
    """
    Append a new audit entry to the chain.

    Args:
        action:     Short label, e.g. "SCREENING", "ESCALATION", "HITL_APPROVE".
        patient_id: Identifier of the patient this action concerns.
        actor:      Who or what performed the action, e.g. "screening_agent", "dr.smith".
        payload:    Arbitrary detail dict (decision, confidence, reason, etc.).

    Returns:
        The unique entry id (UUID4 string).
    """
    with _LOCK:
        entries = _load_raw()
        prev_hash = entries[-1]["hash"] if entries else _GENESIS_HASH

        entry: Dict[str, Any] = {
            "id": str(uuid.uuid4()),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "action": action,
            "patient_id": patient_id,
            "actor": actor,
            "payload": payload,
            "prev_hash": prev_hash,
            "hash": "",  # placeholder — filled below
        }
        entry["hash"] = _compute_entry_hash(entry)

        entries.append(entry)
        _save_raw(entries)

        logger.info(
            "Audit entry logged: id=%s action=%s patient=%s",
            entry["id"],
            action,
            patient_id,
        )
        return entry["id"]


def get_audit_trail() -> List[Dict[str, Any]]:
    """Return the full audit trail (newest first for display convenience)."""
    with _LOCK:
        return list(reversed(_load_raw()))


def verify_chain() -> Tuple[bool, str]:
    """
    Walk every entry and confirm hashes form a valid chain.

    Returns:
        (True,  "Chain is valid. N entries verified.")
        (False, "Chain broken at entry <id>: <reason>")
    """
    with _LOCK:
        entries = _load_raw()

    if not entries:
        return True, "Chain is valid. 0 entries."

    expected_prev = _GENESIS_HASH
    for idx, entry in enumerate(entries):
        # Verify prev_hash linkage
        if entry.get("prev_hash") != expected_prev:
            return (
                False,
                f"Chain broken at index {idx} (id={entry.get('id')}): "
                f"prev_hash mismatch (expected {expected_prev[:12]}…, "
                f"got {str(entry.get('prev_hash', ''))[:12]}…)",
            )

        # Verify self-hash
        recomputed = _compute_entry_hash(entry)
        if recomputed != entry.get("hash"):
            return (
                False,
                f"Chain broken at index {idx} (id={entry.get('id')}): "
                f"entry hash mismatch — record may have been tampered with.",
            )

        expected_prev = entry["hash"]

    return True, f"Chain is valid. {len(entries)} entries verified."
