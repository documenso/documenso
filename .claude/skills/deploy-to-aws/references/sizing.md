# Sizing Tiers

Map the user's answer in step 2d to concrete CFN parameters. All three tiers are production-viable — the differences are headroom and redundancy. Rough monthly AWS costs in us-east-1, excluding data transfer and S3 storage of documents.

Documenso is lighter than most web apps — it's mostly idle, PDF rendering is bursty, signing requests are low-volume. Small is fine for most teams.

## Small — up to ~50 users (default)

Cheapest usable deploy. Single Fargate task, so brief downtime during deploys and task restarts.

| CFN parameter | Value |
|---------------|-------|
| `DbInstanceClass` | `t4g.micro` |
| `DbStorageGb` | `20` |
| `FargateCpu` | `512` |
| `FargateMemory` | `1024` |
| `DesiredCount` | `1` |

**Est. monthly cost: ~$40–60/month**
(RDS t4g.micro + 20 GB: ~$17, Fargate 1×0.5 vCPU/1 GB: ~$15, ALB: ~$18, S3 + misc: negligible.)

## Medium — up to ~250 users

Comfortable for most small companies. Two Fargate tasks, rolling deploys stay available.

| CFN parameter | Value |
|---------------|-------|
| `DbInstanceClass` | `t4g.small` |
| `DbStorageGb` | `50` |
| `FargateCpu` | `1024` |
| `FargateMemory` | `2048` |
| `DesiredCount` | `2` |

**Est. monthly cost: ~$80–120/month**

## Large — heavy signing volume or many concurrent users

Room to grow. Consider enabling RDS Multi-AZ (requires editing `infra/lib/constructs/database.ts` — not exposed as a CFN parameter).

| CFN parameter | Value |
|---------------|-------|
| `DbInstanceClass` | `m7g.large` |
| `DbStorageGb` | `100` |
| `FargateCpu` | `2048` |
| `FargateMemory` | `4096` |
| `DesiredCount` | `3` |

**Est. monthly cost: ~$250–400/month**

## Picking a tier

- Unsure? Start with **small**. Documenso handles occasional spikes fine. Scale up as needed (stack update; no downtime for CPU/memory/count, brief RDS restart for class changes).
- If you know you'll drive high volume (thousands of signings/month, many concurrent sessions): **medium or large**.

## Customizing

Pass any of the CFN parameters directly at deploy time. Valid combinations:

- `FargateCpu` ∈ {256, 512, 1024, 2048, 4096}
- `FargateMemory` must be compatible with CPU per [Fargate sizing matrix](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task-cpu-memory-error.html)
