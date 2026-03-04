# AEP Accelerator — Build Instructions

## What This Is

The AEP (Assurance Evidence Pack) Accelerator is a CLI toolchain that ingests heterogeneous operational logs, validates them against configurable policy packs, signs the output cryptographically, and produces an audit-grade evidence bundle with a human-readable report. The entire pipeline runs in under 60 minutes on standard hardware.

This document is the complete build specification for a 14-day MVP. It covers architecture, schema, every component, testing, packaging, and the demo run that serves as the proof-of-concept for sales conversations.

---

## Architecture Overview

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  Raw Inputs  │───▶│  Compiler   │───▶│  Validator   │───▶│   Signer    │───▶│  Reporter   │
│              │    │             │    │              │    │   /Notary   │    │             │
│ - Event logs │    │ Normalize   │    │ Policy packs │    │ Hash +      │    │ HTML + PDF  │
│ - Track JSON │    │ into AEP    │    │ assert       │    │ sign        │    │ evidence    │
│ - Comms logs │    │ bundle      │    │ completeness │    │ manifest    │    │ report      │
│ - Sensor CSV │    │ schema      │    │              │    │             │    │             │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
                                                                                    │
                                                                                    ▼
                                                                           ┌─────────────────┐
                                                                           │  Output Folder   │
                                                                           │                  │
                                                                           │  bundle.json     │
                                                                           │  manifest.json   │
                                                                           │  signature.sig   │
                                                                           │  report.html     │
                                                                           │  report.pdf      │
                                                                           │  validation.json │
                                                                           └─────────────────┘
```

The toolchain is five components executed sequentially via a single CLI entry point. Each component is also usable independently for debugging and integration testing.

---

## Technology Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Language | Python 3.11+ | Fastest time-to-MVP. Strong ecosystem for crypto, JSON, PDF generation. Customer environments have Python. |
| CLI framework | `click` | Clean subcommands, auto-generated help, composable. |
| Crypto signing | `cryptography` (PyCA) | FIPS-capable. Ed25519 for signatures, SHA-256 for hashing. GovCloud compatible. |
| PDF generation | `weasyprint` or `pdfkit` | HTML-to-PDF. Report is authored as Jinja2 HTML template, rendered to both HTML and PDF. |
| Templating | `jinja2` | Policy packs and report templates. |
| Schema validation | `jsonschema` | Validates bundle structure against AEP spec. |
| Packaging | Docker + PyPI (`pip install aep-accelerator`) | Container for Iron Bank path. pip for quick local install. |
| Testing | `pytest` + synthetic data generator | Every component has unit tests. End-to-end integration test runs the full pipeline. |

---

## Project Structure

```
aep-accelerator/
├── README.md
├── pyproject.toml
├── Dockerfile
├── Makefile
├── src/
│   └── aep/
│       ├── __init__.py
│       ├── cli.py                  # Click CLI entry point
│       ├── compiler/
│       │   ├── __init__.py
│       │   ├── compiler.py         # Main compiler logic
│       │   ├── parsers/
│       │   │   ├── __init__.py
│       │   │   ├── base.py         # Abstract parser interface
│       │   │   ├── json_events.py  # JSON event log parser
│       │   │   ├── csv_tracks.py   # CSV track data parser
│       │   │   ├── syslog.py       # Syslog-format comms parser
│       │   │   └── foundry.py      # Palantir Foundry export parser
│       │   └── normalizer.py       # Normalize parsed records into AEP schema
│       ├── validator/
│       │   ├── __init__.py
│       │   ├── validator.py        # Validation engine
│       │   ├── policy_loader.py    # Load and compose policy packs
│       │   └── policies/
│       │       ├── freshness.yaml  # Data freshness policy
│       │       ├── provenance.yaml # Chain-of-custody policy
│       │       └── workflow.yaml   # Workflow evidence policy
│       ├── signer/
│       │   ├── __init__.py
│       │   ├── signer.py           # Hash manifest + signature generation
│       │   └── keys.py             # Key generation and management
│       ├── reporter/
│       │   ├── __init__.py
│       │   ├── reporter.py         # Report generation orchestrator
│       │   └── templates/
│       │       ├── report.html.j2  # Jinja2 HTML report template
│       │       └── styles.css      # Report stylesheet
│       ├── schema/
│       │   ├── aep_bundle_v0.1.json    # JSON Schema for bundle
│       │   └── aep_manifest_v0.1.json  # JSON Schema for manifest
│       └── utils/
│           ├── __init__.py
│           ├── time_utils.py       # UTC normalization, freshness calculation
│           └── hash_utils.py       # SHA-256 helpers
├── tests/
│   ├── conftest.py                 # Shared fixtures, synthetic data
│   ├── test_compiler.py
│   ├── test_validator.py
│   ├── test_signer.py
│   ├── test_reporter.py
│   ├── test_cli.py                 # End-to-end CLI tests
│   └── fixtures/
│       ├── sample_events.json
│       ├── sample_tracks.csv
│       └── sample_comms.log
├── scripts/
│   └── generate_synthetic_data.py  # Synthetic data generator for demos
└── policy_packs/
    ├── foundry_standard/
    │   ├── pack.yaml               # Pack metadata
    │   ├── freshness.yaml
    │   ├── provenance.yaml
    │   └── workflow.yaml
    └── lattice_standard/
        ├── pack.yaml
        ├── freshness.yaml
        ├── provenance.yaml
        └── workflow.yaml
