# Code Review Examples

## Example 1: Authentication Module Review

### Command
```
@code-review Review the authentication module for security vulnerabilities
```

### Agent Response
```markdown
## Code Review Report - Authentication Module

### Summary
- **Files Reviewed**: 5
- **Total Issues**: 7
- **Security Issues**: 3
- **Must Fix**: 3

### Security Assessment 🔒
**Security Score**: 65/100
- Authentication: ⚠️ Needs improvement
- Authorization: ✅ Pass
- Input Validation: ❌ Critical issues
- Encryption: ✅ Pass

### Critical Issues 🔴

#### 1. SQL Injection Vulnerability
**File**: `src/auth/userService.js`
**Line 45**:
```javascript
const user = await db.query(
  `SELECT * FROM users WHERE email = '${email}'`
);
```
**Issue**: Direct string interpolation in SQL query
**Recommendation**: Use parameterized queries
**Fix**:
```javascript
const user = await db.query(
  'SELECT * FROM users WHERE email = ?',
  [email]
);
```

#### 2. Weak Password Hashing
**File**: `src/auth/passwordUtils.js`
**Line 12**:
```javascript
const hashedPassword = crypto
  .createHash('sha256')
  .update(password)
  .digest('hex');
```
**Issue**: SHA-256 is not suitable for password hashing
**Recommendation**: Use bcrypt or argon2
**Fix**:
```javascript
import bcrypt from 'bcrypt';
const hashedPassword = await bcrypt.hash(password, 10);
```

#### 3. Missing Rate Limiting
**File**: `src/routes/auth.js`
**Line 23**:
```javascript
router.post('/login', async (req, res) => {
  // No rate limiting implemented
```
**Issue**: Vulnerable to brute force attacks
**Fix**:
```javascript
import rateLimit from 'express-rate-limit';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts
  message: 'Too many login attempts'
});

