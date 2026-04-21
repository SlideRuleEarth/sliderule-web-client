const DOCS_BASE = 'https://docs.slideruleearth.io'

export const DOCS = {
  base: DOCS_BASE,
  icesat2: {
    base: `${DOCS_BASE}/user_guide/icesat2.html`,
    photonInput: `${DOCS_BASE}/user_guide/icesat2.html#photon-input-parameters`,
    photonExtent: `${DOCS_BASE}/user_guide/icesat2.html#photon-extent-parameters`,
    atl08Classification: `${DOCS_BASE}/user_guide/icesat2.html#atl08-classification`,
    atl03Classification: `${DOCS_BASE}/user_guide/icesat2.html#native-atl03-photon-classification`,
    yapcClassification: `${DOCS_BASE}/user_guide/icesat2.html#yapc-classification`,
    atl06SrParameters: `${DOCS_BASE}/user_guide/icesat2.html#atl06-sr-parameters`,
    phorealAlgorithm: `${DOCS_BASE}/user_guide/icesat2.html#phoreal-algorithm`
  },
  arrowOutput: {
    parameters: `${DOCS_BASE}/user_guide/arrow_output.html#parameters`
  },
  rasterSampling: {
    base: `${DOCS_BASE}/user_guide/raster_sampling.html`,
    catalog: `${DOCS_BASE}/user_guide/raster_sampling.html#providing-your-own-catalog`,
    parameters: `${DOCS_BASE}/user_guide/raster_sampling.html#parameters`
  },
  dataframe: {
    atl13: `${DOCS_BASE}/user_guide/dataframe.html#atl13`,
    atl24: `${DOCS_BASE}/user_guide/dataframe.html#atl24`
  },
  basicUsage: {
    timeouts: `${DOCS_BASE}/user_guide/basic_usage.html#timeouts`,
    rasterizedAoi: `${DOCS_BASE}/user_guide/basic_usage.html#rasterized-area-of-interest`
  },
  ancillaryFields: {
    base: `${DOCS_BASE}/user_guide/how_tos/ancillary_fields.html#including-ancillary-fields`,
    atl06pReq: `${DOCS_BASE}/user_guide/how_tos/ancillary_fields.html#including-an-ancillary-field-in-an-atl06p-request`,
    atl03spReq: `${DOCS_BASE}/user_guide/how_tos/ancillary_fields.html#including-an-ancillary-field-in-an-atl03sp-request`
  },
  apiReference: {
    icesat2: `${DOCS_BASE}/api_reference/icesat2.html#icesat2`,
    gedi: `${DOCS_BASE}/api_reference/gedi.html#gedi`,
    earthdataCmr: `${DOCS_BASE}/api_reference/earthdata.html#cmr`
  },
  articles: {
    index: `${DOCS_BASE}/developer_guide/articles/articles.html`,
    base: `${DOCS_BASE}/developer_guide/articles/`
  }
} as const
