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
    name: 'set_general_preset',
    description:
      'Apply a general preset that configures mission, API, and processing parameters in one step. Use this when the user describes a science goal. Resets parameters, preserves the current region.',
    inputSchema: {
      type: 'object',
      properties: {
        preset: {
          type: 'string',
          enum: [
            'ICESat-2 Surface Elevations',
            'ICESat-2 Land Ice Sheet',
            'ICESat-2 Canopy Heights',
            'ICESat-2 Coastal Bathymetry',
            'ICESat-2 Geolocated Photons',
            'ICESat-2 Inland Bodies of Water',
            'GEDI Biomass Density',
            'GEDI Elevations w/Canopy',
            'GEDI Geolocated Waveforms'
          ],
          description: 'The preset label to apply.'
        }
      },
      required: ['preset']
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
    name: 'set_region',
    description:
      'Set the region of interest as a bounding box or polygon. Coordinates are in degrees (lon/lat, EPSG:4326). Sets the polygon, computes convex hull and area, and renders it on the map.',
    inputSchema: {
      type: 'object',
      properties: {
        bounds: {
          type: 'object',
          description: 'Bounding box with min/max lat/lon. Use this for rectangular regions.',
          properties: {
            min_lat: { type: 'number', description: 'Southern latitude (-90 to 90).' },
            max_lat: { type: 'number', description: 'Northern latitude (-90 to 90).' },
            min_lon: { type: 'number', description: 'Western longitude (-180 to 180).' },
            max_lon: { type: 'number', description: 'Eastern longitude (-180 to 180).' }
          },
          required: ['min_lat', 'max_lat', 'min_lon', 'max_lon']
        },
        coordinates: {
          type: 'array',
          description:
            'Array of {lon, lat} objects defining a polygon. Use this for non-rectangular regions. At least 3 points required.',
          items: {
            type: 'object',
            properties: {
              lon: { type: 'number' },
              lat: { type: 'number' }
            },
            required: ['lon', 'lat']
          }
        }
      }
    }
  },
  {
    name: 'zoom_to_location',
    description:
      'Zoom the map to a specific longitude/latitude location. Useful for navigating to a place by name or coordinates before drawing a region.',
    inputSchema: {
      type: 'object',
      properties: {
        lon: {
          type: 'number',
          description: 'Longitude in degrees (-180 to 180).'
        },
        lat: {
          type: 'number',
          description: 'Latitude in degrees (-90 to 90).'
        },
        zoom: {
          type: 'number',
          description: 'Zoom level (default 10). Higher values zoom in closer.'
        }
      },
      required: ['lon', 'lat']
    }
  },
  {
    name: 'get_area_thresholds',
    description:
      'Get the area warning and error thresholds (in km²) for the current API or a specified API. Use this to check if a region is too large before submitting a request.',
    inputSchema: {
      type: 'object',
      properties: {
        api: {
          type: 'string',
          description:
            'Optional API name to check thresholds for. If omitted, uses the currently selected API.'
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
    name: 'list_requests',
    description:
      'List all requests in the session with their status, API function, elapsed time, and point count. Returns newest first.',
    inputSchema: {
      type: 'object',
      properties: {}
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
    name: 'initialize',
    description:
      'Initialize Claude to work with the SlideRule web client. Call this at the start of every conversation. ' +
      'Returns workflow instructions, domain knowledge, key constraints, and available resources. ' +
      'Also enables scientific transparency mode by default.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  }
]
