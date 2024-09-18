
---

# Web Client for [SlideRule Earth](https://www.slideruleearth.io)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)  
This repository contains the web client for [SlideRule Earth](https://www.slideruleearth.io), built on top of the secure static site architecture derived from [Amazon CloudFront Secure Static Site](https://github.com/aws-samples/amazon-cloudfront-secure-static-site) v0.11.
The UI/UX was developed at the [Savannah College of Art and Design](www.scad.edu) by the following: 
- Gabriel Lam
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

- **Node.js** v14 or higher
- **npm** or **yarn**

### Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/yourusername/your-web-client-repo.git
   cd your-web-client-repo
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

4. Build for production:
   ```bash
   npm run build
   ```

## Open Source Packages

This project uses a variety of open source libraries to enhance functionality. Below is a list of key packages used:

- **Vue.js 3** - Frontend framework for building interactive web apps.
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

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Please feel free to submit a pull request or open an issue for any improvements or feature requests.

## Contact

For questions or support, please open an issue or contact the project maintainers at [sliderule@u.washington.edu](mailto:sliderule@u.washington.edu).

---
