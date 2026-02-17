/**
 * MCP Prompt Templates — pre-built workflows that appear in Claude Desktop's UI.
 *
 * Each prompt guides Claude through a multi-tool workflow for a common
 * SlideRule use case. The user selects a prompt, fills in arguments, and
 * Claude receives step-by-step instructions referencing the available tools.
 */

interface PromptArgument {
  name: string
  description: string
  required: boolean
}

interface PromptDefinition {
  name: string
  description: string
  arguments: PromptArgument[]
}

interface PromptMessage {
  role: 'user' | 'assistant'
  content: { type: 'text'; text: string }
}

interface GetPromptResult {
  description: string
  messages: PromptMessage[]
}

const PROMPTS: PromptDefinition[] = [
  {
    name: 'analyze-region',
    description: 'Full workflow: set region, configure params, submit, analyze results',
    arguments: [
      {
        name: 'region_description',
        description:
          'Natural language description of the geographic region (e.g. "Juneau Icefield, Alaska")',
        required: true
      },
      {
        name: 'api',
        description:
          'SlideRule API to use (e.g. "atl06p", "atl08p", "gedi02ap"). Defaults to atl06p.',
        required: false
      },
      {
        name: 'time_range',
        description: 'Time range for the data (e.g. "2020-01-01 to 2023-12-31")',
        required: false
      }
    ]
  },
  {
    name: 'elevation-change',
    description: 'Compare elevation data between two time periods to detect change',
    arguments: [
      {
        name: 'region_description',
        description: 'Natural language description of the geographic region',
        required: true
      },
      {
        name: 'period_1',
        description: 'First time period (e.g. "2020-01-01 to 2020-12-31")',
        required: true
      },
      {
        name: 'period_2',
        description: 'Second time period (e.g. "2023-01-01 to 2023-12-31")',
        required: true
      }
    ]
  },
  {
    name: 'vegetation-analysis',
    description: 'Analyze canopy height and vegetation structure using ICESat-2 ATL08/PhoREAL',
    arguments: [
      {
        name: 'region_description',
        description: 'Natural language description of the forested/vegetated region to analyze',
        required: true
      }
    ]
  },
  {
    name: 'data-quality',
    description: 'Assess data coverage, completeness, and quality for a region and API',
    arguments: [
      {
        name: 'region_description',
        description: 'Natural language description of the geographic region',
        required: true
      },
      {
        name: 'api',
        description: 'SlideRule API to assess (e.g. "atl06p", "atl08p", "gedi02ap")',
        required: true
      }
    ]
  },
  {
    name: 'explore-data',
    description: 'Submit a request and interactively explore the results with SQL queries',
    arguments: [
      {
        name: 'region_description',
        description: 'Natural language description of the geographic region',
        required: true
      }
    ]
  }
]

function renderAnalyzeRegion(args: Record<string, string>): string {
  const region = args.region_description ?? 'the specified region'
  const api = args.api
    ? `Use the "${args.api}" API.`
    : 'Choose an appropriate API (default: atl06p for elevation).'
  const time = args.time_range
    ? `Set the time range to ${args.time_range}.`
    : 'Use a reasonable recent time range if not already set.'

  return `Analyze ICESat-2/GEDI elevation data for: ${region}

Follow these steps using the available SlideRule tools:

1. **Set the region**: Use \`set_region\` with a bounding box or GeoJSON polygon for ${region}. If you're unsure of the coordinates, make your best estimate for the area described.

2. **Configure the request**: ${api} Set the mission accordingly with \`set_mission\`. ${time}

3. **Submit and monitor**: Call \`submit_request\` to start processing. Poll with \`get_request_status\` until the request completes. Report the number of rows returned.

4. **Analyze the results**:
   - Call \`describe_data\` to see the available columns and row count.
   - Call \`get_elevation_stats\` for summary statistics (min, max, mean, percentiles, spatial extent).
   - Write SQL queries with \`run_sql\` to explore patterns — e.g. elevation by beam, temporal trends, spatial distributions.

5. **Visualize**: Use \`zoom_to_bbox\` to center the map on the region. Set the chart field with \`set_chart_field\` to visualize the elevation data.

6. **Summarize findings**: Provide a concise summary of the data — coverage, elevation range, notable patterns, and any data quality observations.`
}

