# Contributing to Paradoc

Thank you for your interest in contributing to Paradoc! We welcome contributions from the community and are excited to have you here.

## Code of Conduct

We are committed to providing a welcoming and inclusive environment for all contributors. We expect all participants to:

- Be respectful and considerate in communication
- Accept constructive criticism gracefully
- Focus on what is best for the community and project
- Show empathy towards other community members

## Getting Started

### Prerequisites

- Node.js >= 18
- pnpm 9.15.0 or later

### Development Setup

1. **Fork the repository** on GitHub

2. **Clone your fork**:
   ```bash
   git clone https://github.com/YOUR_USERNAME/paradoc.git
   cd paradoc
   ```

3. **Install dependencies**:
   ```bash
   pnpm install
   ```

4. **Build all packages**:
   ```bash
   pnpm build
   ```

5. **Run tests**:
   ```bash
   pnpm test
   ```

### Development Workflow

This is a Turborepo monorepo containing multiple packages. Common commands:

- `pnpm build` - Build all packages
- `pnpm dev` - Start development mode
- `pnpm test` - Run all tests
- `pnpm lint` - Lint all packages
- `pnpm check-types` - Type check all packages
- `pnpm clean` - Clean build outputs

## How to Contribute

### When to Open an Issue First

Please open an issue **before** starting work on:

- New features
- Major changes or refactoring
- Bug reports (to discuss the problem and proposed solution)

This helps us coordinate efforts and ensure your work aligns with the project's direction.

### When Direct PRs Are Welcome

You can submit a PR directly for:

- Typo fixes
- Documentation improvements
- Minor code improvements
- Fixing broken links

### Pull Request Process

1. **Create a feature branch** from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** following our code standards (see below)

3. **Write tests** for your changes when applicable

4. **Ensure all tests pass**:
   ```bash
   pnpm test
   ```

5. **Run lint and type checks**:
   ```bash
   pnpm lint
   pnpm check-types
   ```

6. **Commit your changes** using Conventional Commits format (see below)

7. **Push to your fork** and submit a pull request to the `main` branch

8. **Wait for review** - maintainers will review your PR and may request changes

## Code Standards

### Testing Requirements

- All new features must include tests
- Bug fixes should include tests when applicable
- All existing tests must pass before a PR can be merged

### Code Formatting

We use Biome for linting and formatting. Run `pnpm lint` to check your code.

### Commit Message Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat: add new feature` - A new feature
- `fix: correct bug in X` - A bug fix
- `docs: update README` - Documentation changes
- `test: add tests for Y` - Adding or updating tests
- `refactor: restructure Z` - Code changes that neither fix bugs nor add features
- `chore: update dependencies` - Maintenance tasks
- `perf: improve performance of X` - Performance improvements

If your change affects a specific package, include it in the scope:

```
feat(core): add validation utility
fix(renderer-pdf): correct form field rendering
docs(schemas): update artifact schema documentation
```

## Project Structure

```
apps/
└── docs/              # Documentation site

packages/
├── core/              # Core framework - schemas, builders, validation
├── types/             # Core types and interfaces
├── schemas/           # JSON Schema definitions
├── sdk/               # Umbrella SDK package
├── renderers/         # All renderers (umbrella package)
├── renderer-docx/     # DOCX renderer
├── renderer-pdf/      # PDF renderer
├── renderer-text/     # Text/HTML renderer
├── typescript-config/ # Shared TypeScript config (internal)
└── eslint-config/     # Shared ESLint config (internal)
```

## Publishing & Release Process (Maintainers)

### GitHub Secrets Configuration

Before the first release, configure the following GitHub secrets:

1. **NPM_TOKEN** (Required for publishing to NPM):
   - Generate an NPM access token with publish permissions from [npmjs.com](https://www.npmjs.com/)
   - Go to your repository's **Settings > Secrets and variables > Actions**
   - Click **New repository secret**
   - Name: `NPM_TOKEN`
   - Value: Your NPM automation token

2. **GITHUB_TOKEN** (Automatically provided by GitHub):
   - No configuration needed - GitHub automatically provides this token for workflows

### Release Workflow

The project uses [Changesets](https://github.com/changesets/changesets) for version management and publishing:

1. Contributors add changesets to their PRs using `pnpm changeset`
2. When ready to release, the CI/CD workflow automatically:
   - Versions packages based on changesets
   - Updates CHANGELOGs
   - Publishes to NPM
   - Creates GitHub releases

## Questions or Need Help?

- Open an issue on [GitHub](https://github.com/paradoc-dev/paradoc/issues)
- Start a discussion on [GitHub Discussions](https://github.com/paradoc-dev/paradoc/discussions)

## License

By contributing to Paradoc, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to Paradoc! 🎉