router.post('/login', loginLimiter, async (req, res) => {
```

### Major Issues 🟠

1. **No CSRF Protection**
   - Add CSRF tokens to state-changing requests

2. **Session Management**
   - Sessions never expire
   - Implement session timeout

### Positive Observations ✅
- JWT tokens properly signed
- HTTPS enforced
- Input sanitization on most fields
```

## Example 2: API Endpoint Review

### Command
```
@code-review Check performance and error handling in the data processing API
```

### Agent Response
```markdown
## Code Review Report - Data Processing API

### Performance Metrics
- Complexity Score: 8/10 (High)
- Database Queries: N+1 problem detected
- Memory Usage: Potential leak identified

### Critical Performance Issue 🔴

#### N+1 Query Problem
**File**: `src/api/dataProcessor.js`
**Lines 34-42**:
```javascript
const results = [];
for (const item of items) {
  const details = await db.query(
    'SELECT * FROM details WHERE item_id = ?',
    [item.id]
  );
  results.push({ ...item, details });
}
```

**Impact**: 100 items = 101 database queries
**Fix**: Use JOIN or batch query
```javascript
const itemIds = items.map(item => item.id);
const details = await db.query(
  'SELECT * FROM details WHERE item_id IN (?)',
  [itemIds]
);

const detailsMap = details.reduce((acc, detail) => {
  acc[detail.item_id] = detail;
  return acc;
}, {});

const results = items.map(item => ({
  ...item,
  details: detailsMap[item.id]
}));
```

### Error Handling Issues 🟠

#### 1. Unhandled Promise Rejection
**File**: `src/api/dataProcessor.js`
**Line 67**:
```javascript
processData(data).then(result => {
  cache.set(key, result);
});
```
**Fix**:
```javascript
processData(data)
  .then(result => {
    cache.set(key, result);
  })
  .catch(error => {
    logger.error('Data processing failed:', error);
    // Handle error appropriately
  });
```

#### 2. Generic Error Messages
**Line 89**:
```javascript
catch (error) {
  res.status(500).json({ error: 'Something went wrong' });
}
```
**Recommendation**: Provide specific, safe error messages
```javascript
catch (error) {
  logger.error('API Error:', error);

  if (error.code === 'VALIDATION_ERROR') {
    return res.status(400).json({
      error: 'Invalid input data',
      details: error.validationErrors
    });
  }

  res.status(500).json({
    error: 'Internal server error',
    reference: error.id // For support tracking
  });
}
```

### Memory Leak 🔴
**Line 102**:
```javascript
global.processCache = global.processCache || [];
global.processCache.push(largeDataSet);
```
**Issue**: Global array grows indefinitely
**Fix**: Implement proper caching with size limits
```

## Example 3: React Component Review

### Command
```
@code-review Review React component for performance and best practices
```

### Agent Response
```markdown
## Code Review Report - UserDashboard Component

### React Best Practices Assessment
- Hooks Usage: ⚠️ Issues found
- Performance: ❌ Optimization needed
- Accessibility: ✅ Good

### Critical Issues 🔴

#### 1. useEffect Dependency Array Missing
**File**: `src/components/UserDashboard.jsx`
**Line 23**:
```jsx
useEffect(() => {
  fetchUserData(userId);
  calculateMetrics(data);
}, []); // Missing dependencies
```
**Issue**: Effect won't re-run when userId or data changes
**Fix**:
```jsx
useEffect(() => {
  fetchUserData(userId);
}, [userId]);

useEffect(() => {
  if (data) {
    calculateMetrics(data);
  }
}, [data]);
```

#### 2. Expensive Calculation in Render
**Line 45**:
```jsx
function UserDashboard({ users }) {
  const sortedUsers = users.sort((a, b) => b.score - a.score);
  // This runs on every render!
```
**Fix**: Use useMemo
```jsx
function UserDashboard({ users }) {
  const sortedUsers = useMemo(
    () => [...users].sort((a, b) => b.score - a.score),
    [users]
  );
```

### Performance Issues 🟠

#### 1. Missing React.memo
```jsx
// Current
export default UserCard;

// Optimized
export default React.memo(UserCard);
```

#### 2. Inline Function Props
**Line 67**:
```jsx
<ChildComponent
  onClick={() => handleClick(item.id)}
/>
```
**Fix**: Use useCallback
```jsx
const handleItemClick = useCallback(
  (id) => handleClick(id),
  [handleClick]
);

<ChildComponent onClick={handleItemClick} />
```

### Code Quality Issues 🟡

1. **State Updates in Loop**
```jsx
// Bad
items.forEach(item => {
  setCount(prev => prev + item.value);
});

// Good
const total = items.reduce((sum, item) => sum + item.value, 0);
setCount(total);
```

2. **Direct State Mutation**
```jsx
// Bad
const newUser = user;
newUser.name = 'New Name';
setUser(newUser);

// Good
setUser({ ...user, name: 'New Name' });
```
```

## Example 4: Python Service Review

### Command
```
@code-review Review Python service for type safety and error handling
```

### Agent Response
```markdown
## Code Review Report - Payment Processing Service

### Python Best Practices
- Type Hints: 60% coverage
- Error Handling: Needs improvement
- Testing: 75% coverage

### Critical Issues 🔴

#### 1. Missing Type Hints
**File**: `services/payment_processor.py`
**Line 15**:
```python
def process_payment(amount, user, metadata):
    # No type information
```
**Fix**:
```python
from typing import Dict, Any, Optional
from decimal import Decimal

def process_payment(
    amount: Decimal,
    user: User,
    metadata: Optional[Dict[str, Any]] = None
) -> PaymentResult:
```

#### 2. Broad Exception Handling
**Line 34**:
```python
try:
    result = external_api.charge(amount)
except Exception:
    return None
```
**Issue**: Catching all exceptions hides bugs
**Fix**:
```python
try:
    result = external_api.charge(amount)
except APIError as e:
    logger.error(f"Payment API error: {e}")
    raise PaymentFailedError(f"Payment failed: {e.message}")
except ConnectionError as e:
    logger.error(f"Connection error: {e}")
    raise ServiceUnavailableError("Payment service unavailable")
```

### Security Issues 🔴

#### Sensitive Data in Logs
**Line 56**:
```python
logger.info(f"Processing payment: {credit_card_number}")
```
**Fix**:
```python
# Mask sensitive data
masked_card = f"****{credit_card_number[-4:]}"
logger.info(f"Processing payment: {masked_card}")
```

### Performance Issues 🟠

#### Synchronous I/O in Async Context
**Line 78**:
```python
async def handle_payment(request):
    # This blocks the event loop!
    result = requests.post(payment_url, data=data)
```
**Fix**:
```python
import aiohttp

async def handle_payment(request):
    async with aiohttp.ClientSession() as session:
        async with session.post(payment_url, json=data) as response:
            result = await response.json()
```
```

## Example 5: Database Migration Review

### Command
```
@code-review Review database migration for safety and rollback capability
```

### Agent Response
```markdown
## Code Review Report - Database Migration

### Migration Safety Check
- Reversibility: ❌ Not reversible
- Data Loss Risk: 🔴 HIGH
- Performance Impact: 🟠 MEDIUM

### Critical Issues 🔴

#### 1. Irreversible Migration
**File**: `migrations/20240115_user_table.sql`
```sql
-- Up migration
ALTER TABLE users DROP COLUMN legacy_id;

-- Down migration
-- Cannot restore dropped column!
```
**Fix**: Save data before dropping
```sql
-- Up migration
ALTER TABLE users RENAME COLUMN legacy_id TO _deprecated_legacy_id;

-- Down migration
ALTER TABLE users RENAME COLUMN _deprecated_legacy_id TO legacy_id;
```

#### 2. No Transaction Wrapping
```sql
ALTER TABLE users ADD COLUMN status VARCHAR(50);
UPDATE users SET status = 'active';
ALTER TABLE users ALTER COLUMN status SET NOT NULL;
```
**Fix**: Wrap in transaction
```sql
BEGIN;
ALTER TABLE users ADD COLUMN status VARCHAR(50);
UPDATE users SET status = 'active';
ALTER TABLE users ALTER COLUMN status SET NOT NULL;
COMMIT;
```

#### 3. Missing Index for Foreign Key
```sql
ALTER TABLE orders
ADD COLUMN user_id INTEGER REFERENCES users(id);
```
**Fix**: Add index
```sql
ALTER TABLE orders
ADD COLUMN user_id INTEGER REFERENCES users(id);

CREATE INDEX idx_orders_user_id ON orders(user_id);
```

### Performance Concerns 🟠

#### Large Table UPDATE Without Batching
```sql
UPDATE users SET normalized_email = LOWER(email);
```
**For large tables, use batching**:
```sql
DO $$
DECLARE
  batch_size INT := 1000;
  offset_val INT := 0;
BEGIN
  LOOP
    UPDATE users
    SET normalized_email = LOWER(email)
    WHERE id IN (
      SELECT id FROM users
      WHERE normalized_email IS NULL
      LIMIT batch_size
    );

    EXIT WHEN NOT FOUND;

    -- Allow other transactions
    PERFORM pg_sleep(0.1);
  END LOOP;
END $$;
```
```

## Common Review Commands

### Security Focus
```bash
@code-review Security audit for [module]
@code-review Check for SQL injection vulnerabilities
@code-review Review authentication implementation
@code-review Validate input sanitization
```

### Performance Focus
```bash
@code-review Check for N+1 queries
@code-review Review algorithm complexity
@code-review Analyze memory usage
@code-review Check caching strategy
```

### Best Practices
```bash
@code-review Check test coverage
@code-review Review error handling
@code-review Validate type safety
@code-review Check documentation completeness
```