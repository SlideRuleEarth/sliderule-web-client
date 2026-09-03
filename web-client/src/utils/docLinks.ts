const DOCS_BASE = 'https://docs.slideruleearth.io'

// The docs site runs on MyST, not Sphinx (issue #1100): routes are extensionless
// and hyphenated, and headings on the numbered user-guide pages carry their
// section number in the id, e.g. #id-1-1-photon-input-parameters. Every page and
// anchor below is checked against a snapshot of the site's own cross-reference
// index by tests/unit/docLinks.spec.ts.
const USER_GUIDE = `${DOCS_BASE}/user-guide`
const API_REFERENCE = `${DOCS_BASE}/api-reference`
const ICESAT2 = `${USER_GUIDE}/icesat2`

export const DOCS = {
  base: DOCS_BASE,
  icesat2: {
    base: ICESAT2,
    photonInput: `${ICESAT2}#id-1-1-photon-input-parameters`,
    photonExtent: `${ICESAT2}#id-1-3-photon-extent-parameters`,
    atl03Classification: `${ICESAT2}#id-1-2-1-native-atl03-photon-classification`,
    yapcClassification: `${ICESAT2}#id-1-2-2-yapc-classification`,
    atl08Classification: `${ICESAT2}#id-1-2-3-atl08-classification`,
    atl06SrParameters: `${ICESAT2}#id-1-5-1-atl06-sr-parameters`,
    phorealAlgorithm: `${ICESAT2}#id-1-6-phoreal-algorithm`,
    // Previously user_guide/dataframe.html#atl13 / #atl24, a page MyST dropped.
    // The per-endpoint parameter sections are what those editors configure.
    atl13Parameters: `${ICESAT2}#id-4-1-inland-lake-parameters`,
    atl24Parameters: `${ICESAT2}#id-5-1-query-parameters`
  },
  // Ancillary fields were one standalone how-to under Sphinx. MyST documents
  // them per endpoint instead, so each editor links to the section that lists
  // the very fields it edits.
  ancillaryFields: {
    atl03: `${ICESAT2}#id-1-4-ancillary-data`,
    atl06: `${ICESAT2}#id-2-1-ancillary-data`,
    atl08: `${ICESAT2}#id-3-2-ancillary-data`,
    atl13: `${ICESAT2}#id-4-2-ancillary-data`,
    // gedi_fields is not documented anywhere on the docs site; its parameter
    // section is the closest thing there is.
    gedi: `${USER_GUIDE}/gedi#id-2-parameters`
  },
  arrowOutput: {
    parameters: `${USER_GUIDE}/arrow-output#parameters`
  },
  rasterSampling: {
    base: `${USER_GUIDE}/raster-sampling`,
    catalog: `${USER_GUIDE}/raster-sampling#providing-your-own-catalog`,
    parameters: `${USER_GUIDE}/raster-sampling#parameters`
  },
  basicUsage: {
    timeouts: `${USER_GUIDE}/basic-usage#timeouts`,
    rasterizedAoi: `${USER_GUIDE}/basic-usage#rasterized-area-of-interest`
  },
  apiReference: {
    // These pages have no page-level anchor under MyST — every heading is a
    // function name — so they are linked without a fragment.
    icesat2: `${API_REFERENCE}/icesat2`,
    gedi: `${API_REFERENCE}/gedi`,
    earthdataCmr: `${API_REFERENCE}/earthdata#cmr`
  },
  releaseNotes: {
    // MyST routes are extensionless; each note is a child of this index page.
    index: `${DOCS_BASE}/developer-guide/release-notes`
  },
  webClient: {
    repo: 'https://github.com/SlideRuleEarth/sliderule-web-client',
    tags: 'https://github.com/SlideRuleEarth/sliderule-web-client/releases/tag/'
  }
} as const