```

---

## Component 1: AEP Schema (Days 1–2)

The AEP bundle schema is the foundation. Everything else consumes or produces this format.

### Bundle Schema (`aep_bundle_v0.1.json`)

The bundle is a single JSON file containing all normalized evidence records, metadata about the production run, and references to source inputs.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "AEP Bundle v0.1",
  "type": "object",
  "required": ["aep_version", "bundle_id", "created_utc", "producer", "sources", "evidence_records", "summary"],
  "properties": {
    "aep_version": {
      "type": "string",
      "const": "0.1.0"
    },
    "bundle_id": {
      "type": "string",
      "description": "UUID v4 unique to this bundle"
    },
    "created_utc": {
      "type": "string",
      "format": "date-time",
      "description": "ISO 8601 UTC timestamp of bundle creation"
    },
    "producer": {
      "type": "object",
      "required": ["tool", "version", "operator"],
      "properties": {
        "tool": { "type": "string", "const": "aep-accelerator" },
        "version": { "type": "string" },
        "operator": { "type": "string", "description": "Person or service account that ran the tool" }
      }
    },
    "context": {
      "type": "object",
      "description": "Optional program/exercise/mission context",
      "properties": {
        "program_name": { "type": "string" },
        "exercise_name": { "type": "string" },
        "phase_gate": { "type": "string" },
        "classification": { "type": "string", "enum": ["UNCLASSIFIED", "CUI", "CONFIDENTIAL", "SECRET", "TOP_SECRET"] },
        "time_window_start": { "type": "string", "format": "date-time" },
        "time_window_end": { "type": "string", "format": "date-time" }
      }
    },
    "sources": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["source_id", "source_type", "filename", "record_count", "ingested_utc"],
        "properties": {
          "source_id": { "type": "string" },
          "source_type": { "type": "string", "enum": ["json_events", "csv_tracks", "syslog", "foundry_export", "custom"] },
          "filename": { "type": "string" },
          "sha256": { "type": "string", "description": "Hash of the original input file" },
          "record_count": { "type": "integer" },
          "ingested_utc": { "type": "string", "format": "date-time" },
          "parser_version": { "type": "string" }
        }
      }
    },
    "evidence_records": {
      "type": "array",
      "description": "Normalized evidence items",
      "items": {
        "type": "object",
        "required": ["record_id", "source_id", "timestamp_utc", "category", "data"],
        "properties": {
          "record_id": { "type": "string" },
          "source_id": { "type": "string", "description": "References sources[].source_id" },
          "timestamp_utc": { "type": "string", "format": "date-time" },
          "category": {
            "type": "string",
            "enum": ["entity_state", "comms_heartbeat", "workflow_action", "sensor_reading", "operator_decision", "system_alert", "configuration_change", "custom"]
          },
          "provenance": {
            "type": "object",
            "properties": {
              "originator": { "type": "string" },
              "system": { "type": "string" },
              "classification": { "type": "string" },
              "confidence": { "type": "number", "minimum": 0, "maximum": 1 }
            }
          },
          "data": {
            "type": "object",
            "description": "Category-specific payload. Freeform but should follow category conventions."
          }
        }
      }
    },
    "summary": {
      "type": "object",
      "required": ["total_records", "time_span", "categories"],
      "properties": {
        "total_records": { "type": "integer" },
        "time_span": {
          "type": "object",
          "properties": {
            "earliest_utc": { "type": "string", "format": "date-time" },
            "latest_utc": { "type": "string", "format": "date-time" },
            "duration_seconds": { "type": "number" }
          }
        },
        "categories": {
          "type": "object",
          "description": "Count per category",
          "additionalProperties": { "type": "integer" }
        },
        "sources_count": { "type": "integer" }
      }
    }
  }
}
```

### Manifest Schema (`aep_manifest_v0.1.json`)

The manifest lists every file in the output folder with its SHA-256 hash, enabling tamper detection.

```json
{
  "title": "AEP Manifest v0.1",
  "type": "object",
  "required": ["manifest_version", "bundle_id", "created_utc", "files", "signing"],
  "properties": {
    "manifest_version": { "type": "string", "const": "0.1.0" },
    "bundle_id": { "type": "string" },
    "created_utc": { "type": "string", "format": "date-time" },
    "files": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["filename", "sha256", "size_bytes"],
        "properties": {
          "filename": { "type": "string" },
          "sha256": { "type": "string" },
          "size_bytes": { "type": "integer" }
        }
      }
    },
    "signing": {
      "type": "object",
      "required": ["algorithm", "public_key_id"],
      "properties": {
        "algorithm": { "type": "string", "description": "e.g. Ed25519" },
        "public_key_id": { "type": "string" },
        "signature_file": { "type": "string", "const": "signature.sig" }
      }
    }
  }
}
```

### Day 1–2 Deliverables

1. Both JSON Schema files finalized and committed.
2. A `scripts/generate_synthetic_data.py` script that produces realistic sample inputs: 500+ JSON event records, 200+ CSV track rows, 100+ syslog-format comms heartbeats. This synthetic data is the fallback if a prospect cannot provide exercise data quickly.
3. An example `bundle.json` hand-crafted from the synthetic data to validate the schema works before the compiler exists.

---

## Component 2: Compiler (Days 3–5)

The compiler ingests raw files, dispatches each to the appropriate parser, normalizes output into the AEP evidence record schema, and assembles the bundle.

### Parser Interface

Every parser implements a common interface:

