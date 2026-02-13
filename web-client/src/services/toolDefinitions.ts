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
  }
]
