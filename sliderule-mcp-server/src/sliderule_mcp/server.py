#!/usr/bin/env python3
"""SlideRule MCP Server — bridges Claude Desktop to the SlideRule web client."""

import asyncio
import json
import logging
import os
import sys
import uuid

import websockets
from mcp.server.lowlevel import NotificationOptions, Server
from mcp.server.stdio import stdio_server
from mcp.shared.message import SessionMessage
import mcp.types as types

log = logging.getLogger("sliderule-mcp")

# ── State ────────────────────────────────────────────────────────
browser_ws = None
pending: dict[str, asyncio.Future] = {}
_mcp_write_stream = None
TIMEOUT_S = 60
PORT = int(os.environ.get("SR_MCP_PORT", "3002"))

# ── Bootstrap tool definitions ────────────────────────────────────
# Claude Desktop calls tools/list once at startup and does NOT re-fetch
# after notifications/tools/list_changed.  We must advertise ALL tools here
# so they are visible immediately.  The browser's live definitions override
# these when it connects (they should be identical).
BOOTSTRAP_TOOLS = [
    # ── Parameter Tools ──────────────────────────────────────────
    types.Tool(
        name="set_mission",
        description=(
            "Set the active mission to ICESat-2 or GEDI. This changes which "
            "APIs and parameters are available. Setting the mission resets "
            "the selected API to the mission default."
        ),
        inputSchema={
            "type": "object",
            "properties": {
                "mission": {
                    "type": "string",
                    "enum": ["ICESat-2", "GEDI"],
                    "description": 'The mission to set. Must be exactly "ICESat-2" or "GEDI".',
                }
            },
            "required": ["mission"],
        },
    ),
    types.Tool(
        name="set_api",
        description=(
            "Set the active API for the current mission. For ICESat-2: atl06p, "
            "atl06sp, atl06x, atl03x, atl03x-surface, atl03x-phoreal, atl03vp, "
            "atl08p, atl08x, atl24x, atl13x. For GEDI: gedi01bp, gedi02ap, "
            "gedi04ap. Setting the API auto-configures related parameters."
        ),
        inputSchema={
            "type": "object",
            "properties": {
                "api": {
                    "type": "string",
                    "description": "The API endpoint name to select.",
                }
            },
            "required": ["api"],
        },
    ),
    types.Tool(
        name="set_time_range",
        description=(
            "Set the time range for granule filtering. Automatically enables "
            "granule selection. Provide one or both of t0 and t1 as ISO 8601 "
            "date strings."
        ),
        inputSchema={
            "type": "object",
            "properties": {
                "t0": {
                    "type": "string",
                    "description": 'Start time in ISO 8601 format (e.g. "2020-01-01T00:00:00Z").',
                },
                "t1": {
                    "type": "string",
                    "description": 'End time in ISO 8601 format (e.g. "2023-12-31T23:59:59Z").',
                },
            },
        },
    ),
    types.Tool(
        name="set_rgt",
        description=(
            "Set the ICESat-2 Reference Ground Track number. Automatically "
            "enables granule selection and RGT filtering."
        ),
        inputSchema={
            "type": "object",
            "properties": {
                "rgt": {
                    "type": "integer",
                    "description": "Reference Ground Track number (1–1387).",
                    "minimum": 1,
                    "maximum": 1387,
                }
            },
            "required": ["rgt"],
        },
    ),
    types.Tool(
        name="set_cycle",
        description=(
            "Set the ICESat-2 orbital repeat cycle number. Automatically "
            "enables granule selection and cycle filtering."
        ),
        inputSchema={
            "type": "object",
            "properties": {
                "cycle": {
                    "type": "integer",
                    "description": "Orbital repeat cycle number (>= 1).",
                    "minimum": 1,
                }
            },
            "required": ["cycle"],
        },
    ),
    types.Tool(
        name="set_region",
        description=(
            "Set the geographic region for processing. Provide EITHER a bounding "
            "box (bbox with min/max lat/lon) OR a GeoJSON polygon geometry. The "
            "region defines the area of interest for the SlideRule request. Setting "
            "a region computes the convex hull and area automatically."
        ),
        inputSchema={
            "type": "object",
            "properties": {
                "bbox": {
                    "type": "object",
                    "description": "Bounding box with min/max latitude and longitude. Alternative to geojson.",
                    "properties": {
                        "min_lat": {"type": "number", "description": "Minimum latitude (-90 to 90)."},
                        "max_lat": {"type": "number", "description": "Maximum latitude (-90 to 90)."},
                        "min_lon": {"type": "number", "description": "Minimum longitude (-180 to 180)."},
                        "max_lon": {"type": "number", "description": "Maximum longitude (-180 to 180)."},
                    },
                    "required": ["min_lat", "max_lat", "min_lon", "max_lon"],
                },
                "geojson": {
                    "type": "object",
                    "description": "GeoJSON Polygon or MultiPolygon geometry object. Alternative to bbox. Coordinates are [lon, lat] arrays.",
                    "properties": {
                        "type": {
                            "type": "string",
                            "enum": ["Polygon", "MultiPolygon"],
                            "description": "GeoJSON geometry type.",
                        },
                        "coordinates": {"description": "GeoJSON coordinates array."},
                    },
                    "required": ["type", "coordinates"],
                },
            },
        },
    ),
    types.Tool(
        name="set_beams",
        description=(
            'Set the selected beams. For ICESat-2, provide ground track names: '
            '"gt1l", "gt1r", "gt2l", "gt2r", "gt3l", "gt3r", or "all". '
            'For GEDI, provide beam numbers: 0, 1, 2, 3, 5, 6, 8, 11, or "all". '
            "Automatically enables granule selection."
        ),
        inputSchema={
            "type": "object",
            "properties": {
                "beams": {
                    "oneOf": [
                        {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": 'ICESat-2 beam names (e.g. ["gt1l", "gt2r"]).',
                        },
                        {
                            "type": "array",
                            "items": {"type": "integer"},
                            "description": "GEDI beam numbers (e.g. [0, 1, 2]).",
                        },
                        {
                            "type": "string",
                            "enum": ["all"],
                            "description": "Select all beams.",
                        },
                    ]
                }
            },
            "required": ["beams"],
        },
    ),
    types.Tool(
        name="set_surface_fit",
        description=(
            "Configure the surface fit algorithm for ICESat-2 photon processing. "
            "Enabling surface fit automatically disables PhoREAL (they are "
            "mutually exclusive). Optionally set sub-parameters."
        ),
        inputSchema={
            "type": "object",
            "properties": {
                "enabled": {"type": "boolean", "description": "Enable or disable the surface fit algorithm."},
                "max_iterations": {"type": "integer", "description": "Maximum number of iterations for the fit."},
                "min_window_height": {"type": "number", "description": "Minimum window height in meters."},
                "sigma_r_max": {"type": "number", "description": "Maximum robust dispersion."},
            },
            "required": ["enabled"],
        },
    ),
    types.Tool(
        name="set_photon_params",
        description=(
            "Configure photon processing parameters for ICESat-2: segment length, "
            "step size, along-track spread, and minimum photon count. Provide at "
            "least one parameter."
        ),
        inputSchema={
            "type": "object",
            "properties": {
                "length": {"type": "number", "description": "Segment length in meters (default 40)."},
                "step": {"type": "number", "description": "Step size in meters (default 20)."},
                "along_track_spread": {"type": "number", "description": "Along-track spread threshold. Set to -1 to disable."},
                "min_photon_count": {"type": "integer", "description": "Minimum photon count threshold. Set to -1 to disable."},
            },
        },
    ),
    types.Tool(
        name="set_yapc",
        description=(
            "Configure YAPC (Yet Another Photon Classifier) for ICESat-2. "
            "Controls photon classification scoring. Optionally set score "
            "threshold, k-nearest-neighbors, window dimensions, and version."
        ),
        inputSchema={
            "type": "object",
            "properties": {
                "enabled": {"type": "boolean", "description": "Enable or disable YAPC."},
                "score": {"type": "number", "description": "YAPC score threshold (0.0–1.0)."},
                "knn": {"type": "integer", "description": "Number of nearest neighbors."},
                "window_height": {"type": "number", "description": "Window height in meters."},
                "window_width": {"type": "number", "description": "Window width in meters."},
                "version": {"type": "integer", "description": "YAPC algorithm version."},
            },
            "required": ["enabled"],
        },
    ),
    types.Tool(
        name="set_output_config",
        description=(
            "Configure output format settings: file output mode, GeoParquet "
            "format, and checksum generation."
        ),
        inputSchema={
            "type": "object",
            "properties": {
                "file_output": {"type": "boolean", "description": "Enable or disable file output (server-side parquet generation)."},
                "geo_parquet": {"type": "boolean", "description": "Use GeoParquet format (true) or plain Parquet (false)."},
                "checksum": {"type": "boolean", "description": "Include checksum in output."},
            },
        },
    ),
    types.Tool(
        name="get_current_params",
        description=(
            "Get the current request parameter state including mission, API, "
            "region, time range, beams, surface fit, YAPC, photon params, "
            "and output configuration."
        ),
        inputSchema={"type": "object", "properties": {}},
    ),
    types.Tool(
        name="reset_params",
        description=(
            "Reset all request parameters to their default values. This is "
            "a destructive operation that requires user confirmation in the browser."
        ),
        inputSchema={"type": "object", "properties": {}},
    ),
    # ── Request Lifecycle Tools ──────────────────────────────────
    types.Tool(
        name="submit_request",
        description=(
            "Submit the current parameters as a SlideRule processing request. "
            "Returns immediately with a req_id. Use get_request_status to poll "
            "for completion. The request spawns a Web Worker that streams "
            "Parquet results to OPFS and loads them into DuckDB."
        ),
        inputSchema={"type": "object", "properties": {}},
    ),
    types.Tool(
        name="get_request_status",
        description=(
            "Get the status of a processing request. Returns status (pending, "
            "started, progress, success, error, aborted), elapsed time, row "
            "count, granule count, byte count, and other details. Use this to "
            "poll after submit_request."
        ),
        inputSchema={
            "type": "object",
            "properties": {
                "req_id": {
                    "type": "integer",
                    "description": "The request ID returned by submit_request.",
                }
            },
            "required": ["req_id"],
        },
    ),
    types.Tool(
        name="cancel_request",
        description=(
            "Cancel a currently running request. Only works if a request is "
            "actively fetching data."
        ),
        inputSchema={"type": "object", "properties": {}},
    ),
    types.Tool(
        name="list_requests",
        description=(
            "List all requests in the session with their status, API function, "
            "elapsed time, and point count. Returns newest first."
        ),
        inputSchema={"type": "object", "properties": {}},
    ),
    types.Tool(
        name="delete_request",
        description=(
            "Delete a request and its associated data (summary, run context). "
            "This is a destructive operation that requires user confirmation "
            "in the browser."
        ),
        inputSchema={
            "type": "object",
            "properties": {
                "req_id": {
                    "type": "integer",
                    "description": "The request ID to delete.",
                }
            },
            "required": ["req_id"],
        },
    ),
    # ── Data Analysis Tools ──────────────────────────────────────
    types.Tool(
        name="run_sql",
        description=(
            "Execute a read-only SQL query against a request's result data "
            "using DuckDB WASM with spatial extension. Use describe_data first "
            "to learn the table name and schema. Results limited to max_rows "
            "(default 100). 30-second timeout."
        ),
        inputSchema={
            "type": "object",
            "properties": {
                "req_id": {
                    "type": "integer",
                    "description": "The request ID whose data to query.",
                },
                "sql": {
                    "type": "string",
                    "description": (
                        "SQL query to execute. The table name is the parquet "
                        "filename (use describe_data to find it). Example: "
                        "SELECT * FROM 'filename.parquet' LIMIT 10"
                    ),
                },
                "max_rows": {
                    "type": "integer",
                    "description": "Maximum number of rows to return (default 100, max 10000).",
                    "minimum": 1,
                    "maximum": 10000,
                },
            },
            "required": ["req_id", "sql"],
        },
    ),
    types.Tool(
        name="describe_data",
        description=(
            "Get the schema (column names and types), row count, and table "
            "name for a request's result set. Use this before run_sql to "
            "learn the available columns and the correct table name."
        ),
        inputSchema={
            "type": "object",
            "properties": {
                "req_id": {
                    "type": "integer",
                    "description": "The request ID whose data to describe.",
                }
            },
            "required": ["req_id"],
        },
    ),
    types.Tool(
        name="get_elevation_stats",
        description=(
            "Compute statistics for a request's result set: min, max, "
            "10th/90th percentile for all numeric columns. Also includes "
            "lat/lon extent and total point count."
        ),
        inputSchema={
            "type": "object",
            "properties": {
                "req_id": {
                    "type": "integer",
                    "description": "The request ID whose stats to compute.",
                }
            },
            "required": ["req_id"],
        },
    ),
    types.Tool(
        name="get_sample_data",
        description=(
            "Retrieve a random sample of rows from a request's result set. "
            "Uses DuckDB Bernoulli sampling for true randomness."
        ),
        inputSchema={
            "type": "object",
            "properties": {
                "req_id": {
                    "type": "integer",
                    "description": "The request ID whose data to sample.",
                },
                "num_rows": {
                    "type": "integer",
                    "description": "Number of rows to return (default 20, max 500).",
                    "minimum": 1,
                    "maximum": 500,
                },
            },
            "required": ["req_id"],
        },
    ),
    types.Tool(
        name="export_data",
        description=(
            "Export query results as a Parquet file for download. Triggers a "
            "browser download dialog. Optionally provide a custom SQL query; "
            "defaults to the full result set."
        ),
        inputSchema={
            "type": "object",
            "properties": {
                "req_id": {
                    "type": "integer",
                    "description": "The request ID whose data to export.",
                },
                "sql": {
                    "type": "string",
                    "description": "Optional SQL query to export. Defaults to SELECT * FROM the full result set.",
                },
                "filename": {
                    "type": "string",
                    "description": 'Optional output filename (default: "export_<req_id>.parquet").',
                },
            },
            "required": ["req_id"],
        },
    ),
    # ── Documentation Tools ─────────────────────────────────────
    types.Tool(
        name="search_docs",
        description=(
            "Search indexed SlideRule documentation using full-text search. "
            "Returns ranked results with snippets. Use this to find information "
            "about APIs, parameters, algorithms, and workflows."
        ),
        inputSchema={
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": 'Search query (e.g. "photon classification glacier", "atl06 surface fit").',
                },
                "max_results": {
                    "type": "integer",
                    "description": "Maximum number of results (default 10, max 50).",
                    "minimum": 1,
                    "maximum": 50,
                },
            },
            "required": ["query"],
        },
    ),
    types.Tool(
        name="fetch_docs",
        description=(
            "Fetch a SlideRule ReadTheDocs page, parse it to text, and index "
            "it for future searches. URL must be under slideruleearth.io."
        ),
        inputSchema={
            "type": "object",
            "properties": {
                "url": {
                    "type": "string",
                    "description": 'URL to fetch (e.g. "https://slideruleearth.io/web/rtd/user_guide/icesat2.html").',
                }
            },
            "required": ["url"],
        },
    ),
    types.Tool(
        name="get_param_help",
        description=(
            "Get detailed help for a specific SlideRule parameter. Returns "
            "tooltip text, default values, valid values, and documentation URL."
        ),
        inputSchema={
            "type": "object",
            "properties": {
                "param_name": {
                    "type": "string",
                    "description": 'Parameter name (e.g. "cnf", "srt", "length", "yapc_score").',
                }
            },
            "required": ["param_name"],
        },
    ),
    types.Tool(
        name="list_doc_sections",
        description=(
            "List all indexed documentation sections with their titles and "
            "chunk counts. Useful to discover available documentation."
        ),
        inputSchema={"type": "object", "properties": {}},
    ),
    # ── Map Tools ──────────────────────────────────────────────
    types.Tool(
        name="zoom_to_bbox",
        description=(
            "Zoom the map to a bounding box defined by min/max latitude and "
            "longitude. Animates the map to fit the specified extent."
        ),
        inputSchema={
            "type": "object",
            "properties": {
                "min_lat": {"type": "number", "description": "Minimum latitude (-90 to 90)."},
                "max_lat": {"type": "number", "description": "Maximum latitude (-90 to 90)."},
                "min_lon": {"type": "number", "description": "Minimum longitude (-180 to 180)."},
                "max_lon": {"type": "number", "description": "Maximum longitude (-180 to 180)."},
            },
            "required": ["min_lat", "max_lat", "min_lon", "max_lon"],
        },
    ),
    types.Tool(
        name="zoom_to_point",
        description=(
            "Center the map on a specific latitude/longitude point with an "
            "optional zoom level."
        ),
        inputSchema={
            "type": "object",
            "properties": {
                "lat": {"type": "number", "description": "Latitude (-90 to 90)."},
                "lon": {"type": "number", "description": "Longitude (-180 to 180)."},
                "zoom": {
                    "type": "number",
                    "description": "Zoom level (0–23). Higher = more zoomed in. Default: 10.",
                    "minimum": 0,
                    "maximum": 23,
                },
            },
            "required": ["lat", "lon"],
        },
    ),
    types.Tool(
        name="set_base_layer",
        description=(
            "Change the map base layer (satellite imagery, topography, etc.). "
            'Common layers: "Esri World Topo", "Esri World Imagery", '
            '"OpenStreetMap Standard", "Google Satellite". Polar views have '
            'specialized layers like "Arctic Ocean Base", "Antarctic Imagery", "LIMA".'
        ),
        inputSchema={
            "type": "object",
            "properties": {
                "layer": {
                    "type": "string",
                    "description": 'Base layer name (e.g. "Esri World Imagery").',
                }
            },
            "required": ["layer"],
        },
    ),
    types.Tool(
        name="set_map_view",
        description=(
            "Switch the map projection/view. "
            '"Global Mercator" (EPSG:3857) for worldwide, '
            '"North Alaska" (EPSG:5936) for Arctic, '
            '"North Sea Ice" (EPSG:3413) for Arctic sea ice, '
            '"South" (EPSG:3031) for Antarctic.'
        ),
        inputSchema={
            "type": "object",
            "properties": {
                "view": {
                    "type": "string",
                    "enum": ["Global Mercator", "North Alaska", "North Sea Ice", "South"],
                    "description": "Map view/projection name.",
                }
            },
            "required": ["view"],
        },
    ),
    types.Tool(
        name="toggle_graticule",
        description=(
            "Show or hide the latitude/longitude grid (graticule) overlay "
            "on the map."
        ),
        inputSchema={
            "type": "object",
            "properties": {
                "visible": {
                    "type": "boolean",
                    "description": "True to show the graticule, false to hide it.",
                }
            },
            "required": ["visible"],
        },
    ),
    types.Tool(
        name="set_draw_mode",
        description=(
            'Set the region drawing mode on the map. "Polygon" for freeform '
            'polygon, "Box" for rectangle, "" (empty string) to disable drawing.'
        ),
        inputSchema={
            "type": "object",
            "properties": {
                "mode": {
                    "type": "string",
                    "enum": ["Polygon", "Box", ""],
                    "description": 'Drawing mode: "Polygon", "Box", or "" to disable.',
                }
            },
            "required": ["mode"],
        },
    ),
    # ── Visualization Tools ──────────────────────────────────────
    types.Tool(
        name="set_chart_field",
        description=(
            "Set which data field to plot on the elevation chart Y-axis for "
            "a given request. Use describe_data to discover available columns."
        ),
        inputSchema={
            "type": "object",
            "properties": {
                "req_id": {
                    "type": "integer",
                    "description": "The request ID whose chart to configure.",
                },
                "field": {
                    "type": "string",
                    "description": 'Column name for the Y-axis (e.g. "h_mean", "height").',
                },
            },
            "required": ["req_id", "field"],
        },
    ),
    types.Tool(
        name="set_x_axis",
        description=(
            "Set the X-axis field for the elevation chart. Common values: "
            '"x_atc" (along-track distance), "latitude", "segment_dist_x", '
            '"time_ns_plot", "time_plot".'
        ),
        inputSchema={
            "type": "object",
            "properties": {
                "req_id": {
                    "type": "integer",
                    "description": "The request ID whose chart to configure.",
                },
                "field": {
                    "type": "string",
                    "description": 'Column name for the X-axis (e.g. "x_atc", "latitude").',
                },
            },
            "required": ["req_id", "field"],
        },
    ),
    types.Tool(
        name="set_color_map",
        description=(
            "Set the gradient color map used for elevation/data visualization. "
            "Palettes include: viridis, jet, inferno, magma, plasma, hot, cool, "
            "rainbow, RdBu, bluered, earth, bathymetry, temperature, and more."
        ),
        inputSchema={
            "type": "object",
            "properties": {
                "palette": {
                    "type": "string",
                    "description": 'Color map name (e.g. "viridis", "jet", "inferno").',
                }
            },
            "required": ["palette"],
        },
    ),
    types.Tool(
        name="set_3d_config",
        description=(
            "Configure the 3D elevation view (Deck.gl). Set vertical "
            "exaggeration, point size, field of view, and axes visibility."
        ),
        inputSchema={
            "type": "object",
            "properties": {
                "vertical_exaggeration": {
                    "type": "number",
                    "description": "Vertical exaggeration multiplier (default 1.0).",
                },
                "point_size": {
                    "type": "number",
                    "description": "Point size multiplier (default 1.0).",
                    "minimum": 0.1,
                },
                "fov": {
                    "type": "number",
                    "description": "Field of view in degrees (default 50).",
                    "minimum": 10,
                    "maximum": 120,
                },
                "show_axes": {
                    "type": "boolean",
                    "description": "Show or hide 3D axes.",
                },
            },
        },
    ),
    types.Tool(
        name="get_elevation_plot_config",
        description=(
            "Get current elevation plot configuration: Y-axis field, X-axis field, "
            "color encoding, symbol size/color, photon cloud, slope lines, tooltip, "
            "and available field options."
        ),
        inputSchema={
            "type": "object",
            "properties": {
                "req_id": {
                    "type": "integer",
                    "description": "The request ID whose plot config to read.",
                },
            },
            "required": ["req_id"],
        },
    ),
    types.Tool(
        name="set_plot_options",
        description=(
            "Configure chart plot options: color encoding, symbol size/color, "
            "Y-axis field, time-based X-axis, photon cloud overlay, slope lines, "
            "and tooltip visibility."
        ),
        inputSchema={
            "type": "object",
            "properties": {
                "req_id": {
                    "type": "integer",
                    "description": "The request ID whose plot to configure.",
                },
                "y_field": {
                    "type": "string",
                    "description": 'Y-axis data field (e.g. "h_mean", "h_ph"). Use get_elevation_plot_config to see options.',
                },
                "color_field": {
                    "type": "string",
                    "description": 'Field name for color encoding (e.g. "h_mean"), or "solid" for single color.',
                },
                "solid_color": {
                    "type": "string",
                    "description": 'Solid symbol color when color_field is "solid" (e.g. "red", "#ff0000").',
                },
                "symbol_size": {
                    "type": "number",
                    "description": "Symbol/point size in pixels (default varies by API).",
                    "minimum": 1,
                    "maximum": 20,
                },
                "use_time_for_x_axis": {
                    "type": "boolean",
                    "description": "Use time instead of along-track distance for X-axis.",
                },
                "show_photon_cloud": {
                    "type": "boolean",
                    "description": "Show or hide ATL03 photon cloud overlay on the plot.",
                },
                "show_slope_lines": {
                    "type": "boolean",
                    "description": "Show or hide slope/segment lines on the plot.",
                },
                "show_tooltip": {
                    "type": "boolean",
                    "description": "Show or hide chart tooltips on hover.",
                },
            },
        },
    ),
    # ── UI Tools ────────────────────────────────────────────────
    types.Tool(
        name="start_tour",
        description=(
            "Start an interactive guided tour of the SlideRule web client UI. "
            'The tour highlights key UI elements and walks the user through '
            'the app. Use "quick" for the 4-step essentials (zoom, draw, run, '
            'analyze) or "long" for a comprehensive walkthrough of all controls '
            "and views."
        ),
        inputSchema={
            "type": "object",
            "properties": {
                "type": {
                    "type": "string",
                    "enum": ["quick", "long"],
                    "description": (
                        '"quick" = 4-step essentials (zoom, draw, run, analyze). '
                        '"long" = full walkthrough of all controls.'
                    ),
                }
            },
            "required": ["type"],
        },
    ),
    # ── Navigation Tools ──────────────────────────────────────────
    types.Tool(
        name="navigate",
        description=(
            "Navigate to a view in the web client. Use 'analyze' with a "
            "req_id to view results, 'request' to set up parameters, "
            "'settings' for app configuration, 'rectree' for the request "
            "tree, 'server' for server management."
        ),
        inputSchema={
            "type": "object",
            "properties": {
                "view": {
                    "type": "string",
                    "enum": [
                        "home", "request", "analyze", "settings",
                        "about", "server", "rectree", "privacy",
                    ],
                    "description": "The view to navigate to.",
                },
                "req_id": {
                    "type": "integer",
                    "description": (
                        "Required when navigating to 'analyze'. The request "
                        "ID to view. Also accepted for 'request' to load a "
                        "specific request's parameters."
                    ),
                },
            },
            "required": ["view"],
        },
    ),
    types.Tool(
        name="get_current_view",
        description=(
            "Get the current view/page in the web client. Returns the active "
            "route name, path, route params, and a list of all available views."
        ),
        inputSchema={"type": "object", "properties": {}},
    ),
]