```python
# src/aep/compiler/parsers/base.py

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import List, Dict, Any
from datetime import datetime


@dataclass
class ParsedRecord:
    """Single normalized record from any source."""
    timestamp_utc: datetime
    category: str  # Must match schema enum
    originator: str
    system: str
    confidence: float  # 0.0-1.0
    data: Dict[str, Any]


class BaseParser(ABC):
    """All parsers implement this interface."""

    @abstractmethod
    def can_parse(self, filepath: str) -> bool:
        """Return True if this parser handles the given file."""
        ...

    @abstractmethod
    def parse(self, filepath: str) -> List[ParsedRecord]:
        """Parse the file and return normalized records."""
        ...

    @property
    @abstractmethod
    def parser_version(self) -> str:
        ...

    @property
    @abstractmethod
    def source_type(self) -> str:
        """Must match schema enum: json_events, csv_tracks, syslog, foundry_export, custom."""
        ...
```

### Parser Implementations

Build four parsers for the MVP:

**`json_events.py`** — Handles JSON files containing arrays of event objects. Expects each object to have at minimum a timestamp field (auto-detects common names: `timestamp`, `time`, `event_time`, `created_at`, `@timestamp`) and extracts the rest as the `data` payload. Category is inferred from field presence or an explicit `category`/`event_type` field.

**`csv_tracks.py`** — Handles CSV files with track/entity data. Expects columns for timestamp, entity ID, position (lat/lon or grid), and any additional columns become the data payload. Category defaults to `entity_state`.

**`syslog.py`** — Handles syslog-formatted text files. Parses RFC 3164 and RFC 5424 formats. Category defaults to `comms_heartbeat` for heartbeat patterns, `system_alert` for error/warning levels.

**`foundry.py`** — Handles Palantir Foundry export JSON (ontology objects). Maps Foundry object types to AEP categories. This is the key differentiator for the Accenture/PVM/Launch channel.

### Compiler Core Logic

```python
# src/aep/compiler/compiler.py

import uuid
import hashlib
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

from .parsers.base import BaseParser, ParsedRecord
from .parsers.json_events import JsonEventsParser
from .parsers.csv_tracks import CsvTracksParser
from .parsers.syslog import SyslogParser
from .parsers.foundry import FoundryParser
from .normalizer import normalize_records


class AEPCompiler:
    def __init__(self, operator: str, context: Optional[dict] = None):
        self.operator = operator
        self.context = context or {}
        self.parsers: List[BaseParser] = [
            JsonEventsParser(),
            CsvTracksParser(),
            SyslogParser(),
            FoundryParser(),
        ]

    def compile(self, input_files: List[Path], output_dir: Path) -> dict:
        """
        Main entry point. Ingests files, parses, normalizes,
        and writes bundle.json to output_dir.
        Returns the bundle dict.
        """
        bundle_id = str(uuid.uuid4())
        sources = []
        all_records: List[ParsedRecord] = []

        for filepath in input_files:
            parser = self._select_parser(filepath)
            if parser is None:
                raise ValueError(f"No parser found for: {filepath}")

            records = parser.parse(str(filepath))
            file_hash = self._hash_file(filepath)

            sources.append({
                "source_id": str(uuid.uuid4()),
                "source_type": parser.source_type,
                "filename": filepath.name,
                "sha256": file_hash,
                "record_count": len(records),
                "ingested_utc": datetime.now(timezone.utc).isoformat(),
                "parser_version": parser.parser_version,
            })

            # Tag each record with its source_id
            for r in records:
                r._source_id = sources[-1]["source_id"]

            all_records.extend(records)

        evidence_records = normalize_records(all_records)
        summary = self._build_summary(evidence_records)

        bundle = {
            "aep_version": "0.1.0",
            "bundle_id": bundle_id,
            "created_utc": datetime.now(timezone.utc).isoformat(),
            "producer": {
                "tool": "aep-accelerator",
                "version": "0.1.0",
                "operator": self.operator,
            },
            "context": self.context,
            "sources": sources,
            "evidence_records": evidence_records,
            "summary": summary,
        }

        output_dir.mkdir(parents=True, exist_ok=True)
        bundle_path = output_dir / "bundle.json"
        import json
        bundle_path.write_text(json.dumps(bundle, indent=2, default=str))

        return bundle

    def _select_parser(self, filepath: Path) -> Optional[BaseParser]:
        for parser in self.parsers:
            if parser.can_parse(str(filepath)):
                return parser
        return None

    @staticmethod
    def _hash_file(filepath: Path) -> str:
        h = hashlib.sha256()
        with open(filepath, "rb") as f:
            for chunk in iter(lambda: f.read(8192), b""):
                h.update(chunk)
        return h.hexdigest()

    @staticmethod
    def _build_summary(records: list) -> dict:
        if not records:
            return {"total_records": 0, "time_span": {}, "categories": {}, "sources_count": 0}

        timestamps = [r["timestamp_utc"] for r in records]
        categories = {}
        source_ids = set()
        for r in records:
            cat = r["category"]
            categories[cat] = categories.get(cat, 0) + 1
            source_ids.add(r["source_id"])

        return {
            "total_records": len(records),
            "time_span": {
                "earliest_utc": min(timestamps),
                "latest_utc": max(timestamps),
            },
            "categories": categories,
            "sources_count": len(source_ids),
        }
```

### Normalizer

The normalizer converts `ParsedRecord` objects into the final `evidence_records` list format matching the bundle schema:

```python
# src/aep/compiler/normalizer.py

import uuid
from typing import List
from .parsers.base import ParsedRecord


def normalize_records(records: List[ParsedRecord]) -> List[dict]:
    """Convert ParsedRecord instances into schema-compliant dicts."""
    normalized = []
    for r in records:
        normalized.append({
            "record_id": str(uuid.uuid4()),
            "source_id": r._source_id,
            "timestamp_utc": r.timestamp_utc.isoformat(),
            "category": r.category,
            "provenance": {
                "originator": r.originator,
                "system": r.system,
                "confidence": r.confidence,
            },
            "data": r.data,
        })
    return normalized
```

