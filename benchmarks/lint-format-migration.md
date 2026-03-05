# Linter & Formatter Migration Benchmark

## Environment

- Node: v24.12.0
- Machine: arm64 / Apple M4
- Codebase: ~3520 source files

## Before (ESLint + Prettier)

| Tool             | Run 1  | Run 2  | Run 3  | Median      |
| ---------------- | ------ | ------ | ------ | ----------- |
| ESLint (check)   | 86.22s | 96.85s | 67.77s | 86.22s      |
| Prettier (check) | 19.46s | 19.49s | 20.90s | 19.49s      |
| **Total**        |        |        |        | **105.71s** |

## After (oxlint + oxfmt)

| Tool                        | Run 1  | Run 2  | Run 3  | Median     |
| --------------------------- | ------ | ------ | ------ | ---------- |
| oxlint (check)              | 0.99s  | 0.72s  | 1.03s  | 0.99s      |
| oxlint --type-aware (check) | 13.62s | 11.56s | 10.01s | 11.56s     |
| oxfmt (check)               | 3.48s  | 3.28s  | 3.61s  | 3.48s      |
| **Total**                   |        |        |        | **16.03s** |

## Speedup

| Metric | Before  | After               | Speedup  |
| ------ | ------- | ------------------- | -------- |
| Lint   | 86.22s  | 11.56s (type-aware) | 7.5x     |
| Format | 19.49s  | 3.48s               | 5.6x     |
| Total  | 105.71s | 16.03s              | **6.6x** |

Note: oxlint without --type-aware runs in ~1s (87x faster than ESLint).
Type-aware mode is used in CI/turbo lint; pre-commit uses fast mode only.
