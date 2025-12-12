**TYPESCRIPT TYPE AUDIT AND REMEDIATION**

This command initiates a comprehensive type safety audit to eliminate `any` and `unknown` types from the codebase and establish robust type hygiene.

---

## MISSION

Eliminate ALL instances of `any` and minimize `unknown` types throughout the entire codebase, including tests, by replacing them with precise, meaningful types. Allow TypeScript's type inference where appropriate, requiring explicit typing only when necessary for clarity, safety, or public API contracts.

**CRITICAL REMINDER:**
TypeScript errors in test files are production bugs. Test files with `any` types or type errors provide false confidence and must be treated with the same severity as production code type issues.

---

## AUDIT SCOPE AND METHODOLOGY

### Phase 1: Discovery and Analysis

1. **Comprehensive Scan**: Search for all instances of:
   - `any` type usage (including implicit any)
   - `unknown` type usage
   - `as any` type assertions
   - Missing return type annotations (only where required for public APIs or complex inference)
   - Missing parameter type annotations (only where TypeScript cannot infer or for public APIs)
   - `@ts-ignore` and `@ts-expect-error` comments
   - Generic type parameters without constraints (e.g., `<T>` instead of `<T extends BaseType>`)

2. **Pattern Analysis**: Identify common patterns where `any`/`unknown` appear:
   - External library integrations
   - Dynamic data structures
   - Event handlers
   - Test mocks and fixtures
   - API responses
   - Error handling blocks
   - Legacy code sections

3. **Priority Classification**: Categorize findings by:
   - **CRITICAL**: Production code with `any` in public APIs or core business logic
   - **CRITICAL**: Test files with `any` types - tests with poor typing provide false confidence
   - **HIGH**: Internal functions and utilities using `any` where type inference fails
   - **LOW**: Development-only code or build scripts
   - **ACCEPTABLE**: Implicit typing where TypeScript can correctly infer types

### Phase 2: Type Resolution Strategy

For each `any` or `unknown` instance, apply this decision tree:

1. **Can TypeScript infer the type correctly?**
   - If yes, remove explicit type annotation and let TypeScript infer
   - Only add explicit types when inference fails or is unclear

2. **Can we infer the type from usage?**
   - Analyze how the value is used downstream
   - Check for type guards or assertions nearby
   - Look for similar patterns with proper types

3. **Can we derive the type from external sources?**
   - Check library documentation for proper types
   - Look for community DefinitelyTyped packages
   - Examine runtime values in tests for shape

4. **Can we create a precise domain type?**
   - Define interfaces for object shapes
   - Create union types for known variants
   - Use discriminated unions for state modeling
   - Apply branded types for primitive validation

5. **Can we use generic constraints?**
   - Replace `any` with constrained generics
   - Use `extends` clauses to narrow possibilities
   - Apply conditional types for flexibility

### Phase 3: Implementation Guidelines

**For Production Code:**
- Never use `any` without exhaustive justification
- Prefer TypeScript's type inference where possible
- Add explicit types only when:
  - TypeScript cannot infer the type correctly
  - The type is part of a public API contract
  - The type improves code readability and maintainability
  - Complex generic types need clarification
- Use utility types (Partial, Pick, Omit) for variations
- Create reusable type definitions in appropriate files
- Add JSDoc comments for complex types

**For Test Code:**
- Create properly typed mock factories - NO `any` types allowed
- Use `DeepPartial` for test fixtures when appropriate
- Allow implicit typing for simple test variables when TypeScript can correctly infer
- Add explicit types when needed for test clarity
- Consider using libraries like `@faker-js/faker` with proper types

**For External Libraries:**
- Check for @types packages first
- Create ambient declarations if needed
- Use module augmentation for extending types
- Wrap untyped libraries with typed facades

### Phase 4: Special Attention Areas

**1. Event Handlers:**
- Replace `any` with specific event types from React/DOM
- Use proper handler signatures
- Type custom event payloads

**2. API Responses:**
- Generate types from OpenAPI/Swagger specs if available
- Create response DTOs matching backend contracts
- Use Zod schemas for runtime validation + type inference

**3. Dynamic Objects:**
- Use index signatures with constraints
- Apply mapped types for transformations
- Consider Records with specific key types

**4. Error Handling:**
- Create custom error classes with types
- Type catch block errors appropriately
- Use discriminated unions for error states

**5. Configuration Objects:**
- Define comprehensive config interfaces
- Use const assertions for literal types
- Apply satisfies operator for validation

---

## EXECUTION REQUIREMENTS

### Mandatory Actions:

1. **Generate Initial Report:**
   ```
   Type Audit Report:
   - Total `any` instances: X
   - Total `unknown` instances: Y
   - Files affected: Z
   - Critical violations: [list]
   ```

2. **Create Fix Priority List:**
   - Group by file/module
   - Estimate complexity per fix
   - Note any blocking dependencies

3. **Implement Fixes Systematically:**
   - Start with CRITICAL priority items
   - Update one module at a time
   - Run type checking after each change
   - Ensure no regression in type coverage

4. **Document Complex Types:**
   - Add JSDoc for non-obvious types
   - Explain type modeling decisions
   - Note any remaining `unknown` with justification

5. **Update Type Coverage Metrics:**
   - Before: X% typed, Y `any`, Z `unknown`
   - After: X% typed, Y `any`, Z `unknown`
   - Goal: 100% typed, 0 `any`, minimal `unknown`

### Quality Checks:

After remediation, verify:
- [ ] `pnpm tsc --noEmit` passes with no errors (including ALL test files)
- [ ] No new `any` types introduced in production OR test code
- [ ] All `unknown` types have validation
- [ ] Tests still pass with proper types
- [ ] No runtime behavior changes
- [ ] Type definitions are reusable and maintainable

---

## REPORTING TEMPLATE

After completion, provide:

```
## Type Audit Completion Report

### Summary Statistics:
- Files analyzed: X (including all test files)
- Files modified: Y (production and test files)
- `any` eliminated: Z (from production AND test code)
- `unknown` replaced: W
- `unknown` justified: V
- Type coverage improved: from X% to Y%

### Critical Fixes Applied:
1. [Component/Module]: [Description of type improvement]
2. [Test Files]: [Description of test type improvements]

### Remaining Considerations:
- [Any `unknown` that couldn't be resolved with justification]
- [Any complex types that need team review]
- [Suggestions for type architecture improvements]

### Validation Results:
- TypeScript compilation: PASSING
- Lint checks: PASSING
- Test suite: PASSING
- Build: SUCCESSFUL

### Recommended Follow-up:
- [Any agents that should be engaged for additional work]
- [Any research that would help with remaining issues]
```

---

## TASK TO COMPLETE:

$ARGUMENTS

---

**ENFORCEMENT NOTES:**

- Every `any` is a bug waiting to happen - in production AND test code
- Tests with `any` are not real tests - they provide false confidence
- "It works" is not an excuse for poor typing
- Time invested in proper types pays dividends in prevented bugs
- Trust TypeScript's inference - don't over-annotate where it's not needed
- Explicit types should add value, not just satisfy a rule

Execute this audit with rigor and precision. Report findings and proceed with remediation.