### Day 3–5 Deliverables

1. All four parsers implemented and passing unit tests against fixture files.
2. Compiler assembles a valid `bundle.json` from synthetic data.
3. Bundle validates against the JSON Schema.
4. `aep compile --input ./data/ --output ./output/ --operator "demo_user"` works end-to-end.

---

## Component 3: Validator + Policy Packs (Days 6–8)

The validator reads a `bundle.json` and applies one or more policy packs. Each policy pack is a YAML file defining rules that evidence records must satisfy.

### Policy Pack Format

```yaml
# policy_packs/foundry_standard/freshness.yaml

policy:
  name: "Data Freshness"
  version: "1.0.0"
  description: "Asserts that evidence records are not stale relative to the bundle time window."

rules:
  - id: FRESH-001
    name: "Record timestamp within window"
    description: "Every record timestamp must fall within the declared context time window, with a configurable tolerance."
    severity: ERROR
    check: "record_within_time_window"
    params:
      tolerance_seconds: 300  # 5-minute grace period

  - id: FRESH-002
    name: "No gaps exceeding threshold"
    description: "For comms_heartbeat records, no gap between consecutive timestamps should exceed the threshold."
    severity: WARNING
    check: "max_gap_by_category"
    params:
      category: "comms_heartbeat"
      max_gap_seconds: 60

  - id: FRESH-003
    name: "Minimum record density"
    description: "The bundle must contain at least N records per hour of time window."
    severity: ERROR
    check: "min_records_per_hour"
    params:
      min_per_hour: 10
```

```yaml
# policy_packs/foundry_standard/provenance.yaml

policy:
  name: "Provenance / Chain of Custody"
  version: "1.0.0"
  description: "Asserts that evidence records have complete provenance metadata."

rules:
  - id: PROV-001
    name: "Originator present"
    description: "Every record must have a non-empty provenance.originator field."
    severity: ERROR
    check: "field_not_empty"
    params:
      field_path: "provenance.originator"

  - id: PROV-002
    name: "System identified"
    description: "Every record must have a non-empty provenance.system field."
    severity: ERROR
    check: "field_not_empty"
    params:
      field_path: "provenance.system"

  - id: PROV-003
    name: "Confidence score present"
    description: "Every record must have a confidence score between 0 and 1."
    severity: WARNING
    check: "field_in_range"
    params:
      field_path: "provenance.confidence"
      min: 0.0
      max: 1.0

  - id: PROV-004
    name: "Source file integrity"
    description: "Every source listed in the bundle must have a non-empty SHA-256 hash."
    severity: ERROR
    check: "source_hash_present"
```

```yaml
# policy_packs/foundry_standard/workflow.yaml

policy:
  name: "Workflow Evidence"
  version: "1.0.0"
  description: "Asserts that key workflow actions are captured in the evidence."

rules:
  - id: WKFL-001
    name: "Operator decisions present"
    description: "Bundle must contain at least one operator_decision record."
    severity: WARNING
    check: "min_category_count"
    params:
      category: "operator_decision"
      min_count: 1

  - id: WKFL-002
    name: "Configuration changes logged"
    description: "If any configuration_change records exist, they must include a before/after diff in the data payload."
    severity: WARNING
    check: "conditional_field_present"
    params:
      if_category: "configuration_change"
      required_data_fields: ["before", "after"]

  - id: WKFL-003
    name: "Multiple source coverage"
    description: "Bundle must draw from at least 2 distinct data sources."
    severity: ERROR
    check: "min_source_count"
    params:
      min_count: 2
```

### Validator Engine

```python
# src/aep/validator/validator.py

import json
import yaml
from pathlib import Path
from dataclasses import dataclass, field
from typing import List, Optional
from datetime import datetime, timezone

from .policy_loader import load_policy_pack


@dataclass
class ValidationResult:
    rule_id: str
    rule_name: str
    severity: str  # ERROR, WARNING, INFO
    passed: bool
    message: str
    details: Optional[dict] = None


@dataclass
class ValidationReport:
    bundle_id: str
    validated_utc: str
    policy_packs: List[str]
    results: List[ValidationResult] = field(default_factory=list)
    passed: bool = True  # Set to False if any ERROR-severity rule fails

    def to_dict(self) -> dict:
        return {
            "bundle_id": self.bundle_id,
            "validated_utc": self.validated_utc,
            "policy_packs": self.policy_packs,
            "overall_pass": self.passed,
            "error_count": sum(1 for r in self.results if not r.passed and r.severity == "ERROR"),
            "warning_count": sum(1 for r in self.results if not r.passed and r.severity == "WARNING"),
            "total_rules": len(self.results),
            "results": [
                {
                    "rule_id": r.rule_id,
                    "rule_name": r.rule_name,
                    "severity": r.severity,
                    "passed": r.passed,
                    "message": r.message,
                    "details": r.details,
                }
                for r in self.results
            ],
        }


class AEPValidator:
    """Validates an AEP bundle against one or more policy packs."""

    # Registry of check functions
    CHECK_REGISTRY = {}

    @classmethod
    def register_check(cls, name):
        def decorator(func):
            cls.CHECK_REGISTRY[name] = func
            return func
        return decorator

    def validate(self, bundle: dict, policy_pack_dirs: List[Path]) -> ValidationReport:
        report = ValidationReport(
            bundle_id=bundle["bundle_id"],
            validated_utc=datetime.now(timezone.utc).isoformat(),
            policy_packs=[str(p) for p in policy_pack_dirs],
        )

        for pack_dir in policy_pack_dirs:
            policies = load_policy_pack(pack_dir)
            for policy in policies:
                for rule in policy["rules"]:
                    check_fn = self.CHECK_REGISTRY.get(rule["check"])
                    if check_fn is None:
                        report.results.append(ValidationResult(
                            rule_id=rule["id"],
                            rule_name=rule["name"],
                            severity="ERROR",
                            passed=False,
                            message=f"Unknown check function: {rule['check']}",
                        ))
                        report.passed = False
                        continue

                    result = check_fn(bundle, rule.get("params", {}))
                    vr = ValidationResult(
                        rule_id=rule["id"],
                        rule_name=rule["name"],
                        severity=rule["severity"],
                        passed=result["passed"],
                        message=result["message"],
                        details=result.get("details"),
                    )
                    report.results.append(vr)

                    if not vr.passed and vr.severity == "ERROR":
                        report.passed = False

        return report
```