cached_tools: list[types.Tool] = list(BOOTSTRAP_TOOLS)

# ── Bootstrap resource definitions ────────────────────────────────
# Same approach as tools: static bootstrap so Claude Desktop sees them
# immediately.  Browser overrides these when it connects.
BOOTSTRAP_RESOURCES = [
    types.Resource(
        uri="sliderule://params/current",
        name="Current Parameters",
        description="Full current parameter state from reqParamsStore",
        mimeType="application/json",
    ),
    types.Resource(
        uri="sliderule://requests/history",
        name="Request History",
        description="All request records with status, timing, and point counts",
        mimeType="application/json",
    ),
    types.Resource(
        uri="sliderule://map/viewport",
        name="Map Viewport",
        description="Current map center, zoom, projection, and visible extent",
        mimeType="application/json",
    ),
    types.Resource(
        uri="sliderule://catalog/products",
        name="Available Products",
        description="Available missions and their API endpoints",
        mimeType="application/json",
    ),
    types.Resource(
        uri="sliderule://auth/status",
        name="Auth Status",
        description="Current authentication state: username, org membership",
        mimeType="application/json",
    ),
    types.Resource(
        uri="sliderule://docs/index",
        name="Documentation Index",
        description="All indexed doc sections with titles and chunk counts",
        mimeType="application/json",
    ),
    types.Resource(
        uri="sliderule://docs/tooltips",
        name="All Tooltips",
        description="All in-app tooltip text organized by parameter",
        mimeType="application/json",
    ),
    types.Resource(
        uri="sliderule://app/current-view",
        name="Current View",
        description="Current Vue Router view name, path, params, and list of available routes",
        mimeType="application/json",
    ),
]

