# Data

- `synthea/` — cloned Synthea generator (gitignored, regenerate locally).
- `seed/fhir/` — curated FHIR R4 bundles the backend ingests via HAPI FHIR (committed, keep small).

## Regenerate
```bash
git clone https://github.com/synthetichealth/synthea.git data/synthea
cd data/synthea && ./run_synthea -p 50 Massachusetts
cp output/fhir/*.json ../seed/fhir/
```
