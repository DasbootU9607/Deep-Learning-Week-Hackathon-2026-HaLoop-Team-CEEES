# Backend Eval Benchmarks

Generated at: 2026-03-07T11:28:04.158Z

| Variant | Provider | Schema Valid | High-Risk Recall | Approval Recall | False Positive Rate | Policy Hit Precision | Reason Coverage | Explanation Completeness | Avg Latency (ms) |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Before (baseline rules) | baseline | 100% | 80% | 80% | 0% | 89% | 33% | 61% | 1 |
| After (heuristic) | heuristic | 100% | 100% | 100% | 0% | 100% | 89% | 100% | 1 |

Run command:
`npm run eval:gate`