BOOTSTRAP_RESOURCE_TEMPLATES = [
    types.ResourceTemplate(
        uriTemplate="sliderule://requests/{id}/summary",
        name="Request Summary",
        description="Status, timing, row count for a specific request",
        mimeType="application/json",
    ),
    types.ResourceTemplate(
        uriTemplate="sliderule://data/{id}/schema",
        name="Data Schema",
        description="Column names and types for a result set",
        mimeType="application/json",
    ),
    types.ResourceTemplate(
        uriTemplate="sliderule://data/{id}/sample",
        name="Data Sample",
        description="First 20 rows of a result set",
        mimeType="application/json",
    ),
    types.ResourceTemplate(
        uriTemplate="sliderule://catalog/fields/{api}",
        name="API Fields",
        description="Available data fields for a specific API",
        mimeType="application/json",
    ),
    types.ResourceTemplate(
        uriTemplate="sliderule://docs/section/{section}",
        name="Doc Section",
        description="All chunks for a documentation section",
        mimeType="application/json",
    ),
    types.ResourceTemplate(
        uriTemplate="sliderule://docs/param/{name}",
        name="Parameter Help",
        description="Parameter help: tooltip, defaults, valid values, doc URL",
        mimeType="application/json",
    ),
    types.ResourceTemplate(
        uriTemplate="sliderule://docs/defaults/{mission}",
        name="Server Defaults",
        description="Server defaults for a mission (icesat2, gedi, core)",
        mimeType="application/json",
    ),
]

