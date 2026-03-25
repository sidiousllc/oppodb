# MNFinancePanel SSRF Mitigation Tests

## Overview
This document describes the unit tests for the SSRF (Server-Side Request Forgery) mitigation implemented in `src/components/MNFinancePanel.tsx`.

## Test File
`src/test/mn-finance-panel-ssrf.test.ts`

## What is Being Tested
The `buildValidatedUrl` function (lines 52-92 in MNFinancePanel.tsx) which constructs URLs for fetching Minnesota Campaign Finance Board data from Supabase edge functions.

## Security Vulnerability Addressed
**Type:** SSRF (Server-Side Request Forgery)  
**Location:** Line 290 in MNFinancePanel.tsx  
**Risk:** If an attacker could control the URL input, they could potentially make the application send requests to arbitrary internal or external systems.

## Mitigation Strategy
The fix implements multiple layers of defense:

1. **Project ID Validation**: Validates that the project ID contains only alphanumeric characters, hyphens, and underscores (`^[A-Za-z0-9_-]+$`)
2. **Domain Allowlisting**: Ensures the final hostname is a subdomain of `supabase.co`
3. **Protocol Restriction**: Only allows `http:` and `https:` protocols
4. **Safe Query Parameter Handling**: Uses `url.searchParams.set()` which automatically percent-encodes values

## Test Coverage

### 1. Valid Inputs (6 tests)
Tests that legitimate use cases work correctly:
- Basic URL construction with project ID
- URL with action query parameter
- URL with all parameters (action + regNum)
- Project IDs with hyphens and underscores
- Special characters in query parameters are properly encoded

### 2. Project ID Validation (10 tests)
Tests that malicious project IDs are rejected:
- Path traversal attempts (`../../etc/passwd`)
- Backslash injection
- URL authority injection (`@` symbol)
- Port injection (`:` symbol)
- Spaces and whitespace
- Percent encoding attempts
- Control characters (newlines, null bytes)
- Empty strings
- Special characters only

### 3. Domain Allowlist (3 tests)
Tests that only supabase.co domains are allowed:
- Validates supabase.co subdomains are allowed
- Ensures final hostname matches expected pattern
- Verifies domain validation logic

### 4. Protocol Validation (6 tests)
Tests that only HTTP(S) protocols are allowed:
- Accepts `https://` ✓
- Accepts `http://` ✓
- Rejects `file://` ✗
- Rejects `ftp://` ✗
- Rejects `javascript://` ✗
- Rejects `data://` ✗

### 5. Query Parameter Safety (7 tests)
Tests that query parameters cannot be used for injection:
- Special characters are encoded (`&`, `?`, `#`)
- Undefined parameters are handled correctly
- Optional parameters work as expected
- Parameter pollution is prevented

### 6. Error Handling (3 tests)
Tests that errors don't leak sensitive information:
- Generic error messages for all failure cases
- No sensitive data in error messages
- Consistent error format

### 7. Integration Scenarios (3 tests)
Tests real-world usage patterns:
- Actual usage from line 290
- Path preservation from base URL
- Complex registration numbers

### 8. SSRF Attack Vectors (5 tests)
Tests specific SSRF attack scenarios:
- Internal network targeting (192.168.x.x)
- Localhost targeting
- Cloud metadata endpoints (169.254.169.254)
- DNS rebinding attacks
- URL parameter pollution

### 9. Edge Cases (8 tests)
Tests boundary conditions:
- Very long project IDs
- Maximum allowed character sets
- Empty parameters
- Base URLs with existing query parameters
- Trailing slashes

## Running the Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run only MNFinancePanel tests
npm test mn-finance-panel-ssrf
```

## Test Statistics
- **Total Test Suites**: 9
- **Total Tests**: 51
- **Coverage Areas**: 
  - Input validation
  - Domain security
  - Protocol security
  - Injection prevention
  - Error handling
  - Real-world scenarios

## Expected Results
All 51 tests should pass, confirming that:
1. Valid inputs work correctly
2. Malicious inputs are rejected
3. SSRF attacks are prevented
4. The implementation is secure

## Maintenance
When modifying the `buildValidatedUrl` function:
1. Run the test suite to ensure no regressions
2. Add new tests for any new validation logic
3. Update this documentation if the security model changes

## Related Files
- Implementation: `src/components/MNFinancePanel.tsx` (lines 52-92)
- Usage: `src/components/MNFinancePanel.tsx` (line 290)
- Tests: `src/test/mn-finance-panel-ssrf.test.ts`
