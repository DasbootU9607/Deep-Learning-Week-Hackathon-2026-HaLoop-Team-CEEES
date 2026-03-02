# Testbench

This folder satisfies the hackathon grading requirement for a `testbench/` directory with reproducible setup and run instructions.

## Files

- `setup-and-run.md`
  - step-by-step environment setup, launch flow, and automated checks
- `test-cases.md`
  - manual validation scenarios with expected outcomes

## Recommended Grader Path

1. Follow `setup-and-run.md` from top to bottom.
2. Run automated checks (`lint`, `build`, `test`) first.
3. Execute manual scenarios from `test-cases.md`.
4. Validate at least one approval path and one denial path.

## Scope Covered

- frontend + backend launch and connectivity
- IDE plugin approval integration
- risk-gated plan flow (low vs high risk)
- reviewer approve/deny actions
- incident-mode blocking behavior
- SQLite mirror persistence compatibility
- rollback via Dead Man's Switch