BOOTSTRAP_PROMPTS = [
    types.Prompt(
        name="analyze-region",
        description="Full workflow: set region, configure params, submit, analyze results",
        arguments=[
            types.PromptArgument(
                name="region_description",
                description='Natural language description of the geographic region (e.g. "Juneau Icefield, Alaska")',
                required=True,
            ),
            types.PromptArgument(
                name="api",
                description='SlideRule API to use (e.g. "atl06p", "atl08p", "gedi02ap"). Defaults to atl06p.',
                required=False,
            ),
            types.PromptArgument(
                name="time_range",
                description='Time range for the data (e.g. "2020-01-01 to 2023-12-31")',
                required=False,
            ),
        ],
    ),
    types.Prompt(
        name="elevation-change",
        description="Compare elevation data between two time periods to detect change",
        arguments=[
            types.PromptArgument(
                name="region_description",
                description="Natural language description of the geographic region",
                required=True,
            ),
            types.PromptArgument(
                name="period_1",
                description='First time period (e.g. "2020-01-01 to 2020-12-31")',
                required=True,
            ),
            types.PromptArgument(
                name="period_2",
                description='Second time period (e.g. "2023-01-01 to 2023-12-31")',
                required=True,
            ),
        ],
    ),
    types.Prompt(
        name="vegetation-analysis",
        description="Analyze canopy height and vegetation structure using ICESat-2 ATL08/PhoREAL",
        arguments=[
            types.PromptArgument(
                name="region_description",
                description="Natural language description of the forested/vegetated region to analyze",
                required=True,
            ),
        ],
    ),
    types.Prompt(
        name="data-quality",
        description="Assess data coverage, completeness, and quality for a region and API",
        arguments=[
            types.PromptArgument(
                name="region_description",
                description="Natural language description of the geographic region",
                required=True,
            ),
            types.PromptArgument(
                name="api",
                description='SlideRule API to assess (e.g. "atl06p", "atl08p", "gedi02ap")',
                required=True,
            ),
        ],
    ),
    types.Prompt(
        name="explore-data",
        description="Submit a request and interactively explore the results with SQL queries",
        arguments=[
            types.PromptArgument(
                name="region_description",
                description="Natural language description of the geographic region",
                required=True,
            ),
        ],
    ),
]

