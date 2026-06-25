# Ponytail Rules

This document outlines the coding principles based on [ponytail](https://github.com/DietrichGebert/ponytail).

## The Ladder of Decision Making
Before writing any new line of code, ask the following questions in order:

1. **Does this need to exist at all? (YAGNI)**
   - Is this feature strictly necessary for the PoC/MVP?
   - If not, drop it immediately.

2. **Is it already in this codebase?**
   - Can we reuse existing functions, helper modules, UI components, or logic?
   - Do not write a second utility if one can be adapted or composed.

3. **Does the standard library do it?**
   - Use native Node.js, Web APIs, or JavaScript/TypeScript features.
   - Example: Native `crypto` for encryption instead of third-party wrappers, or native `Fetch` instead of Axios.

4. **Is it a native platform feature?**
   - Use browser native features (e.g. `<dialog>` element, `<input type="date">`, CSS variables).
   - Use Next.js/Postgres native functionalities before adding layers.

5. **Can an installed dependency do it?**
   - Leverage what we already have (Tailwind, HeroUI, Stellar SDK, Drizzle).
   - Do not pull in new NPM libraries for simple operations.

6. **Can it be solved in one line?**
   - Keep code concise. Do not build elaborate class hierarchies or multi-file boilerplate when a single expression is sufficient.

7. **Only then:** Write just enough new code to satisfy the requirement.

---

## Lazy, Not Negligent
"Lazy" means avoiding gratuitous code, over-engineering, and unnecessary layers.
It does **not** mean skipping:
- Security / cryptography best practices.
- Input validation (e.g., zod or simple runtime checks).
- DB integrity constraints (foreign keys, transaction safety).
- Proper ledger accounting double-entry balance.

---

## Intentional Shortcuts
If you take a temporary shortcut to prioritize speed, mark it explicitly:
```typescript
// ponytail: [Reason/Shortcut details] -> Upgrade path: [What to do in production]
```
Do not hide shortcuts. Audit them using simple search tools.
