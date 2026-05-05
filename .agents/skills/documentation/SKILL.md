---
name: documentation
description: Use this skill when the user wants to write, improve, or generate documentation for code. Activate when the user mentions "document this", "write docs", "add JSDoc", "add docstrings", "README", "API docs", "explain this function", or asks to improve existing documentation. Also use when the user shares code and asks what it does in a way that implies they want documentation written.
---

# Documentation Skill

Help write and improve documentation for code — from inline comments and docstrings to full README files and API references.

## Instructions

### For Functions / Methods
Generate a docstring or JSDoc comment block that includes:
- **Summary** — One sentence describing what the function does
- **Parameters** — Name, type, and description of each parameter
- **Returns** — What the function returns and its type
- **Throws** — Any exceptions or errors that may be raised
- **Example** — A brief usage example if helpful

**JavaScript/TypeScript (JSDoc):**
```js
/**
 * Brief description of what the function does.
 *
 * @param {string} name - Description of this parameter.
 * @param {number} [count=1] - Optional parameter with default.
 * @returns {Promise<string[]>} Description of return value.
 * @throws {Error} When something goes wrong.
 *
 * @example
 * const result = await myFunction('hello', 3);
 */
```

**Python:**
```python
def my_function(name: str, count: int = 1) -> list[str]:
    """
    Brief description of what the function does.

    Args:
        name: Description of this parameter.
        count: Optional parameter with default.

    Returns:
        Description of return value.

    Raises:
        ValueError: When something goes wrong.

    Example:
        >>> my_function('hello', 3)
        ['hello', 'hello', 'hello']
    """
```

### For Modules / Files
Add a module-level docstring explaining:
- Purpose of the module
- Key exports or classes
- Usage overview

### For README files
Structure the README with:
1. **Project name + one-liner description**
2. **Installation** — exact commands
3. **Quick start** — minimal working example
4. **Usage** — common patterns
5. **API reference** (if small enough)
6. **Contributing** — link or brief guide
7. **License**

## Quality Standards
- Write for the reader who has never seen this code before
- Use active voice: "Returns the user object" not "The user object is returned"
- Include concrete examples wherever possible
- Keep it accurate — don't document behavior that doesn't exist