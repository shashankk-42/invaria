# Packet Tracer examination: research and implementation plan

Research date: 3 October 2026. Status: proposal; no PKT parser or analysis feature has been implemented or validated.

## Recommendation and scope

Assumption: `.pkt` means Cisco Packet Tracer saved networks. Build a separate network scan mode alongside GitHub application scans. The first release should examine topology, inventory, and explicit device configuration issues. Reuse Invaria's queue, finding review, evidence ledger, persistence, and report export.

Proposed user flow: select **Packet Tracer**, upload one `.pkt`, optionally attach network requirements as documents, run analysis, then inspect **Overview / Topology / Devices / Findings / Coverage & audit**. Findings open the affected device and a redacted configuration excerpt. Requirements documents remain untrusted hints unless the user explicitly defines a structured network policy.

A successful extraction with zero findings must still show inventory and coverage. A corrupt or unsupported file must produce a visible failure, never an empty successful report.

MVP excludes simulation, ping execution, automatic fixes, PKT rewriting, `.pka` activity/answer-network analysis, `.pkz` archives, and cross-domain application-to-network attack paths. It examines a saved model, not the operational state of a real network.

## Research findings

Cisco describes PKT as a saved topology and PKZ as a package that can include associated icons and backgrounds. Its FAQ also explains that newer save files cannot necessarily open in older Packet Tracer versions. Consequently, record the embedded version and publish a tested compatibility matrix rather than promising all-version support. Sources: [Cisco interface overview](https://tutorials.ptnetacad.net/help/default/interfaceOverview.htm), [Cisco compatibility FAQ](https://tutorials.ptnetacad.net/help/default/faqTroubleShoot.htm).

Open-source work demonstrates a practical binary-to-XML route. These are reverse-engineered implementations, not a verified Cisco-supported interchange contract:

| Candidate | Evidence from upstream | Role in this plan |
| --- | --- | --- |
| [axcheron/ptexplorer](https://github.com/axcheron/ptexplorer) | MIT; XOR and zlib decoding; README shows Packet Tracer 5.2 XML | Optional legacy adapter after modern support works |
| [mircodz/pka2xml](https://github.com/mircodz/pka2xml) | C++ converter with CryptoPP dependencies; BSD 2-Clause; also includes unrelated application patching features | Format reference and candidate comparison tool; evaluate only its decoder |
| [jeamxn/cisco-pka-to-xml](https://github.com/jeamxn/cisco-pka-to-xml) | MIT; upstream claims 7.x–9.x; Python orchestration with native Twofish library | Leading integration candidate, conditional on fixture and platform validation |

The last candidate's README describes devices, links, running configurations, and endpoint addressing in decoded XML. Despite its “pure-Python” description, it requires a compiler/native Twofish shared library. Build and package that library ahead of runtime. Do not ask users to compile it during a scan. Its tests described upstream include synthetic round trips and a cipher test; those do not establish compatibility with authentic PKT files. [Upstream implementation and requirements](https://github.com/jeamxn/cisco-pka-to-xml).

Source inspection found `decrypt_pka` calls unbounded `zlib.decompress` and only warns when declared and actual output lengths disagree. Do not integrate it unchanged: enforce a real decompressed-output cap and reject length inconsistencies. [Decoder source](https://github.com/jeamxn/cisco-pka-to-xml/blob/main/pka2xml/__init__.py).

Decoder choice is provisional. No decoder was installed or run and no authentic PKT samples were available for this research. Pin an audited commit, preserve license notices, and isolate the adapter so a different decoder can replace it.

## Fit with the existing code

The current code has several application-specific assumptions:

- `backend/invaria/models.py`: `ScanRequest` accepts `github` or `fixture` and requires `repository`; evidence uses a text file and line range.
- `backend/invaria/api.py`: multipart input handles supplemental documents, validates a repository/fixture, then dispatches the single bounded worker. Markdown export labels every target a repository.
- `backend/invaria/documents.py`: document extraction is explicitly context-only. Adding `.pkt` to its allowlist would not provide network findings and would violate its evidence separation.
- `backend/invaria/pipeline.py` and `worker.py`: repository ingestion, source inventory, Express extraction, and Semgrep form the current pipeline. Network scans need their own extraction and baseline.
- `backend/invaria/algorithm.py`: evidence gates are rule-specific. Register network rules explicitly; do not let them fall through to the generic source-evidence default.
- `backend/invaria/engine.py`: evidence verification checks text excerpts after application-oriented redaction. IOS credentials need a different redactor and a network verifier.
- `backend/invaria/storage.py`: the scan source is stored as a string and the report as JSON, which can accommodate a network payload. The required legacy repository column still needs deliberate compatibility handling.
- `frontend/app/workspace/page.tsx`: the graph filters around Route nodes and uses application lanes. Reuse review components but create a topology view and network-specific summaries.
- `backend/invaria/overview.py`, `reasoning.py`, and `rag.py`: inspect application assumptions before reuse; provide network prompts and curated network guidance. Until then, show a deterministic network overview.

## Proposed architecture

```text
PKT upload + optional requirements documents
  → bounded artifact ingestion + SHA-256
  → isolated decoder → validated XML
  → normalized network model + canonical configuration evidence
  → deterministic configuration rules + coverage ledger
  → optional evidence-bound Gemma review
  → network evidence verification
  → persisted report → topology / findings / review / export
```

Keep decoder, XML extraction, IOS parsing, and rules separate. Suggested modules under `backend/invaria/network/`: `decoder.py`, `extractor.py`, `models.py`, `ios.py`, `rules.py`, `evidence.py`, `pipeline.py`, and `worker.py`.

### API and persistence

Use a dedicated `POST /api/network-scans` multipart endpoint for the first release: exactly one `topology` upload, `use_model`, and optional `documents`. Return the existing 202 response shape and scan ID. Keep existing GitHub JSON requests stable. Network scans share the queue capacity and the existing GET, feedback, and export endpoints.

Persist `source="packet_tracer"`, `analysis_domain="network"`, `schema_version`, and an `artifact` object containing the sanitized display name, SHA-256, size, embedded Packet Tracer version, decoder identifier, and decoder commit. Initially populate the legacy `repository` column with the artifact display name; expose a generic `target` object in responses and render/export its label. Do not populate `commit` with the file hash.

The payload should include `network`, `graph`, `coverage`, `findings`, `algorithm`, and existing audit fields. Audit coverage must record parsed/unsupported devices, configuration availability/completeness, dropped or unresolved links, command families supported, and rules evaluated/skipped with reasons. Unknowns are explicit, not empty configuration values. Older application reports remain readable.

### Network model and evidence

Normalize stable device IDs, names, models, device classes, interfaces, addresses, VLANs, links, management settings, and available running/startup configurations. Add ACLs, routing, and NAT only as supported parsers mature. Preserve artifact-local IDs and XML locations; display names are not unique identifiers. Never collapse duplicate names or silently truncate incomplete configurations.

Use typed graph nodes such as Device, Interface, Subnet, VLAN, and later ACL; edges such as contains, physically_connected, and member_of. Physical links and inferred forwarding relationships must have distinct labels.

Materialize deterministic per-device text such as `network/devices/<stable-id>/running-config.txt`. Evidence retains the existing file/line/snippet fields, with additional provenance: artifact hash, device ID, config type, XML locator, and normalized-text hash. Lines refer to the extracted configuration, not the binary PKT. Topology-only rules need a separate canonical facts artifact and verifier.

Verify every reference against the immutable extracted snapshot before saving results. Add IOS-aware redaction for passwords, secrets, SNMP communities, and key material. Parse raw values only inside the worker; redact before model requests, logs, API responses, persistence, and exports. Use the same canonical redaction when verifying evidence. Persist bounded redacted evidence and provenance, then clean up raw PKT/XML/config artifacts on success and failure, matching current scan cleanup behavior.

### Resource controls

Initial proposed limits, subject to fixture measurements: one 10 MB PKT; 64 MB decoded XML; 500 devices; 2,000 links; 1 MB configuration per device; 120-second worker deadline. Stream uploads and enforce actual byte counts. Reject oversized output rather than silently analyzing a truncated topology. Bound XML depth, element count, and text size; disable DTDs, external entities, and external resource resolution. Decoder output is data only.

Use argument arrays and an owned temporary directory. Package the native library during installation/image build. The current Linux worker memory bound can be reused; a subprocess timeout alone does not bound memory on Windows, so enforce incremental output limits and evaluate a Windows Job Object for process-tree memory/termination control. Keep worker output bounded and error messages free of raw configurations.

## Detection roadmap

Start with positive, explicit configuration observations. Do not infer a missing security control from unsupported commands, omitted defaults, or partial configuration.

| Proposed rule | Minimum evidence | Claim and false-positive boundary |
| --- | --- | --- |
| NET001: Telnet allowed on VTY lines | Complete parsed VTY stanza and explicit transport command permitting Telnet | Insecure management transport is configured; this does not prove remote reachability |
| NET002: Explicit cleartext credential | Credential command and parsed storage type | Credential is stored in plaintext; redact its value; do not flag every secret hash as plaintext |
| NET003: SNMP community with write access | Full community command with RW permission | Write-capable community authentication is configured; report observed access restriction separately |

Cisco's SSH documentation recommends SSHv2 and restricting VTY transport to SSH; use it for management-rule guidance while checking what each simulated device supports. [Cisco SSH configuration guidance](https://www.cisco.com/c/en/us/support/docs/security-vpn/secure-shell-ssh/4145-ssh.html).

Useful inventory diagnostics such as invalid masks, duplicate addresses in a proven shared domain, or unresolved gateways should have a separate diagnostic classification, not automatically become security vulnerabilities. A private address on an interface is not proof of a trusted segment, and VLAN separation alone is not proof of isolation.

Second release: scoped network policies and bounded ACL reasoning. Example policy: Guest must not reach Finance; only Admin may access management interfaces. Report `allowed`, `blocked`, or `unknown` for a specified source, destination, protocol, and port. Evaluate ordered ACL entries, wildcard masks, implicit deny, interface attachment/direction, supported forwarding, return traffic, and NAT where implemented. Unhandled routing, stateful firewalls, or device semantics produce unknown. A cable path is never an attack-path proof.

For each network rule, define required evidence kinds and proven controls in `algorithm.py`. Require complete stanza evidence for absence claims. Optional Gemma review explains existing facts; it cannot invent devices, policies, reachability, or citations.

## Delivery gates and tests

1. **Decoder feasibility spike.** Collect consented, non-sensitive files saved by the actual Packet Tracer versions in use, targeting representative 7.x, 8.x, and 9.x samples where available. Include a router/switch LAN, VLAN trunk, ACL, endpoints, wireless/unsupported device, and malformed input. Compare extracted devices, links, and configs with Packet Tracer's own display. Test Windows and Linux. Exit: select and pin a decoder, document supported versions/device families, packaging, performance, and license obligations. If modern decoding fails, prototype on validated decoded XML/config inputs without advertising PKT support.
2. **Extraction and examiner.** Implement ingestion, worker, normalization, provenance, network overview, device inspector, topology view, and coverage. Exit: authentic samples match expected inventory; unknowns are visible; upload/poll/export works with zero findings.
3. **Evidence-backed rules.** Add NET001–NET003 with vulnerable/fixed fixture pairs, stanza parsing, IOS redaction, rule gates, and network guidance. Exit: positive and negative fixtures pass; fabricated evidence is rejected; no credential value reaches reports, model payloads, logs, or exports.
4. **Lifecycle and integration.** Verify queue-full behavior, restart recovery, worker crash/timeout, cleanup, human review persistence, old report rendering, and unchanged GitHub/document flows. Exit: relevant Python tests/lint, frontend build, and browser review pass; truncated files, decompression bombs, XML entity/depth attacks, duplicate IDs, and unresolved link endpoints fail safely or show explicit coverage gaps.
5. **Policy reasoning, separately scoped.** Only after reliable extraction, add reachability semantics and policy fixtures covering first-match ACL behavior, direction, wildcard masks, and unsupported-case unknowns. Exit: findings show the exact policy and bounded forwarding evidence behind the claim.

Suggested test locations: `tests/test_network_decoder.py`, `test_network_extraction.py`, `test_network_rules.py`, `test_network_api.py`, and `fixtures/network/`. Use authentic PKT fixtures for compatibility, normalized XML/config fixtures for deterministic rule tests, and synthetic encoded inputs only as additional decoder checks.

The first implementation task should be the decoder spike. Extraction fidelity and platform packaging are the largest unresolved dependencies; scheduling the full UI and reasoning work before that gate would risk building around an incompatible parser.