Implement the check functions referenced in the policy packs. Each is a function that takes `(bundle: dict, params: dict)` and returns `{"passed": bool, "message": str, "details": optional dict}`. Register them with the `@AEPValidator.register_check("check_name")` decorator. The MVP needs these checks:

- `record_within_time_window`
- `max_gap_by_category`
- `min_records_per_hour`
- `field_not_empty`
- `field_in_range`
- `source_hash_present`
- `min_category_count`
- `conditional_field_present`
- `min_source_count`

### Day 6–8 Deliverables

1. Validator engine with all 9 check functions implemented and tested.
2. Three policy packs (freshness, provenance, workflow) as YAML files.
3. `aep validate --bundle ./output/bundle.json --policy-pack ./policy_packs/foundry_standard/` produces `validation_results.json`.
4. Tests cover both passing and failing scenarios for each rule.

---

## Component 4: Signer / Notary (Days 9–10)

The signer produces a hash manifest of all output files and a cryptographic signature over that manifest.

### Key Management

For the MVP, use Ed25519 key pairs generated locally. The signing key stays with the operator; the public key is embedded in the manifest for verification.

```python
# src/aep/signer/keys.py

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives import serialization
from pathlib import Path


def generate_keypair(output_dir: Path) -> tuple:
    """Generate an Ed25519 keypair and save to files."""
    private_key = Ed25519PrivateKey.generate()
    public_key = private_key.public_key()

    output_dir.mkdir(parents=True, exist_ok=True)

    priv_path = output_dir / "aep_signing_key.pem"
    priv_path.write_bytes(
        private_key.private_bytes(
            serialization.Encoding.PEM,
            serialization.PrivateFormat.PKCS8,
            serialization.NoEncryption(),
        )
    )

    pub_path = output_dir / "aep_signing_key.pub"
    pub_path.write_bytes(
        public_key.public_bytes(
            serialization.Encoding.PEM,
            serialization.PublicFormat.SubjectPublicKeyInfo,
        )
    )

    return priv_path, pub_path


def load_private_key(path: Path) -> Ed25519PrivateKey:
    return serialization.load_pem_private_key(path.read_bytes(), password=None)
```

### Signer Core

```python
# src/aep/signer/signer.py

import json
import hashlib
from pathlib import Path
from datetime import datetime, timezone

from .keys import load_private_key


class AEPSigner:
    def __init__(self, private_key_path: Path):
        self.private_key = load_private_key(private_key_path)
        self.public_key = self.private_key.public_key()

    def sign_bundle(self, output_dir: Path) -> None:
        """
        Reads all files in output_dir (except manifest.json and signature.sig),
        produces manifest.json, then signs the manifest and writes signature.sig.
        """
        # 1. Hash all existing files
        files_to_hash = sorted([
            f for f in output_dir.iterdir()
            if f.is_file() and f.name not in ("manifest.json", "signature.sig")
        ])

        file_entries = []
        for filepath in files_to_hash:
            file_entries.append({
                "filename": filepath.name,
                "sha256": self._hash_file(filepath),
                "size_bytes": filepath.stat().st_size,
            })

        # 2. Read bundle_id from bundle.json
        bundle_data = json.loads((output_dir / "bundle.json").read_text())
        bundle_id = bundle_data["bundle_id"]

        # 3. Build manifest
        from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat
        pub_key_bytes = self.public_key.public_bytes(Encoding.Raw, PublicFormat.Raw)

        manifest = {
            "manifest_version": "0.1.0",
            "bundle_id": bundle_id,
            "created_utc": datetime.now(timezone.utc).isoformat(),
            "files": file_entries,
            "signing": {
                "algorithm": "Ed25519",
                "public_key_id": pub_key_bytes.hex(),
                "signature_file": "signature.sig",
            },
        }

        manifest_path = output_dir / "manifest.json"
        manifest_json = json.dumps(manifest, indent=2)
        manifest_path.write_text(manifest_json)

        # 4. Sign the manifest
        signature = self.private_key.sign(manifest_json.encode("utf-8"))
        sig_path = output_dir / "signature.sig"
        sig_path.write_bytes(signature)

    @staticmethod
    def _hash_file(filepath: Path) -> str:
        h = hashlib.sha256()
        with open(filepath, "rb") as f:
            for chunk in iter(lambda: f.read(8192), b""):
                h.update(chunk)
        return h.hexdigest()
```

Add a verification function so customers can independently verify the signature:

```python
def verify_bundle(output_dir: Path) -> bool:
    """Verify manifest signature and file hashes."""
    manifest = json.loads((output_dir / "manifest.json").read_text())
    signature = (output_dir / "signature.sig").read_bytes()

    # Reconstruct public key from manifest
    pub_key_hex = manifest["signing"]["public_key_id"]
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
    public_key = Ed25519PublicKey.from_public_bytes(bytes.fromhex(pub_key_hex))

    # Verify signature over manifest content
    manifest_bytes = (output_dir / "manifest.json").read_bytes()
    try:
        public_key.verify(signature, manifest_bytes)
    except Exception:
        return False

    # Verify each file hash
    for entry in manifest["files"]:
        filepath = output_dir / entry["filename"]
        if not filepath.exists():
            return False
        h = hashlib.sha256()
        with open(filepath, "rb") as f:
            for chunk in iter(lambda: f.read(8192), b""):
                h.update(chunk)
        if h.hexdigest() != entry["sha256"]:
            return False

    return True
```

### Day 9–10 Deliverables

1. Key generation command: `aep keygen --output ./keys/`
2. Signing command: `aep sign --output-dir ./output/ --key ./keys/aep_signing_key.pem`
3. Verification command: `aep verify --output-dir ./output/`
4. Tests cover signing, verification, and tamper detection (modify a file, confirm verify fails).

---

## Component 5: Report Generator (Days 11–12)

The reporter reads the bundle, validation results, and manifest, then renders a human-readable HTML report (and converts to PDF).

### HTML Report Template

Use Jinja2. The report should contain:

1. **Header**: Bundle ID, creation timestamp, operator, program context.
2. **Executive Summary**: Total records, time span, source count, overall pass/fail.
3. **Validation Results**: Table of all rules with pass/fail, severity, messages. Color-coded: green for pass, red for ERROR fail, yellow for WARNING fail.
4. **Source Inventory**: Table of ingested files with record counts and hashes.
5. **Evidence Summary by Category**: Bar chart or table showing record distribution.
6. **Integrity Attestation**: Manifest hash, signature algorithm, public key ID, verification status.
7. **Footer**: Tool version, generation timestamp, AEP schema version.

```python
# src/aep/reporter/reporter.py

import json
from pathlib import Path
from datetime import datetime, timezone
from jinja2 import Environment, FileSystemLoader


class AEPReporter:
    def __init__(self, template_dir: Path = None):
        if template_dir is None:
            template_dir = Path(__file__).parent / "templates"
        self.env = Environment(loader=FileSystemLoader(str(template_dir)))

    def generate(self, output_dir: Path) -> None:
        """Read bundle, validation, manifest from output_dir and generate report."""
        bundle = json.loads((output_dir / "bundle.json").read_text())
        validation = json.loads((output_dir / "validation_results.json").read_text())
        manifest = json.loads((output_dir / "manifest.json").read_text())

        template = self.env.get_template("report.html.j2")
        html_content = template.render(
            bundle=bundle,
            validation=validation,
            manifest=manifest,
            generated_utc=datetime.now(timezone.utc).isoformat(),
        )

        # Write HTML
        html_path = output_dir / "report.html"
        html_path.write_text(html_content)

        # Convert to PDF
        try:
            from weasyprint import HTML
            HTML(string=html_content).write_pdf(str(output_dir / "report.pdf"))
        except ImportError:
            # Fallback: PDF generation optional if weasyprint not available
            print("Warning: weasyprint not installed. PDF report skipped.")
```

The Jinja2 template (`report.html.j2`) should be a self-contained HTML file with inline CSS (no external dependencies) so it renders correctly when opened from the filesystem. Use a clean, professional style with the Synexis navy/blue palette.

### Day 11–12 Deliverables

1. HTML report renders correctly in a browser.
2. PDF report generates via weasyprint.
3. `aep report --output-dir ./output/` produces both files.
4. Report passes visual review by at least one person who is not the developer.

---

## CLI Entry Point (Integrated Across All Days)

