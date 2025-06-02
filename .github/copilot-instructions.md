This is a NextJS 15 app uses TypeScript, Tailwind CSS, SWR, Drizzle ORM, and PostgreSQL.

# Code Style

- Use TypeScript for all code.
- Split code into small components and use Pure Components if possible.
- Always use react server component if possible and split large files into multiple small files with single component exports
- Use shadecn and add shadecn component through cmd line and don't generate the content
- Don need to run dev server for users, I will do it myself
- Always use pnpm for every operations
- You may need to install dependencies using `pnpm install` before running the app.
- You need to run `docker compose up` to start the PostgreSQL database and other services. This is not necessary since I will create the environment for you.
- You need to run `pnpm db:migrate` to run the database migrations before starting. This is also not necessary.
- Run `pnpm test:unit` to run unit tests and `pnpm test` to run end-to-end tests.
- Always use react function components and hooks.
- Add comments above each modification or new code to explain what it does and which feature it relates to.
- For unit tests, write test aside the component in a separate file with the same name as the component but with `.spec.tsx` extension.
- Always write unit tests for new components and features.
- Run `pnpm lint` to check for linting errors and `pnpm format` to format the code before committing.
- Each file should limit its size within 600 lines of code. If exceed, split into multiple files and grouped using folder
- Run `pnpm build` to check build error.

# Repository Structure

- `lib/` - Contains shared libraries and utilities.
- `components/` - Contains reusable components.
- `app/` - Contains the main application logic and pages.
- `tests/` - Contains playwright tests (e2e tests).

# Commit and PR instruction

- Always use conventional commit for you commits and commit title like: feat:, fix:, docs and so on.
- Always use lower case after fix, feat or docs
- Always run `pnpm build`, `pnpm test:unit` and `pnpm test` before commit. Fix any issue if possible
