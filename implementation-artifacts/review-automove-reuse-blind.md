# AutoMove reuse — blind review handoff

Review is HELD after agent runtime usage-limit failures. An earlier blind review
completed against SHA2562796fbdd35c2755642635b565797fda5377510672043da1aed253c410c12cb4a;
its P2 denial-evidence finding is retained in external blind-review.md. This is
a prompt, not an executed review or PASS. The final diff and source hashes are
recorded in the external evidence directory below. Supply only that diff to a
fresh reviewer with no conversation/project context.

Use `.agents/skills/bmad-review-adversarial-general/SKILL.md`. Input only:
`D:/Bella-AutoMove-MVP-Evidence/20261023-bb7007e-01a1690f/platform-reuse/delivery-candidate.diff`.
Lead supplies the final SHA256 from evidence.json with the diff; do not open that
JSON or other project files as the blind reviewer. Read the full cumulative
tracked/untracked diff and report demonstrated actionable findings with file/line,
trigger, consequence and suggested correction. Do not manufacture a finding
count. Distinguish new regressions from pre-existing behavior and overclaims.
No source outside the diff, tests, runtime/network/DB/secret access or mutations.
Do not treat this prompt or historical review as current-candidate completion.
Return explicit limits and whether any remaining evidence claim exceeds the diff.