```python
# src/aep/cli.py

import click
import json
from pathlib import Path


@click.group()
@click.version_option(version="0.1.0")
def cli():
    """AEP Accelerator -- Assurance Evidence Pack toolchain."""
    pass


@cli.command()
@click.option("--input", "-i", "input_dir", required=True, type=click.Path(exists=True), help="Directory containing input files")
@click.option("--output", "-o", "output_dir", required=True, type=click.Path(), help="Output directory for the AEP bundle")
@click.option("--operator", required=True, help="Operator name or service account")
@click.option("--program", default=None, help="Program name for context")
@click.option("--exercise", default=None, help="Exercise name for context")
@click.option("--classification", default="UNCLASSIFIED", help="Classification level")
def compile(input_dir, output_dir, operator, program, exercise, classification):
    """Compile input files into an AEP bundle."""
    from .compiler.compiler import AEPCompiler

    context = {
        "program_name": program,
        "exercise_name": exercise,
        "classification": classification,
    }
    compiler = AEPCompiler(operator=operator, context=context)
    input_files = list(Path(input_dir).glob("*"))
    bundle = compiler.compile(input_files, Path(output_dir))
    click.echo(f"Bundle created: {bundle['bundle_id']} ({bundle['summary']['total_records']} records)")


@cli.command()
@click.option("--bundle", "-b", required=True, type=click.Path(exists=True), help="Path to bundle.json")
@click.option("--policy-pack", "-p", required=True, multiple=True, type=click.Path(exists=True), help="Path to policy pack directory")
@click.option("--output-dir", "-o", required=True, type=click.Path(), help="Output directory for validation results")
def validate(bundle, policy_pack, output_dir):
    """Validate a bundle against policy packs."""
    from .validator.validator import AEPValidator

    bundle_data = json.loads(Path(bundle).read_text())
    validator = AEPValidator()
    report = validator.validate(bundle_data, [Path(p) for p in policy_pack])

    out = Path(output_dir)
    out.mkdir(parents=True, exist_ok=True)
    (out / "validation_results.json").write_text(json.dumps(report.to_dict(), indent=2))

    status = "PASS" if report.passed else "FAIL"
    click.echo(f"Validation: {status} ({report.to_dict()['error_count']} errors, {report.to_dict()['warning_count']} warnings)")


@cli.command()
@click.option("--output-dir", "-o", required=True, type=click.Path(exists=True), help="Output directory containing bundle + validation")
@click.option("--key", "-k", required=True, type=click.Path(exists=True), help="Path to Ed25519 private key")
def sign(output_dir, key):
    """Sign the bundle and produce manifest + signature."""
    from .signer.signer import AEPSigner

    signer = AEPSigner(Path(key))
    signer.sign_bundle(Path(output_dir))
    click.echo("Bundle signed. manifest.json and signature.sig written.")


@cli.command()
@click.option("--output-dir", "-o", required=True, type=click.Path(exists=True), help="Output directory to verify")
def verify(output_dir):
    """Verify bundle integrity and signature."""
    from .signer.signer import verify_bundle

    if verify_bundle(Path(output_dir)):
        click.echo("Verification: PASS -- all hashes match and signature is valid.")
    else:
        click.echo("Verification: FAIL -- bundle integrity compromised.")
        raise SystemExit(1)


@cli.command()
@click.option("--output-dir", "-o", required=True, type=click.Path(exists=True), help="Output directory containing bundle, validation, manifest")
def report(output_dir):
    """Generate HTML and PDF evidence report."""
    from .reporter.reporter import AEPReporter

    reporter = AEPReporter()
    reporter.generate(Path(output_dir))
    click.echo("Report generated: report.html + report.pdf")


@cli.command()
@click.option("--output", "-o", required=True, type=click.Path(), help="Directory for keypair output")
def keygen(output):
    """Generate an Ed25519 signing keypair."""
    from .signer.keys import generate_keypair

    priv, pub = generate_keypair(Path(output))
    click.echo(f"Keys generated:\n  Private: {priv}\n  Public:  {pub}")


@cli.command()
@click.option("--input", "-i", "input_dir", required=True, type=click.Path(exists=True))
@click.option("--output", "-o", "output_dir", required=True, type=click.Path())
@click.option("--operator", required=True)
@click.option("--key", "-k", required=True, type=click.Path(exists=True))
@click.option("--policy-pack", "-p", required=True, multiple=True, type=click.Path(exists=True))
@click.option("--program", default=None)
@click.option("--exercise", default=None)
@click.option("--classification", default="UNCLASSIFIED")
def run(input_dir, output_dir, operator, key, policy_pack, program, exercise, classification):
    """Full pipeline: compile -> validate -> sign -> report."""
    from .compiler.compiler import AEPCompiler
    from .validator.validator import AEPValidator
    from .signer.signer import AEPSigner
    from .reporter.reporter import AEPReporter
    import time

    start = time.time()
    out = Path(output_dir)

    # Compile
    context = {"program_name": program, "exercise_name": exercise, "classification": classification}
    compiler = AEPCompiler(operator=operator, context=context)
    input_files = list(Path(input_dir).glob("*"))
    bundle = compiler.compile(input_files, out)
    click.echo(f"[1/4] Compiled: {bundle['summary']['total_records']} records from {bundle['summary']['sources_count']} sources")

    # Validate
    validator = AEPValidator()
    val_report = validator.validate(bundle, [Path(p) for p in policy_pack])
    (out / "validation_results.json").write_text(json.dumps(val_report.to_dict(), indent=2))
    status = "PASS" if val_report.passed else "FAIL"
    click.echo(f"[2/4] Validated: {status}")

    # Sign
    signer = AEPSigner(Path(key))
    signer.sign_bundle(out)
    click.echo("[3/4] Signed: manifest.json + signature.sig")

    # Report
    reporter = AEPReporter()
    reporter.generate(out)
    elapsed = time.time() - start
    click.echo(f"[4/4] Report generated in {elapsed:.1f}s total")
    click.echo(f"\nOutput: {out}/")


if __name__ == "__main__":
    cli()
```

---

## Demo Run (Days 13–14)

### Full Pipeline Command

```bash
# Generate keys (one-time)
aep keygen --output ./keys/

# Generate synthetic data (if no customer data available)
python scripts/generate_synthetic_data.py --output ./demo_data/ --records 500

# Run full pipeline
aep run \
  --input ./demo_data/ \
  --output ./demo_output/ \
  --operator "Edward / Synexis" \
  --key ./keys/aep_signing_key.pem \
  --policy-pack ./policy_packs/foundry_standard/ \
  --program "AEP Demo Program" \
  --exercise "Pilot Exercise Alpha" \
  --classification UNCLASSIFIED

# Verify independently
aep verify --output-dir ./demo_output/
```

### Screen Recording Checklist

Record the following sequence for the demo video:

1. Show the input directory (file listing, sample content).
2. Run `aep run` with the full set of flags.
3. Show the terminal output (compile -> validate -> sign -> report with timing).
4. Open the output directory and show all 6 files.
5. Open `report.html` in a browser -- scroll through all sections.
6. Open `validation_results.json` -- show pass/fail.
7. Run `aep verify` -- show PASS output.
8. Tamper with one file (e.g., edit a record in `bundle.json`), re-run `aep verify` -- show FAIL.
9. Show total elapsed time (must be under 60 minutes; target under 5 minutes for synthetic data).