function renderElevationChange(args: Record<string, string>): string {
  const region = args.region_description ?? 'the specified region'
  const period1 = args.period_1 ?? 'the first period'
  const period2 = args.period_2 ?? 'the second period'

  return `Compare elevation data between two time periods for: ${region}

The goal is to detect elevation change (ice loss, subsidence, land uplift, etc.) between ${period1} and ${period2}.

Follow these steps:

1. **Set the region**: Use \`set_region\` with a bounding box or GeoJSON polygon for ${region}.

2. **First period request**:
   - Set mission to ICESat-2 and API to atl06p (elevation).
   - Set time range to ${period1} with \`set_time_range\`.
   - Call \`submit_request\` and wait for completion with \`get_request_status\`.
   - Note the request ID for later comparison.
   - Call \`get_elevation_stats\` and record the results.

3. **Second period request**:
   - Set time range to ${period2} with \`set_time_range\`.
   - Call \`submit_request\` again and wait for completion.
   - Call \`get_elevation_stats\` and record the results.

4. **Compare the periods**:
   - Use \`run_sql\` to query both result sets. Compare mean elevations, spatial distributions, and point counts.
   - Look for systematic elevation differences between periods.
   - Compute summary statistics for the change.

5. **Visualize**: Use \`zoom_to_bbox\` to show the region. Use \`set_color_map\` to highlight elevation differences.

6. **Report**: Summarize the elevation change — magnitude, spatial pattern, and confidence based on data coverage and quality.`
}

function renderVegetationAnalysis(args: Record<string, string>): string {
  const region = args.region_description ?? 'the specified region'

  return `Analyze canopy height and vegetation structure for: ${region}

This workflow uses ICESat-2 ATL08 canopy height data to characterize vegetation.

Follow these steps:

1. **Set the region**: Use \`set_region\` with a bounding box or GeoJSON polygon for ${region}.

2. **Configure for vegetation**:
   - Set mission to ICESat-2 with \`set_mission\`.
   - Set API to "atl08p" with \`set_api\` — this provides canopy height metrics.

3. **Submit and monitor**: Call \`submit_request\` and poll with \`get_request_status\` until complete.

4. **Explore the canopy data**:
   - Call \`describe_data\` to see available fields (look for h_canopy, h_te_best, h_te_median, canopy_openness).
   - Call \`get_elevation_stats\` for terrain and canopy height summary.
   - Use \`run_sql\` to analyze canopy characteristics:
     - Mean and standard deviation of canopy height by beam
     - Distribution of canopy heights (histogram bins)
     - Areas with tall canopy (h_canopy > 20m) vs. short vegetation
     - Canopy height vs. terrain elevation relationships

5. **Visualize**:
   - Use \`set_chart_field\` to plot canopy heights.
   - Use \`set_color_map\` to color by canopy height.
   - Use \`zoom_to_bbox\` to center the map.

6. **Summarize**: Report canopy height statistics, vegetation structure patterns, and spatial distribution across the region.`
}

