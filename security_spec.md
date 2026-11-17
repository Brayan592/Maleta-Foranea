# Security Specification — Maleta Foránea

## 1. Data Invariants
1. **Strict Ownership**: Every document (`UserProfile`, `Garment`, `Trip`, `Movement`) resides under `/users/{userId}` and can only be read, queried, created, updated, or deleted by `request.auth.uid == userId`.
2. **Parent Existence (Master Gate)**: `Garment`, `Trip`, and `Movement` documents cannot be created unless `/users/{userId}` already exists.
3. **PII Isolation**: `/users/{userId}` contains `email` and `displayName`. `allow list` is strictly `false` on `/users`, and `allow get` is restricted strictly to the owner.
4. **Immutable Audit Fields**: `ownerId` (or `uid`) and `createdAt` can never change after creation. `Movement` records are strictly append-only (`allow update: if false`).
5. **Terminal State Locking**: Once a `Trip` reaches `status == 'completado'`, it is locked from further updates.
6. **Temporal Integrity**: `createdAt` on create and `updatedAt` on create/update must equal `request.time`.
7. **Origin != Destination**: A `Trip` must connect two distinct locations (`ciudad` -> `rancho` or `rancho` -> `ciudad`).
8. **Strict Key & Size Bounds**: Every write validates exact required/allowed keys, enum values, string lengths, and bounded arrays (`<= 100` IDs).

## 2. The "Dirty Dozen" Attack Payloads (All Must Return PERMISSION_DENIED)
1. **Cross-User Read**: Authenticated user B attempts `get` on `/users/userA/garments/g1`.
2. **User Directory Scraping**: Authenticated user A attempts `list` on `/users`.
3. **Identity Spoofing on Create**: User A tries creating `/users/userA/garments/g1` with `ownerId: "userB"`.
4. **Shadow Ghost Field Injection**: User A creates a garment with an extra undocumented field `isAdmin: true`.
5. **Unverified Email Write**: User with `email_verified: false` attempts to create a garment.
6. **Client-Forged Timestamp**: User A sets `createdAt` to a past date instead of `serverTimestamp()` (`request.time`).
7. **Immutable Field Tampering**: User A updates a garment and attempts to modify `createdAt` or `ownerId`.
8. **Resource Exhaustion (1MB String)**: User A submits a garment `name` of 10,000 characters (`> 80`).
9. **ID Poisoning**: User A writes to `/users/userA/garments/invalid$id!with*bad_chars`.
10. **Terminal Trip Mutation**: User A attempts to update a trip whose `status` is already `'completado'`.
11. **Same-Origin Trip Paradox**: User A tries creating a trip with `origin: 'ciudad'` and `destination: 'ciudad'`.
12. **Movement Ledger Rewrite**: User A attempts to `update` an existing document in `/users/userA/movements/m1`.