### Day 13–14 Deliverables

1. Complete end-to-end run on synthetic data, recorded.
2. All output artifacts in a single folder.
3. Dockerfile builds and runs successfully.
4. `pip install .` installs the CLI from the repo.

---

## Dockerfile

```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY pyproject.toml .
COPY src/ src/
COPY policy_packs/ policy_packs/

RUN pip install --no-cache-dir . && \
    pip install --no-cache-dir weasyprint

ENTRYPOINT ["aep"]
CMD ["--help"]
```

```bash
# Build
docker build -t aep-accelerator:0.1.0 .

# Run full pipeline via container
docker run --rm \
  -v $(pwd)/demo_data:/data/input \
  -v $(pwd)/demo_output:/data/output \
  -v $(pwd)/keys:/data/keys \
  -v $(pwd)/policy_packs:/data/policies \
  aep-accelerator:0.1.0 run \
    --input /data/input \
    --output /data/output \
    --operator "demo" \
    --key /data/keys/aep_signing_key.pem \
    --policy-pack /data/policies/foundry_standard/
```

---

## pyproject.toml

```toml
[build-system]
requires = ["setuptools>=68.0", "wheel"]
build-backend = "setuptools.backends._legacy:_Backend"

[project]
name = "aep-accelerator"
version = "0.1.0"
description = "Assurance Evidence Pack toolchain"
requires-python = ">=3.11"
dependencies = [
    "click>=8.1",
    "jsonschema>=4.20",
    "pyyaml>=6.0",
    "jinja2>=3.1",
    "cryptography>=41.0",
]

[project.optional-dependencies]
pdf = ["weasyprint>=60.0"]
dev = ["pytest>=7.0", "pytest-cov"]

[project.scripts]
aep = "aep.cli:cli"

[tool.setuptools.packages.find]
where = ["src"]
```

---

## Testing Strategy

### Unit Tests

Each component has its own test file. Use pytest fixtures in `conftest.py` to share synthetic data across tests.

Key test cases:

- **Compiler**: Parses each format correctly. Rejects unsupported formats. Handles empty files gracefully. Bundle validates against schema.
- **Validator**: Each check function passes with good data. Each check function fails with deliberately bad data. Policy loading handles missing/malformed YAML.
- **Signer**: Signing produces valid Ed25519 signature. Verification passes on untampered bundle. Verification fails after any file modification.
- **Reporter**: HTML renders without errors. Contains all required sections. PDF generates without errors.
- **CLI (integration)**: `aep run` end-to-end produces all 6 output files. Exit code 0 on success, non-zero on validation failure.

### Running Tests

```bash
pip install -e ".[dev]"
pytest tests/ -v --cov=aep --cov-report=term-missing
```

---

## 14-Day Build Schedule

| Day | Component | Milestone |
|-----|-----------|-----------|
| 1 | Schema + Synthetic Data | `aep_bundle_v0.1.json`, `aep_manifest_v0.1.json`, `generate_synthetic_data.py` producing 500+ records |
| 2 | Schema + Project Setup | `pyproject.toml`, project structure, example `bundle.json` validates against schema |
| 3 | Compiler: JSON + CSV parsers | `json_events.py` and `csv_tracks.py` passing tests |
| 4 | Compiler: Syslog + Foundry parsers | `syslog.py` and `foundry.py` passing tests |
| 5 | Compiler: Integration | `aep compile` produces valid bundle from synthetic data. All compiler tests green. |
| 6 | Validator: Engine + Freshness | Validator engine, policy loader, freshness policy with 3 check functions |
| 7 | Validator: Provenance + Workflow | Provenance and workflow policies, remaining check functions |
| 8 | Validator: Integration | `aep validate` produces `validation_results.json`. All validator tests green. |
| 9 | Signer: Key management + signing | `aep keygen`, `aep sign` working |
| 10 | Signer: Verification + tests | `aep verify` working. Tamper detection tests green. |
| 11 | Reporter: Template + HTML | Jinja2 template, `aep report` produces `report.html` |
| 12 | Reporter: PDF + full pipeline | PDF generation, `aep run` end-to-end working |
| 13 | Docker + packaging | Dockerfile, `pip install .` works, container runs full pipeline |
| 14 | Demo run + screen recording | Recorded proof of < 60 min (target < 5 min). All tests green. README complete. |

---

## Post-MVP Expansion Hooks

These are not built in the 14-day sprint but the architecture should not preclude them:

- **Custom parsers**: The `BaseParser` interface allows new parsers to be added as plugins without modifying the compiler core. Customer-specific log formats get their own parser file.
- **Additional policy packs**: New YAML files in a policy pack directory are automatically loaded. Lattice-specific and customer-specific packs are just new directories.
- **Remote signing**: The signer interface can be extended to support HSM-backed keys or cloud KMS (AWS KMS, Azure Key Vault) for production deployments. The MVP uses local Ed25519 keys.
- **Foundry Marketplace packaging**: The container can be wrapped in Foundry DevOps packaging for distribution via Palantir Marketplace. This requires Foundry-specific metadata but no code changes.
- **Iron Bank hardening**: The Dockerfile is the starting point. Iron Bank submission requires a hardened base image (e.g., `registry1.dso.mil/ironbank/opensource/python`), security scanning, and STIG compliance documentation.
- **Time-Confidence Ledger integration**: The schema's `provenance.confidence` field and the freshness policy pack are designed to accept time-confidence scores from a future TCL module.
- **Coalition Redaction Compiler**: The bundle schema supports classification-level tagging per record and per source, enabling future policy-based redaction for multi-partner sharing.
