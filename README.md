
---

# Web Client for [SlideRule Earth](https://slideruleearth.io)

[![License: University of Washington](https://img.shields.io/badge/OpenSource-UniveristyofWashington-blue)](LICENSE)  
This repository contains the web client for [SlideRule Earth](https://www.slideruleearth.io), built on top of the secure static site architecture derived from [Amazon CloudFront Secure Static Site](https://github.com/aws-samples/amazon-cloudfront-secure-static-site) v0.11.
The UI/UX was developed at the [Savannah College of Art and Design](www.scad.edu) by the following: 
- Gabriel Mateleo
- Vincent Lee

## Overview

The web client provides a user-friendly interface for interacting with [SlideRule Earth](https://www.slideruleearth.io), a server designed to process geospatial data and offer customizable analytical tools. This client allows users to visualize data, manage layers, and perform various geospatial operations in an interactive and secure environment.

## Features

- **Secure Static Hosting**: The architecture is based on AWS CloudFront for secure content delivery.
- **Interactive Geospatial Data**: Allows interaction with different datasets and tools provided by the SlideRule Earth server.
- **Customizable Visualization**: Users can visualize and process geospatial data using various maps and tools.

## Getting Started

To run this web client locally, follow the instructions below.

### Prerequisites

- **Node.js** — exact version pinned in [`.nvmrc`](.nvmrc). Use [fnm](https://github.com/Schniz/fnm) (recommended) or nvm: `fnm install && fnm use`.
- **npm** — version pinned by the `packageManager` field in [`package.json`](package.json). Enable Corepack once with `corepack enable && corepack enable npm` and it will fetch the right version automatically.
- See [CONTRIBUTING.md](CONTRIBUTING.md) for full setup and the `make install-deps` vs `npm install` rule.

### Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/SlideRuleEarth/sliderule-web-client.git
   cd sliderule-web-client
   ```

2. Install npm dependencies (installs both the root and `web-client/` packages via `npm ci`):
   ```bash
   make install-deps
   ```

3. Run the development server:
   ```bash
   make run
   ```

4. Build for production:
   ```bash
   make build
   ```

5. See all available commands:
   ```bash
   make help
   ```

## Open Source Packages

This project uses a variety of open source libraries to enhance functionality. Below is a list of key packages used:

- **Vue.js 3** - Frontend framework for building interactive web apps.
- **Vite** – Next-generation frontend build tool that provides fast development and optimized production builds.
- **PrimeVue** - UI component library for Vue.js.
- **ECharts** - Charting library for creating data visualizations.
- **OpenLayers** - High-performance library for displaying and interacting with map data.
- **Deck.gl** - WebGL-powered framework for visualizing large datasets.
- **Pinia** - State management library for Vue.js.
- **DuckDB WASM** - An WebAssembly embeddable SQL database for data processing.
- **Apache Arrow** - Data interchange format for in-memory analytics.
  
## Deployment

This project is designed to be deployed as a secure static site using Amazon CloudFront and AWS S3. Refer to the [Amazon CloudFront Secure Static Site](https://github.com/aws-samples/amazon-cloudfront-secure-static-site) repository for detailed instructions on setting up a similar architecture.

We use [HashiCorp Terraform](https://www.terraform.io/) to deploy this website.

### Releasing

The recommended workflow is to release a new tagged version to the test site first,
sanity-check it, then promote that same build to production.

**1. Tag and release to test** (requires `VERSION` in `vX.Y.Z` form):

```bash
make release-live-update-to-testsliderule VERSION=v4.5.3
```

This step does all the version-stamping work:

1. **Generates and commits the release notes** for the version from the git commit
   subjects since the previous tag, then creates and pushes the annotated `vX.Y.Z`
   tag (`src-tag-and-push` → `VITE_VERSION.sh` → `gen-release-notes.sh`).
2. **Mirrors the notes to a GitHub Release** (`publish-gh-release.sh`). This step is
   non-fatal — if the `gh` CLI is missing or unauthenticated it warns and is skipped,
   so it never blocks a deploy.
3. **Builds and deploys** the client to **testsliderule.org** — the tag is injected
   as `VITE_APP_VERSION`, assets are uploaded to S3, and CloudFront is invalidated.

Sanity-check the result at <https://client.testsliderule.org>.

**2. Promote the same tagged build to production:**

```bash
make live-update-slideruleearth
```

This rebuilds the current checkout and deploys it to **slideruleearth.io**. It does
**not** create a new tag — the build reads the existing tag via `git describe --tags`,
so the release notes and the GitHub Release are created exactly once, during step 1.

> A one-shot `make release-live-update-to-slideruleearth VERSION=v4.5.3` also exists
> (it tags and deploys straight to production), but the test-first workflow above is
> recommended.

### Release notes

Web-client release notes are maintained in this repo as one Markdown file per
version under `web-client/src/assets/content/release-notes/` (e.g. `v4.5.3.md`).
They are bundled into the client at build time and shown in the **Web Client
Releases** tab on the landing page (the **SlideRule Releases** tab continues to
show the platform/server notes from the docs site).

The release flow auto-generates a draft from the commits since the previous tag.
To curate the notes before releasing, generate the draft first, edit it, then run
the release (step 1 above) — an existing file is preserved (use `--force` to
regenerate):

```bash
make gen-release-notes VERSION=v4.5.3   # writes .../release-notes/v4.5.3.md
# edit the generated file...
make release-live-update-to-testsliderule VERSION=v4.5.3
```

## License

This project is licensed under the following University of Washington Open Source License - see the [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Please feel free to submit a pull request or open an issue for any improvements or feature requests.

## Contact

For questions or support, please open an issue or contact the project maintainers at [sliderule@u.washington.edu](mailto:sliderule@u.washington.edu).

---
