# Assessment validation

Validated on 2026-10-26 using one local Uvicorn worker and at most 10 SQLAlchemy database connections. The hosted run used the configured Supabase Free project through its transaction pooler.

## Concurrent sitting results

80 students authenticated, loaded the same exam, started simultaneously, answered 50 questions each in five batches, checked saved state, and submitted simultaneously over real HTTP. Temporary schemas isolated the synthetic students from public application data and were removed afterward.

| Measurement | Local PostgreSQL 17 | Supabase Free |
| --- | --- | --- |
| Concurrent students | 80 | 80 |
| Questions per student | 50 | 50 |
| HTTP requests | 880 | 880 |
| Unrecovered request failures | 0 | 0 |
| Whole synthetic sitting (seconds) | 19.72 | 97.792 |
| Persisted answers | 4,000 | 4,000 |
| Correct final scores | 80 of 80 | 80 of 80 |
| Transient retries in final hosted run | — | 0 |

| Operation | Local p95 (ms) | Supabase p95 (ms) |
| --- | --- | --- |
| Login | 1,073.54 | 5,072.68 |
| Dashboard | 1,145.32 | 6,878.29 |
| Start | 6,717.18 | 17,253.73 |
| Questions | 5,293.10 | 14,504.49 |
| Autosave | 1,638.70 | 8,878.29 |
| Status | 1,778.80 | 8,721.44 |
| Submit | 3,761.17 | 16,690.04 |

The compressed hosted sitting completed in 97.792 seconds. Its start p95 was 17.254 seconds and submission p95 was 16.690 seconds. These values include contention from deliberately synchronized requests. Ordinary exam answering is distributed across the configured exam duration. An earlier hosted run hit a transient database connection failure; reads and idempotent student operations now have bounded retries. The final hosted run needed no retries.

A separate local PostgreSQL test raced twelve starts and twelve submissions for one student. All starts returned the same attempt and all submissions returned the same final score.

## Regression and live verification

All 24 backend tests passed locally. Regression and migration tests were rerun after the test-isolation changes. Coverage includes both question selection modes, exam editing, assignment replacement, code rotation, ownership, deadlines, mark snapshots, deferred review, atomic answer batches, constant-query exam listing, URL normalization, migration preservation, local-data transfer and concurrent HTTP requests. Frontend production build, lint, answer-queue tests and retry-policy tests passed.

The running Supabase-backed public application also passed a smoke check for readiness, administrator login, the linked 50-question DSA bank, manual exam creation, editing, student assignment/removal and code generation. The temporary draft exam was deleted after verification. The existing student, DSA subject and 50 questions were preserved when moving from SQLite to Supabase.

## Practical limits

The backend used for these tests ran locally. A deployed backend may have different CPU, memory, cold-start and network performance. The hosted result establishes successful completion on this Supabase Free database under this measured workload; it does not guarantee latency or availability for every deployment. Rehearse the final hosted backend before a scheduled examination.

Student sessions share short transactions rather than holding database connections for the full exam. The application uses bounded pools, snapshots, row locks, uniqueness constraints, batched updates, aggregate scoring, ordered answer saves and atomic submission. Extra Uvicorn workers multiply the pool limit.

Supabase application tables have RLS enabled without browser-access policies; FastAPI uses the backend owner connection. Credentials remain in the ignored backend `.env`. Runtime uses the IPv4 transaction pooler on port 6543; migrations use the session pooler on port 5432. See [Supabase connection modes](https://supabase.com/docs/guides/database/connecting-to-postgres).