cached_resources: list[types.Resource] = list(BOOTSTRAP_RESOURCES)
cached_resource_templates: list[types.ResourceTemplate] = list(BOOTSTRAP_RESOURCE_TEMPLATES)
cached_prompts: list[types.Prompt] = list(BOOTSTRAP_PROMPTS)

# ── MCP Server ───────────────────────────────────────────────────
mcp_server = Server("sliderule-web")


@mcp_server.list_tools()
async def handle_list_tools() -> list[types.Tool]:
    return cached_tools


@mcp_server.list_resources()
async def handle_list_resources() -> list[types.Resource]:
    return cached_resources


@mcp_server.list_resource_templates()
async def handle_list_resource_templates() -> list[types.ResourceTemplate]:
    return cached_resource_templates


@mcp_server.list_prompts()
async def handle_list_prompts() -> list[types.Prompt]:
    return cached_prompts


# Register read_resource manually so we can forward to the browser.
async def _handle_read_resource(req: types.ReadResourceRequest) -> types.ServerResult:
    uri = str(req.params.uri)

    if browser_ws is None:
        return types.ServerResult(
            types.ReadResourceResult(
                contents=[
                    types.TextResourceContents(
                        uri=uri,
                        mimeType="text/plain",
                        text="Browser not connected. Please open the SlideRule web client first.",
                    )
                ]
            )
        )

    result = await _call_browser("resources/read", {"uri": uri})
    contents = []
    for item in result.get("contents", []):
        contents.append(
            types.TextResourceContents(
                uri=item.get("uri", uri),
                mimeType=item.get("mimeType", "application/json"),
                text=item.get("text", ""),
            )
        )
    return types.ServerResult(types.ReadResourceResult(contents=contents))