function renderDataQuality(args: Record<string, string>): string {
  const region = args.region_description ?? 'the specified region'
  const api = args.api ?? 'atl06p'

  return `Assess data coverage and quality for: ${region} using the "${api}" API

This workflow evaluates how well the data covers the region and identifies quality concerns.

Follow these steps:

1. **Set the region**: Use \`set_region\` with a bounding box or GeoJSON polygon for ${region}.

2. **Configure and submit**:
   - Infer the mission from the API ("${api}") and set it with \`set_mission\`.
   - Set the API with \`set_api\`.
   - Call \`submit_request\` and monitor with \`get_request_status\`. Note the granule count and row count.

3. **Assess coverage**:
   - Call \`describe_data\` to check the schema — are all expected columns present?
   - Call \`get_elevation_stats\` to get the spatial extent and check it against the requested region.
   - Use \`run_sql\` to compute coverage metrics:
     - Total point count and points per beam: \`SELECT beam, COUNT(*) FROM results GROUP BY beam\`
     - Spatial bounds: \`SELECT MIN(lat), MAX(lat), MIN(lon), MAX(lon) FROM results\`
     - Temporal distribution: point count per month/year if time columns exist

4. **Assess quality**:
   - Use \`run_sql\` to check quality flags: \`SELECT quality_flag, COUNT(*) FROM results GROUP BY quality_flag\`
   - Check for outliers in elevation or other key fields
   - Use \`get_sample_data\` to spot-check individual measurements
   - Search documentation with \`search_docs\` for quality flag definitions if needed

5. **Visualize**: Use \`zoom_to_bbox\` and \`set_base_layer\` for spatial context.

6. **Report**: Summarize coverage (spatial, temporal, per-beam), data quality (flag distribution, outliers), and any concerns or recommendations.`
}

function renderExploreData(args: Record<string, string>): string {
  const region = args.region_description ?? 'the specified region'

  return `Submit a SlideRule request and interactively explore the results for: ${region}

This is an open-ended data exploration workflow. The goal is to submit a request, understand the data, and let the user guide the analysis with SQL queries.

Follow these steps:

1. **Set the region**: Use \`set_region\` with a bounding box or GeoJSON polygon for ${region}.

2. **Configure and submit**: Choose an appropriate mission and API (default: ICESat-2 atl06p). Call \`submit_request\` and wait for completion with \`get_request_status\`.

3. **Understand the data**:
   - Call \`describe_data\` to show the full schema — column names, types, and row count.
   - Call \`get_sample_data\` to see representative rows.
   - Explain what each key column represents.

4. **Interactive exploration**: The data is in DuckDB and you can query it with \`run_sql\`. The SQL dialect is DuckDB (supports window functions, CTEs, spatial functions). Read-only, 30-second timeout. Start with overview queries and then follow the user's interests:
   - Column summaries: \`SELECT MIN(col), MAX(col), AVG(col) FROM results\`
   - Grouping: \`SELECT beam, COUNT(*), AVG(h_mean) FROM results GROUP BY beam\`
   - Filtering: \`SELECT * FROM results WHERE h_mean BETWEEN 100 AND 200\`
   - Spatial: \`SELECT lat, lon, h_mean FROM results WHERE lat > 60\`

5. **Visualize and export**:
   - Use \`set_chart_field\` and \`set_x_axis\` to create plots.
   - Use \`export_data\` to save results as Parquet if the user wants to download.
   - Use \`navigate\` to switch between map, chart, and analysis views.

Ask the user what they'd like to explore — this is their data sandbox.`
}

const RENDERERS: Record<string, (_args: Record<string, string>) => string> = {
  'analyze-region': renderAnalyzeRegion,
  'elevation-change': renderElevationChange,
  'vegetation-analysis': renderVegetationAnalysis,
  'data-quality': renderDataQuality,
  'explore-data': renderExploreData
}

export function listPrompts(): PromptDefinition[] {
  return PROMPTS
}

export function getPrompt(name: string, args: Record<string, string>): GetPromptResult {
  const def = PROMPTS.find((p) => p.name === name)
  if (!def) {
    throw new Error(
      `Unknown prompt: "${name}". Available: ${PROMPTS.map((p) => p.name).join(', ')}`
    )
  }

  const renderer = RENDERERS[name]
  const text = renderer(args)

  return {
    description: def.description,
    messages: [
      {
        role: 'user',
        content: { type: 'text', text }
      }
    ]
  }
}
