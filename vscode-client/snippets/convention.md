# Snippet naming convention

- Snippet name always language keyword, builtin name or expansion symbol like `:-`.
- `description` always a short snippet explanation without leading articles and trailing punctuation.
  Mnemonics with square brackets are always used to denote what chars are included in snippet `prefix` until they match snippet
  names (`-` is ignored while checking for matching).
- `prefix` can be just a string or array containing two item. The string or first item always follow these rules:
  - If a snippet is for language construct then first two letters of the first word from `description` are used
    plus the first letter from the second one (if it's exist).
  - If a snippet is for a builtin then builtin name is used.
  - If a snippet is for expansion then expansion symbol is used.
  - If a snippet is for a specific external program like **awk** then program name must be added to `prefix` like this:
    `awk:{{snippet-prefix}}`.
  The second one is always a noun existing to make snippets more memorizable.
- `body` is always array.
- If both short and long options available placeholder must be used to let user to chose the option's style
  but the first alternative should always be the long option.
