# Snippet naming convention

- Snippet name always language keyword, builtin name or expansion symbol like `:-`.
- `description` always a short snippet explanation without leading articles and trailing punctuation.
  Mnemonics with square brackets are always used to denote what chars are included in snippet `prefix`.
- `prefix` can be just a string or array containing two item. The string or first item always follow these rules:
  - If a snippet is for language construct then first two letters of the first word from `description` are used
    plus the first letter from the second one (if it's exist).
  - If a snippet is for a builtin then builtin name is used.
  - If a snippet is for expansion then expansion symbol is used.
  The second one is always a noun existing to make snippets more memorizable.
- `body` is always array.