mcp_server.request_handlers[types.ReadResourceRequest] = _handle_read_resource


# Register call_tool manually to support isError on the result.
async def _handle_call_tool(req: types.CallToolRequest) -> types.ServerResult:
    name = req.params.name
    arguments = req.params.arguments or {}

    if browser_ws is None:
        return types.ServerResult(
            types.CallToolResult(
                content=[
                    types.TextContent(
                        type="text",
                        text="Browser not connected. Please open the SlideRule web client first.",
                    )
                ],
                isError=True,
            )
        )

    result = await _call_browser("tools/call", {"name": name, "arguments": arguments})
    content = [
        types.TextContent(type="text", text=item.get("text", ""))
        for item in result.get("content", [])
        if item.get("type") == "text"
    ]
    return types.ServerResult(
        types.CallToolResult(content=content, isError=result.get("isError", False))
    )


mcp_server.request_handlers[types.CallToolRequest] = _handle_call_tool


# Register get_prompt manually to forward to the browser.
async def _handle_get_prompt(req: types.GetPromptRequest) -> types.ServerResult:
    name = req.params.name
    arguments = req.params.arguments or {}

    if browser_ws is None:
        return types.ServerResult(
            types.GetPromptResult(
                description=f"Prompt: {name}",
                messages=[
                    types.PromptMessage(
                        role="user",
                        content=types.TextContent(
                            type="text",
                            text="Browser not connected. Please open the SlideRule web client first.",
                        ),
                    )
                ],
            )
        )

    result = await _call_browser("prompts/get", {"name": name, "arguments": arguments})
    messages = [
        types.PromptMessage(
            role=m.get("role", "user"),
            content=types.TextContent(type="text", text=m["content"]["text"]),
        )
        for m in result.get("messages", [])
    ]
    return types.ServerResult(
        types.GetPromptResult(description=result.get("description", ""), messages=messages)
    )


