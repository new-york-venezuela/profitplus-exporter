# Task 9 Implementation Report: POST /api/auth/password-reset/[token]

## Status: COMPLETE ✓

All requirements met. Route implemented and tested. Integration tests passing.

## Files Created/Modified

### Created
- **`app/api/auth/password-reset/[token]/route.ts`** (107 lines)
  - Dynamic route handler for token-based password reset
  - Unauthenticated endpoint for completing forgot password flow

### Modified
- **`__tests__/integration/password-reset-routes.integration.test.ts`**
  - Added helper function `callTokenPasswordResetEndpoint()` for testing
  - Added 4 integration tests for token-based reset scenarios
  - Database mocking for test isolation

## Implementation Details

### Route Handler: POST /api/auth/password-reset/[token]

**Signature:**
```typescript
export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
)
```

**Configuration:**
- `export const dynamic = 'force-dynamic'` — ensures fresh execution
- POST method only

**Logic Flow:**
1. Extract `token` from route params
2. Validate token presence → 400 if missing
3. Parse request body JSON
4. Extract and validate `newPassword`:
   - Must be string
   - Must be at least 8 characters
   - Returns 400 with error message if invalid
5. Verify token using `verifyToken()`:
   - Returns 401 if expired/invalid
   - Catches `TokenExpiredError` explicitly
6. Extract `userId` from JWT payload's `sub` claim
7. Hash new password with bcrypt salt 10
8. Update user password in database by userId
9. Return 200 with `{ ok: true, message: 'Password reset successful' }`

**Error Handling:**
- 400: Missing token, missing/invalid password
- 401: Expired/invalid token (TokenExpiredError)
- 500: Database or bcrypt errors

### Database Interaction
- Uses `getDb()` to get Drizzle database instance
- Queries `users` table by `id` (parsed from userId string)
- Updates `passwordHash` field with bcrypt-hashed password
- Uses Drizzle ORM `eq()` for WHERE clause

### Security
- Token verification via JWT signature validation
- Password hashing with bcrypt (salt 10, same as Task 2)
- No user enumeration (no different error messages based on user existence)
- Stateless: no session creation, token validation only

## Tests Added

### Integration Test Suite

Added 4 tests to `__tests__/integration/password-reset-routes.integration.test.ts`:

1. **"password updated with valid token"** (line 307)
   - Creates mock user with old password
   - Generates valid reset token
   - Calls endpoint with new password
   - Verifies 200 response with success message
   - Verifies password actually updated in mock database

2. **"returns 401 with expired token"** (line 344)
   - Creates JWT with immediate expiry (JWT_EXPIRY_DAYS=0)
   - Waits for token to expire
   - Calls endpoint with expired token
   - Verifies 401 response with "Token expired or invalid"

3. **"returns 400 when password too short"** (line 374)
   - Creates valid token
   - Calls endpoint with 4-character password
   - Verifies 400 response with error message

4. **"returns 400 when token is missing"** (line 393)
   - Calls endpoint with empty token parameter
   - Verifies 400 response with "Token is required"

### Test Infrastructure
- Helper function mocks `getDb()` to return in-memory mock database
- Mock database updates `mockUsers` object for verification
- Uses existing `signToken()` and `verifyToken()` from auth module
- Uses real bcrypt for password hashing/comparison
- All tests isolated; no side effects between tests

## Test Results

**Command:** `npm test -- __tests__/integration/password-reset-routes.integration.test.ts`

**Output:**
```
bun test v1.3.14 (0d9b296a)

 20 pass
 0 fail
 45 expect() calls
Ran 20 tests across 1 file. [288.00ms]
```

**Coverage:**
- ✅ Valid token → password updated (200)
- ✅ Expired token → 401
- ✅ Short password → 400
- ✅ Missing token → 400
- ✅ Route exports POST function
- ✅ Route exports `dynamic = 'force-dynamic'`
- ✅ Password validation edge cases (7 vs 8 chars)
- ✅ All password reset authenticated endpoint tests (inherited)
- ✅ Forgot password endpoint tests (inherited)
- ✅ Email verification tests (inherited)

All 20 integration tests pass with 0 failures.

## Compliance with Brief

| Requirement | Status | Notes |
|-------------|--------|-------|
| Route file at correct path | ✅ | `app/api/auth/password-reset/[token]/route.ts` |
| POST handler with correct signature | ✅ | Matches spec exactly |
| Extract token from route params | ✅ | Uses `params.token` |
| Validate password (min 8 chars) | ✅ | Returns 400 if invalid |
| Call verifyToken() | ✅ | With proper error handling |
| Hash password with bcrypt salt 10 | ✅ | `bcrypt.hash(newPassword, 10)` |
| Update user password in DB | ✅ | Uses Drizzle ORM update |
| Return 200 with success response | ✅ | `{ ok: true, message: '...' }` |
| Return 401 for expired token | ✅ | Catches TokenExpiredError |
| Return 400 for validation failures | ✅ | Password too short, token missing |
| force-dynamic configuration | ✅ | `export const dynamic = 'force-dynamic'` |
| Integration tests pass | ✅ | All 4 token-based tests pass |
| Commit message | ✅ | `feat: implement password reset with token endpoint` |

## Concerns

None. Implementation complete, secure, and well-tested.

## Commit

- **Hash:** `38c140b`
- **Message:** `feat: implement password reset with token endpoint`
- **Files Changed:** 23 (includes task documentation from prior tasks)
- **Core Changes:** 
  - 1 new route file (107 lines)
  - Integration tests extended with 4 new tests + helper function
