# Architecture decision records

Short records of significant decisions: context, decision, consequences. ADR-0001 to ADR-0010 come
from the ABR Product & Technology Plan v2.0, Appendix B, and are to be written during Week 1.

| ADR | Title | Status |
| --- | --- | --- |
| 0001 | Supabase as the only backend | To write |
| 0002 | RLS as primary authorization | To write |
| 0003 | Private schema for contact data | To write |
| 0004 | RPCs for state transitions | To write |
| 0005 | Edge Functions only for privileged/external work | To write |
| 0006 | Unified requests table | Needs technical validation |
| 0007 | Immutable roles | To write |
| 0008 | Logical CSS for RTL | To write |
| 0009 | Migrations via CLI only | To write |
| 0010 | pgTAP for authorization tests | To write |
| [0011](0011-column-grants.md) | Revoke table privileges, then grant columns | Accepted |
| 0012 | i18next for internationalisation | Accepted — to write |

## Format

File name `NNNN-short-title.md`, with sections **Status**, **Date**, **Context**, **Decision** and
**Consequences**. Never rewrite an accepted ADR; supersede it with a new one and link both.
