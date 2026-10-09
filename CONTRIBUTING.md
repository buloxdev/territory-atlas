# Contributing to Territory Atlas

Use Node.js 24 LTS and run `npm ci`, `npm test`, and `npm run build`.
Start the app with `npm run dev`. Include a short description of the problem,
the change, and how you verified it in your pull request.

For map changes, check both the default 3D view and `?view=2d`. Exercise
filters, marker selection, and navigation between the two views. For import
changes, check valid, duplicate, and invalid rows plus JSON backup restoration.
Use `examples/accounts.csv` or other fictional records for screenshots and tests.

Keep customer data, contact information, credentials, local exports, and
compiled desktop bundles out of commits. The demo businesses are fictional
and their coordinates are city centers, not verified facilities.

Discuss larger features in an issue before building them. Current ideas
include grouping facilities by company and suggesting nearby prospects for
a customer visit. Contributions are licensed under the project's MIT license.
