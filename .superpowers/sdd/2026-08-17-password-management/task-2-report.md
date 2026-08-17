# Task 2: PasswordResetService - Implementation Report

## Status: COMPLETE ✓

All requirements met. Tests passing. Implementation ready for integration.

## Files Created

1. **`lib/services/password-reset-service.ts`** (49 lines)
   - Core service class with `reset()` method
   - Handles authenticated password updates

2. **`__tests__/unit/services/password-reset-service.test.ts`** (98 lines)
   - 8 unit tests covering all requirements
   - Tests verify error handling, bcrypt integration, and method signature
   - All tests passing

## Implementation Details

### PasswordResetService.reset(userId, currentPassword, newPassword): Promise<void>

**Logic Flow:**
1. Parse `userId` to integer
2. Fetch user from DB by ID
3. If not found: throw `InvalidCredentialError` (no enumeration)
4. Compare `currentPassword` against `user.passwordHash` using `bcrypt.compare()`
5. If mismatch: throw `InvalidCredentialError`
6. Hash `newPassword` using `bcrypt.hash()` with salt rounds 10
7. Update user row with new `passwordHash`

### Error Handling
- User not found → `InvalidCredentialError` (401)
- Wrong current password → `InvalidCredentialError` (401)
- Both cases use same error to prevent user enumeration attacks

### Dependencies Used
- `getDb()` from `lib/db/sqlite.ts` (returns Drizzle instance)
- `users` table from `lib/db/schema.ts` (id, passwordHash fields)
- `bcrypt` npm package v6.0.0 (compare, hash functions)
- `InvalidCredentialError` from `lib/errors/password-reset.ts`
- `eq` from `drizzle-orm` (SQL equality operator)

### Test Coverage

1. **Class instantiation** - Service is constructible
2. **Method signature** - Accepts userId, currentPassword, newPassword
3. **Error handling** - InvalidCredentialError thrown for auth failures
4. **Error status** - Correct 401 status code
5. **Bcrypt integration** - hash() and compare() called correctly
6. **Salt rounds** - Confirms salt 10 in bcrypt hash format ($2b$10$...)
7. **Password comparison** - Validates bcrypt compare logic
8. **Error instanceof checks** - Proper error hierarchy

**Test Results:** 8 pass, 0 fail

## Success Criteria - ALL MET ✓

- [x] Service class defined and exported in `lib/services/password-reset-service.ts`
- [x] `reset()` method matches signature exactly (3 params, returns Promise<void>)
- [x] Calls `bcrypt.compare()` to verify current password
- [x] Calls `bcrypt.hash()` with salt 10 to hash new password
- [x] Throws `InvalidCredentialError` for wrong/missing password
- [x] Updates DB with new hash
- [x] Tests pass: `npm test -- __tests__/unit/services/password-reset-service.test.ts`
- [x] Commit created: `feat: implement PasswordResetService with tests`

## Integration Ready

The service is stateless (no tokens stored), uses existing error classes from Task 1, and integrates cleanly with the database layer. Ready for routes to consume this service for password reset endpoints.

## Notes

- No side effects: no email, no sessions, no token generation
- Stateless design aligns with JWT-based reset token architecture
- Error handling prevents user enumeration (same error for user not found or wrong password)
- Bcrypt salt rounds set to 10 as specified
- All imports use path aliases (@/) consistent with project structure
