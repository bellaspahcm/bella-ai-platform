# Executed command results

Values below are transcribed from actual command/tool exits in this execution session. Dedicated raw logs/envelopes are named where available; this journal is not a substitute for those raw outputs.

| Command / scope | Actual exit | Retained evidence |
| --- | --- | --- |
| Supabase RPC catalog SELECT | 0 | `rpc-pre-cli.json` |
| Supabase selected table catalog SELECT | 0 | `tables-pre-cli.json` |
| Production/source identity check | 0 | `production-identity.json` |
| Native local initdb / pg_ctl start | 0 / 0 | `local-init.log`, execution session |
| Local selected-table bootstrap | 0 | `rehearsal-bootstrap.json`, `rehearsal-pre-fingerprint.json` |
| Local RPC bootstrap attempt 1 | 1 | Session error: `role name "pg_checkpoint" is reserved`; transaction rolled back |
| Local RPC bootstrap after scaffold correction | 0 | `rehearsal-rpc-pre.json`; exact fingerprint match |
| Combined-artifact table/transaction rehearsal | 0 | `rehearsal-command.log`, `rehearsal-result.json`, 12 PASS |
| RPC/recovery rehearsal attempt 1 | 1 | `rehearsal-rpc-attempt1.log`; ACL ordering mismatch |
| RPC/recovery rehearsal after recovery-order correction | 0 | `rehearsal-rpc-command.log`, `rehearsal-rpc-result.json`, six PASS |
| Before HTTP attempts 1 / 2 | 1 / 1 | `http-before-attempt1.log`, `http-before-attempt2.log`; Courses timeout, not PASS |
| Completed before HTTP verification | 0 | `http-before-command.log`, `http-before.json` |
| Final combined pre-catalog SELECT | 0 | `final-pre-both-cli.json` |
| Outside normalized pre-catalog SELECT | 0 | `outside-pre-normalized-cli.json` |
| **Approved production COMMIT artifact** | **0** | `production-execution.json`, `production-execution-cli.json`, `production-execution-stderr.log` |
| Independent combined post-catalog SELECT | 0 | `post-catalog-cli.json` |
| Independent service/authenticated role checks | 0 | `positive-roles-cli.json` |
| Individually retained authenticated role check | 0 | `positive-authenticated-cli.json` |
| Outside post-catalog SELECT | 0 | `outside-post-cli.json` |
| Exact before/after expected-delta comparison | 0 | `catalog-verification.json` |
| Completed after HTTP verification | 0 | `http-after-command.log`, `http-after.json`; 96/96 anonymous table requests denied |

All production catalog/positive-role verification SQL uses READ ONLY transactions and ends in ROLLBACK. The one separately approved production execution artifact uses an explicit COMMIT and only ACL statements. RPC runtime probes contain only the constant `SELECT 1`; no production business-row contents are retained. No production RPC/schema/data repair command or broad migration history was executed.