mcp_server.request_handlers[types.GetPromptRequest] = _handle_get_prompt


# ── Notify Claude Desktop that the tool list changed ─────────────
async def _notify_tools_changed():
    if _mcp_write_stream is None:
        return
    try:
        notification = types.JSONRPCNotification(
            jsonrpc="2.0", method="notifications/tools/list_changed"
        )
        msg = SessionMessage(message=types.JSONRPCMessage(notification))
        await _mcp_write_stream.send(msg)
        log.info("Sent tools/list_changed notification (%d tools)", len(cached_tools))
    except Exception:
        log.exception("Failed to send tools/list_changed notification")


# ── Fetch tool definitions from the browser and cache them ───────
async def _fetch_and_cache_tools():
    global cached_tools
    try:
        result = await _call_browser("tools/list", {})
        tools = [
            types.Tool(
                name=t["name"],
                description=t.get("description", ""),
                inputSchema=t.get("inputSchema", {"type": "object", "properties": {}}),
            )
            for t in result.get("tools", [])
        ]
        cached_tools = tools
        log.info("Cached %d tool definitions from browser", len(tools))
        await _notify_tools_changed()
    except Exception:
        log.exception("Failed to fetch tool definitions from browser")


# ── Fetch resource definitions from the browser and cache them ───
async def _fetch_and_cache_resources():
    global cached_resources, cached_resource_templates
    try:
        result = await _call_browser("resources/list", {})
        resources = [
            types.Resource(
                uri=r["uri"],
                name=r.get("name", ""),
                description=r.get("description", ""),
                mimeType=r.get("mimeType", "application/json"),
            )
            for r in result.get("resources", [])
        ]
        templates = [
            types.ResourceTemplate(
                uriTemplate=t["uriTemplate"],
                name=t.get("name", ""),
                description=t.get("description", ""),
                mimeType=t.get("mimeType", "application/json"),
            )
            for t in result.get("resourceTemplates", [])
        ]
        cached_resources = resources
        cached_resource_templates = templates
        log.info(
            "Cached %d resources, %d templates from browser",
            len(resources),
            len(templates),
        )
    except Exception:
        log.exception("Failed to fetch resource definitions from browser")


