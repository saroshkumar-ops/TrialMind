"""
data_layer
----------
Python now owns the data layer (Java backend was removed). This package provides
a lightweight SQLite-backed store for patients and trials, seeded from the
Synthea FHIR bundles + the adherence overlay at first startup.

Modules:
  db.py          → SQLite connection + schema bootstrap
  registry.py    → patient registry: seed cohort, list/get/add, feature assembly
  trial_store.py → trial + extracted-criteria store (+ default T2DM trial)
"""
