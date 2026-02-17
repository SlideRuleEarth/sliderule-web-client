export interface ToolDefinition {
  name: string
  description: string
  inputSchema: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
  }
}

export const toolDefinitions: ToolDefinition[] = [
  {
    name: 'set_mission',
    description:
      'Set the active mission to ICESat-2 or GEDI. This changes which APIs and parameters are available. Setting the mission resets the selected API to the mission default.',
    inputSchema: {
      type: 'object',
      properties: {
        mission: {
          type: 'string',
          enum: ['ICESat-2', 'GEDI'],
          description: 'The mission to set. Must be exactly "ICESat-2" or "GEDI".'
        }
      },
      required: ['mission']
    }
  },
  {
    name: 'set_api',
    description:
      'Set the active API for the current mission. For ICESat-2: atl06p, atl06sp, atl06x, atl03x, atl03x-surface, atl03x-phoreal, atl03vp, atl08p, atl08x, atl24x, atl13x. For GEDI: gedi01bp, gedi02ap, gedi04ap. Setting the API auto-configures related parameters (e.g. surface fit, PhoREAL).',
    inputSchema: {
      type: 'object',
      properties: {
        api: {
          type: 'string',
          description: 'The API endpoint name to select.'
        }
      },
      required: ['api']
    }
  },
  {
    name: 'set_time_range',
    description:
      'Set the time range for granule filtering. Automatically enables granule selection. Provide one or both of t0 and t1 as ISO 8601 date strings.',
    inputSchema: {
      type: 'object',
      properties: {
        t0: {
          type: 'string',
          description: 'Start time in ISO 8601 format (e.g. "2020-01-01T00:00:00Z").'
        },
        t1: {
          type: 'string',
          description: 'End time in ISO 8601 format (e.g. "2023-12-31T23:59:59Z").'
        }
      }
    }
  },
  {
    name: 'set_rgt',
    description:
      'Set the ICESat-2 Reference Ground Track number. Automatically enables granule selection and RGT filtering.',
    inputSchema: {
      type: 'object',
      properties: {
        rgt: {
          type: 'integer',
          description: 'Reference Ground Track number (1–1387).',
          minimum: 1,
          maximum: 1387
        }
      },
      required: ['rgt']
    }
  },
  {
    name: 'set_cycle',
    description:
      'Set the ICESat-2 orbital repeat cycle number. Automatically enables granule selection and cycle filtering.',
    inputSchema: {
      type: 'object',
      properties: {
        cycle: {
          type: 'integer',
          description: 'Orbital repeat cycle number (>= 1).',
          minimum: 1
        }
      },
      required: ['cycle']
    }
  },
  {
    name: 'set_region',
    description:
      'Set the geographic region for processing. Provide EITHER a bounding box (bbox with min/max lat/lon) OR a GeoJSON polygon geometry. The region defines the area of interest for the SlideRule request. Setting a region computes the convex hull and area automatically.',
    inputSchema: {
      type: 'object',
      properties: {
        bbox: {
          type: 'object',
          description: 'Bounding box with min/max latitude and longitude. Alternative to geojson.',
          properties: {
            min_lat: { type: 'number', description: 'Minimum latitude (-90 to 90).' },
            max_lat: { type: 'number', description: 'Maximum latitude (-90 to 90).' },
            min_lon: { type: 'number', description: 'Minimum longitude (-180 to 180).' },
            max_lon: { type: 'number', description: 'Maximum longitude (-180 to 180).' }
          },
          required: ['min_lat', 'max_lat', 'min_lon', 'max_lon']
        },
        geojson: {
          type: 'object',
          description:
            'GeoJSON Polygon or MultiPolygon geometry object. Alternative to bbox. Coordinates are [lon, lat] arrays.',
          properties: {
            type: {
              type: 'string',
              enum: ['Polygon', 'MultiPolygon'],
              description: 'GeoJSON geometry type.'
            },
            coordinates: {
              description: 'GeoJSON coordinates array.'
            }
          },
          required: ['type', 'coordinates']
        }
      }
    }
  },
  {
    name: 'set_beams',
    description:
      'Set the selected beams. For ICESat-2, provide ground track names: "gt1l", "gt1r", "gt2l", "gt2r", "gt3l", "gt3r", or "all". For GEDI, provide beam numbers: 0, 1, 2, 3, 5, 6, 8, 11, or "all". Automatically enables granule selection.',
    inputSchema: {
      type: 'object',
      properties: {
        beams: {
          oneOf: [
            {
              type: 'array',
              items: { type: 'string' },
              description: 'ICESat-2 beam names (e.g. ["gt1l", "gt2r"]).'
            },
            {
              type: 'array',
              items: { type: 'integer' },
              description: 'GEDI beam numbers (e.g. [0, 1, 2]).'
            },
            {
              type: 'string',
              enum: ['all'],
              description: 'Select all beams.'
            }
          ]
        }
      },
      required: ['beams']
    }
  },
  {
    name: 'set_surface_fit',
    description:
      'Configure the surface fit algorithm for ICESat-2 photon processing. Enabling surface fit automatically disables PhoREAL (they are mutually exclusive). Optionally set sub-parameters.',
    inputSchema: {
      type: 'object',
      properties: {
        enabled: {
          type: 'boolean',
          description: 'Enable or disable the surface fit algorithm.'
        },
        max_iterations: {
          type: 'integer',
          description: 'Maximum number of iterations for the fit.'
        },
        min_window_height: {
          type: 'number',
          description: 'Minimum window height in meters.'
        },
        sigma_r_max: {
          type: 'number',
          description: 'Maximum robust dispersion.'
        }
      },
      required: ['enabled']
    }
  },
  {
    name: 'set_photon_params',
    description:
      'Configure photon processing parameters for ICESat-2: segment length, step size, along-track spread, and minimum photon count. Provide at least one parameter.',
    inputSchema: {
      type: 'object',
      properties: {
        length: {
          type: 'number',
          description: 'Segment length in meters (default 40).'
        },
        step: {
          type: 'number',
          description: 'Step size in meters (default 20).'
        },
        along_track_spread: {
          type: 'number',
          description: 'Along-track spread threshold. Set to -1 to disable.'
        },
        min_photon_count: {
          type: 'integer',
          description: 'Minimum photon count threshold. Set to -1 to disable.'
        }
      }
    }
  },
  {
    name: 'set_yapc',
    description:
      'Configure YAPC (Yet Another Photon Classifier) for ICESat-2. Controls photon classification scoring. Optionally set score threshold, k-nearest-neighbors, window dimensions, and version.',
    inputSchema: {
      type: 'object',
      properties: {
        enabled: {
          type: 'boolean',
          description: 'Enable or disable YAPC.'
        },
        score: {
          type: 'number',
          description: 'YAPC score threshold (0.0–1.0).'
        },
        knn: {
          type: 'integer',
          description: 'Number of nearest neighbors.'
        },
        window_height: {
          type: 'number',
          description: 'Window height in meters.'
        },
        window_width: {
          type: 'number',
          description: 'Window width in meters.'
        },
        version: {
          type: 'integer',
          description: 'YAPC algorithm version.'
        }
      },
      required: ['enabled']
    }
  },
  {
    name: 'set_output_config',
    description:
      'Configure output format settings: file output mode, GeoParquet format, and checksum generation.',
    inputSchema: {
      type: 'object',
      properties: {
        file_output: {
          type: 'boolean',
          description: 'Enable or disable file output (server-side parquet generation).'
        },
        geo_parquet: {
          type: 'boolean',
          description: 'Use GeoParquet format (true) or plain Parquet (false).'
        },
        checksum: {
          type: 'boolean',
          description: 'Include checksum in output.'
        }
      }
    }
  },
  {
    name: 'get_current_params',
    description:
      'Get the current request parameter state including mission, API, region, time range, beams, surface fit, YAPC, photon params, and output configuration.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'reset_params',
    description:
      'Reset all request parameters to their default values. This is a destructive operation that requires user confirmation in the browser.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },

  // ── Request Lifecycle Tools ─────────────────────────────────────
  {
    name: 'submit_request',
    description:
      'Submit the current parameters as a SlideRule processing request. Returns immediately with a req_id. Use get_request_status to poll for completion. The request spawns a Web Worker that streams Parquet results to OPFS and loads them into DuckDB.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'get_request_status',
    description:
      'Get the status of a processing request. Returns status (pending, started, progress, success, error, aborted), elapsed time, row count, granule count, byte count, and other details. Use this to poll after submit_request.',
    inputSchema: {
      type: 'object',
      properties: {
        req_id: {
          type: 'integer',
          description: 'The request ID returned by submit_request.'
        }
      },
      required: ['req_id']
    }
  },
  {
    name: 'cancel_request',
    description:
      'Cancel a currently running request. Only works if a request is actively fetching data.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'list_requests',
    description:
      'List all requests in the session with their status, API function, elapsed time, and point count. Returns newest first.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'delete_request',
    description:
      'Delete a request and its associated data (summary, run context). This is a destructive operation that requires user confirmation in the browser.',
    inputSchema: {
      type: 'object',
      properties: {
        req_id: {
          type: 'integer',
          description: 'The request ID to delete.'
        }
      },
      required: ['req_id']
    }
  },

  // ── Data Analysis Tools ─────────────────────────────────────────
  {
    name: 'run_sql',
    description:
      "Execute a read-only SQL query against a request's result data using DuckDB WASM with spatial extension. Use describe_data first to learn the table name and schema. Results limited to max_rows (default 100). 30-second timeout.",
    inputSchema: {
      type: 'object',
      properties: {
        req_id: {
          type: 'integer',
          description: 'The request ID whose data to query.'
        },
        sql: {
          type: 'string',
          description:
            "SQL query to execute. The table name is the parquet filename (use describe_data to find it). Example: SELECT * FROM 'filename.parquet' LIMIT 10"
        },
        max_rows: {
          type: 'integer',
          description: 'Maximum number of rows to return (default 100, max 10000).',
          minimum: 1,
          maximum: 10000
        }
      },
      required: ['req_id', 'sql']
    }
  },
  {
    name: 'describe_data',
    description:
      "Get the schema (column names and types), row count, and table name for a request's result set. Use this before run_sql to learn the available columns and the correct table name.",
    inputSchema: {
      type: 'object',
      properties: {
        req_id: {
          type: 'integer',
          description: 'The request ID whose data to describe.'
        }
      },
      required: ['req_id']
    }
  },
  {
    name: 'get_elevation_stats',
    description:
      "Compute statistics for a request's result set: min, max, 10th/90th percentile for all numeric columns. Also includes lat/lon extent and total point count.",
    inputSchema: {
      type: 'object',
      properties: {
        req_id: {
          type: 'integer',
          description: 'The request ID whose stats to compute.'
        }
      },
      required: ['req_id']
    }
  },
  {
    name: 'get_sample_data',
    description:
      "Retrieve a random sample of rows from a request's result set. Uses DuckDB Bernoulli sampling for true randomness.",
    inputSchema: {
      type: 'object',
      properties: {
        req_id: {
          type: 'integer',
          description: 'The request ID whose data to sample.'
        },
        num_rows: {
          type: 'integer',
          description: 'Number of rows to return (default 20, max 500).',
          minimum: 1,
          maximum: 500
        }
      },
      required: ['req_id']
    }
  },
  {
    name: 'export_data',
    description:
      'Export query results as a Parquet file for download. Triggers a browser download dialog. Optionally provide a custom SQL query; defaults to the full result set.',
    inputSchema: {
      type: 'object',
      properties: {
        req_id: {
          type: 'integer',
          description: 'The request ID whose data to export.'
        },
        sql: {
          type: 'string',
          description:
            'Optional SQL query to export. Defaults to SELECT * FROM the full result set.'
        },
        filename: {
          type: 'string',
          description: 'Optional output filename (default: "export_<req_id>.parquet").'
        }
      },
      required: ['req_id']
    }
  },

  // ── Documentation Tools ───────────────────────────────────────────
  {
    name: 'search_docs',
    description:
      'Search indexed SlideRule documentation using full-text search. Returns ranked results with snippets. Use this to find information about APIs, parameters, algorithms, and workflows.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            'Search query (e.g. "photon classification glacier", "atl06 surface fit algorithm").'
        },
        max_results: {
          type: 'integer',
          description: 'Maximum number of results to return (default 10, max 50).',
          minimum: 1,
          maximum: 50
        }
      },
      required: ['query']
    }
  },
  {
    name: 'fetch_docs',
    description:
      'Fetch a SlideRule ReadTheDocs page, parse it to text, and index it for future searches. URL must be under slideruleearth.io.',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description:
            'URL to fetch (e.g. "https://slideruleearth.io/web/rtd/user_guide/icesat2.html").'
        }
      },
      required: ['url']
    }
  },
  {
    name: 'get_param_help',
    description:
      'Get detailed help for a specific SlideRule parameter. Returns tooltip text, default values, valid values, and documentation URL.',
    inputSchema: {
      type: 'object',
      properties: {
        param_name: {
          type: 'string',
          description: 'Parameter name (e.g. "cnf", "srt", "length", "yapc_score", "surface_type").'
        }
      },
      required: ['param_name']
    }
  },
  {
    name: 'list_doc_sections',
    description:
      'List all indexed documentation sections with their titles and chunk counts. Useful to discover what documentation is available for searching.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },

  // ── Map Tools ──────────────────────────────────────────────────────
  {
    name: 'zoom_to_bbox',
    description:
      'Zoom the map to a bounding box defined by min/max latitude and longitude. Animates the map to fit the specified extent.',
    inputSchema: {
      type: 'object',
      properties: {
        min_lat: { type: 'number', description: 'Minimum latitude (-90 to 90).' },
        max_lat: { type: 'number', description: 'Maximum latitude (-90 to 90).' },
        min_lon: { type: 'number', description: 'Minimum longitude (-180 to 180).' },
        max_lon: { type: 'number', description: 'Maximum longitude (-180 to 180).' }
      },
      required: ['min_lat', 'max_lat', 'min_lon', 'max_lon']
    }
  },
  {
    name: 'zoom_to_point',
    description:
      'Center the map on a specific latitude/longitude point with an optional zoom level.',
    inputSchema: {
      type: 'object',
      properties: {
        lat: { type: 'number', description: 'Latitude (-90 to 90).' },
        lon: { type: 'number', description: 'Longitude (-180 to 180).' },
        zoom: {
          type: 'number',
          description: 'Zoom level (0–23). Higher = more zoomed in. Default: 10.',
          minimum: 0,
          maximum: 23
        }
      },
      required: ['lat', 'lon']
    }
  },
  {
    name: 'set_base_layer',
    description:
      'Change the map base layer (satellite imagery, topography, etc.). Available layers depend on the current projection/view. Common layers: "Esri World Topo", "Esri World Imagery", "OpenStreetMap Standard", "Google Satellite". Polar views have specialized layers like "Arctic Ocean Base", "Antarctic Imagery", "LIMA".',
    inputSchema: {
      type: 'object',
      properties: {
        layer: {
          type: 'string',
          description: 'Base layer name (e.g. "Esri World Imagery", "OpenStreetMap Standard").'
        }
      },
      required: ['layer']
    }
  },
  {
    name: 'set_map_view',
    description:
      'Switch the map projection/view. Changes coordinate system and available base layers. "Global Mercator" (EPSG:3857) for worldwide, "North Alaska" (EPSG:5936) for Arctic, "North Sea Ice" (EPSG:3413) for Arctic sea ice, "South" (EPSG:3031) for Antarctic.',
    inputSchema: {
      type: 'object',
      properties: {
        view: {
          type: 'string',
          enum: ['Global Mercator', 'North Alaska', 'North Sea Ice', 'South'],
          description: 'Map view/projection name.'
        }
      },
      required: ['view']
    }
  },
  {
    name: 'toggle_graticule',
    description: 'Show or hide the latitude/longitude grid (graticule) overlay on the map.',
    inputSchema: {
      type: 'object',
      properties: {
        visible: {
          type: 'boolean',
          description: 'True to show the graticule, false to hide it.'
        }
      },
      required: ['visible']
    }
  },
  {
    name: 'set_draw_mode',
    description:
      'Set the region drawing mode on the map. "Polygon" for freeform polygon, "Box" for rectangle, "" (empty string) to disable drawing.',
    inputSchema: {
      type: 'object',
      properties: {
        mode: {
          type: 'string',
          enum: ['Polygon', 'Box', ''],
          description: 'Drawing mode: "Polygon", "Box", or "" to disable.'
        }
      },
      required: ['mode']
    }
  },

  // ── Visualization Tools ──────────────────────────────────────────
  {
    name: 'set_chart_field',
    description:
      'Set which data field to plot on the elevation chart Y-axis for a given request. Use describe_data to discover available column names first.',
    inputSchema: {
      type: 'object',
      properties: {
        req_id: {
          type: 'integer',
          description: 'The request ID whose chart to configure.'
        },
        field: {
          type: 'string',
          description: 'Column name for the Y-axis (e.g. "h_mean", "height", "h_canopy").'
        }
      },
      required: ['req_id', 'field']
    }
  },
  {
    name: 'set_x_axis',
    description:
      'Set the X-axis field for the elevation chart. Common values: "x_atc" (along-track distance, default for most APIs), "latitude", "segment_dist_x", "time_ns_plot", "time_plot".',
    inputSchema: {
      type: 'object',
      properties: {
        req_id: {
          type: 'integer',
          description: 'The request ID whose chart to configure.'
        },
        field: {
          type: 'string',
          description: 'Column name for the X-axis (e.g. "x_atc", "latitude", "time_ns_plot").'
        }
      },
      required: ['req_id', 'field']
    }
  },
  {
    name: 'set_color_map',
    description:
      'Set the gradient color map used for elevation/data visualization. Available palettes include: viridis, jet, inferno, magma, plasma, hot, cool, rainbow, RdBu, bluered, earth, bathymetry, temperature, and many more.',
    inputSchema: {
      type: 'object',
      properties: {
        palette: {
          type: 'string',
          description: 'Color map name (e.g. "viridis", "jet", "inferno", "plasma", "rainbow").'
        }
      },
      required: ['palette']
    }
  },
  {
    name: 'set_3d_config',
    description:
      'Configure the 3D elevation view (Deck.gl). Set vertical exaggeration, point size, field of view, and axes visibility.',
    inputSchema: {
      type: 'object',
      properties: {
        vertical_exaggeration: {
          type: 'number',
          description:
            'Vertical exaggeration multiplier (default 1.0). Higher values emphasize elevation differences.'
        },
        point_size: {
          type: 'number',
          description: 'Point size multiplier (default 1.0).',
          minimum: 0.1
        },
        fov: {
          type: 'number',
          description: 'Field of view in degrees (default 50).',
          minimum: 10,
          maximum: 120
        },
        show_axes: {
          type: 'boolean',
          description: 'Show or hide 3D axes.'
        }
      }
    }
  },
  {
    name: 'set_plot_options',
    description:
      'Configure chart plot options: color encoding field for data-driven coloring, symbol size, and tooltip visibility.',
    inputSchema: {
      type: 'object',
      properties: {
        req_id: {
          type: 'integer',
          description: 'The request ID whose plot to configure.'
        },
        color_field: {
          type: 'string',
          description:
            'Field name for color encoding (e.g. "h_mean", "atl03_cnf"), or "solid" for single color.'
        },
        symbol_size: {
          type: 'number',
          description: 'Symbol/point size in pixels (default varies by API, typically 2–4).',
          minimum: 1,
          maximum: 20
        },
        show_tooltip: {
          type: 'boolean',
          description: 'Show or hide chart tooltips on hover.'
        }
      }
    }
  },

  // ── UI Tools ──────────────────────────────────────────────────────
  {
    name: 'start_tour',
    description:
      'Start an interactive guided tour of the SlideRule web client UI. The tour highlights key UI elements and walks the user through the app. Use "quick" for the 4-step essentials (zoom, draw, run, analyze) or "long" for a comprehensive walkthrough of all controls and views.',
    inputSchema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['quick', 'long'],
          description:
            'Tour type. "quick" = 4-step essentials (zoom, draw, run, analyze). "long" = full walkthrough of all controls.'
        }
      },
      required: ['type']
    }
  },
  {
    name: 'navigate',
    description:
      "Navigate to a view in the web client. Use 'analyze' with a req_id to view results, " +
      "'request' to set up parameters, 'settings' for app configuration, 'rectree' for the " +
      "request tree, 'server' for server management.",
    inputSchema: {
      type: 'object',
      properties: {
        view: {
          type: 'string',
          enum: ['home', 'request', 'analyze', 'settings', 'about', 'server', 'rectree', 'privacy'],
          description: 'The view to navigate to.'
        },
        req_id: {
          type: 'integer',
          description:
            "Required when navigating to 'analyze'. The request ID to view. " +
            "Also accepted for 'request' to load a specific request's parameters."
        }
      },
      required: ['view']
    }
  },
  {
    name: 'get_current_view',
    description:
      'Get the current view/page in the web client. Returns the active route name, ' +
      'path, route params, and a list of all available views.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  }
]