# ── Fetch prompt definitions from the browser and cache them ─────
async def _fetch_and_cache_prompts():
    global cached_prompts
    try:
        result = await _call_browser("prompts/list", {})
        prompts = [
            types.Prompt(
                name=p["name"],
                description=p.get("description", ""),
                arguments=[
                    types.PromptArgument(
                        name=a["name"],
                        description=a.get("description", ""),
                        required=a.get("required", False),
                    )
                    for a in p.get("arguments", [])
                ],
            )
            for p in result.get("prompts", [])
        ]
        cached_prompts = prompts
        log.info("Cached %d prompt definitions from browser", len(prompts))
    except Exception:
        log.exception("Failed to fetch prompt definitions from browser")


# ── Forward a request to the browser and wait for response ───────
async def _call_browser(method: str, params: dict) -> dict:
    if browser_ws is None:
        raise RuntimeError("No browser connected")

    msg_id = str(uuid.uuid4())
    future: asyncio.Future = asyncio.get_running_loop().create_future()
    pending[msg_id] = future

    try:
        await browser_ws.send(
            json.dumps(
                {"jsonrpc": "2.0", "id": msg_id, "method": method, "params": params}
            )
        )
        return await asyncio.wait_for(future, timeout=TIMEOUT_S)
    except asyncio.TimeoutError:
        raise TimeoutError(f"Browser did not respond within {TIMEOUT_S}s")
    finally:
        pending.pop(msg_id, None)


# ── WebSocket — browser connects here ────────────────────────────
ALLOWED_ORIGINS = {
    "http://localhost:5173",   # Vite dev server
    "http://localhost:4173",   # Vite preview
    "http://localhost:3000",   # Alternative dev port
    "http://127.0.0.1:5173",
    "http://127.0.0.1:4173",
    "http://127.0.0.1:3000",
    "https://testsliderule.org",            # Deployed test site
    "https://client.slideruleearth.io",     # Deployed production site
}


async def _ws_handler(websocket):
    global browser_ws, cached_tools, cached_resources, cached_resource_templates, cached_prompts

    origin = websocket.request.headers.get("Origin", "")
    if origin and origin not in ALLOWED_ORIGINS:
        log.warning("Rejected WebSocket from origin: %s", origin)
        await websocket.close(4003, "Origin not allowed")
        return

    if browser_ws is not None:
        await browser_ws.close(4000, "Replaced by new connection")

    browser_ws = websocket
    log.info("Browser connected on ws://localhost:%d (origin: %s)", PORT, origin or "none")

    # Fetch definitions in background tasks so the message loop
    # can process the responses (avoids deadlock).
    asyncio.create_task(_fetch_and_cache_tools())
    asyncio.create_task(_fetch_and_cache_resources())
    asyncio.create_task(_fetch_and_cache_prompts())

    try:
        async for raw in websocket:
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                continue

            future = pending.pop(msg.get("id"), None)
            if future is not None and not future.done():
                if "error" in msg:
                    future.set_exception(
                        RuntimeError(msg["error"].get("message", "Browser error"))
                    )
                else:
                    future.set_result(msg.get("result", {}))
    finally:
        if browser_ws is websocket:
            browser_ws = None
            cached_tools = list(BOOTSTRAP_TOOLS)
            cached_resources = list(BOOTSTRAP_RESOURCES)
            cached_resource_templates = list(BOOTSTRAP_RESOURCE_TEMPLATES)
            cached_prompts = list(BOOTSTRAP_PROMPTS)
            log.info("Browser disconnected, restored bootstrap definitions")


# ── Entry point ──────────────────────────────────────────────────
async def _run():
    global _mcp_write_stream

    async with websockets.serve(_ws_handler, "localhost", PORT):
        log.info("Ready. WebSocket on ws://localhost:%d. Waiting for browser...", PORT)
        async with stdio_server() as (read_stream, write_stream):
            _mcp_write_stream = write_stream
            await mcp_server.run(
                read_stream,
                write_stream,
                mcp_server.create_initialization_options(
                    notification_options=NotificationOptions(
                    prompts_changed=True,
                    tools_changed=True,
                    resources_changed=True,
                ),
                ),
            )


def main():
    logging.basicConfig(
        level=logging.INFO, stream=sys.stderr, format="[mcp] %(message)s"
    )
    asyncio.run(_run())


if __name__ == "__main__":
    main()
