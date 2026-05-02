# PGHub Backend Collections

These are the core MongoDB collections now used:

1. `users`
2. `ownerprofiles`
3. `pgproperties`
4. `beds`
5. `bookings`
6. `payments`
7. `rentcycles`
8. `tickets`
9. `auditlogs`

## Why this is "proper"

- Covers authentication and role separation (`users`)
- Covers owner verification + commission (`ownerprofiles`)
- Covers inventory structure (`pgproperties`, `beds`)
- Covers booking/payment lifecycle (`bookings`, `payments`)
- Covers monthly rent operations (`rentcycles`)
- Covers support and escalation (`tickets`)
- Covers compliance and traceability (`auditlogs`)

## Seed Command

From `pghub-backend`:

```bash
npm run seed
```

The seed inserts demo users and one PG with multiple beds, plus booking/payment/ticket/rent-cycle/audit samples.

## Seed Login Credentials

- Admin: `9000000001` / `Pass@123`
- Owner: `9000000002` / `Pass@123`
- User: `9000000003` / `Pass@123`
