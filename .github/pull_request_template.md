## Summary

<!-- What changed and why, in a few lines. -->

## Jira

SCRUM-<!-- n -->

## Authorization impact

<!-- Tables, RPCs, policies, grants or Edge Functions touched, and how access changes. Write "none" if nothing. -->

## Negative tests added

<!-- pgTAP / unit tests proving the forbidden action fails (actor → attempt → expected). Write "n/a" with a reason if none. -->

## RTL / LTR checked

- [ ] English (LTR) checked
- [ ] Arabic (RTL) checked: layout mirrors, logo and numbers do not

## Screenshots

<!-- English and Arabic, desktop and 360 px mobile, for any UI change. -->

## Definition of Done

- [ ] Database migration written, reviewed and applied to development
- [ ] Server-side authorization enforced (RLS / RPC / Edge Function)
- [ ] Validation implemented on client and in the database
- [ ] Loading, empty and error states handled
- [ ] Arabic RTL and English LTR considered and checked
- [ ] Happy-path tests pass
- [ ] Unauthorized-access tests pass
- [ ] No open critical defects
- [ ] Generated types up to date; CI green
- [ ] Documentation updated (permissions matrix, decisions, changelog)
