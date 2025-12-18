/**
 * Utilities for converting request parameters between JSON, Python, and Lua formats
 */

/**
 * Converts a JavaScript value to Python literal representation
 * @param data - The value to convert
 * @param indent - Current indentation level
 * @returns Python literal string
 */
export function jsonToPythonDict(data: unknown, indent: number = 0): string {
  const spaces = '    '.repeat(indent)
  const innerSpaces = '    '.repeat(indent + 1)

  if (data === null || data === undefined) {
    return 'None'
  }

  if (typeof data === 'boolean') {
    return data ? 'True' : 'False'
  }

  if (typeof data === 'number') {
    return String(data)
  }

  if (typeof data === 'string') {
    // Use double quotes and escape as needed
    const escaped = data.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')
    return `"${escaped}"`
  }

  if (Array.isArray(data)) {
    if (data.length === 0) {
      return '[]'
    }
    // Check if it's a simple array (all primitives)
    const isSimple = data.every((item) => typeof item !== 'object' || item === null)
    if (isSimple && data.length <= 5) {
      const items = data.map((item) => jsonToPythonDict(item, 0)).join(', ')
      return `[${items}]`
    }
    const items = data
      .map((item) => `${innerSpaces}${jsonToPythonDict(item, indent + 1)}`)
      .join(',\n')
    return `[\n${items}\n${spaces}]`
  }

  if (typeof data === 'object') {
    const entries = Object.entries(data as Record<string, unknown>)
    if (entries.length === 0) {
      return '{}'
    }
    const items = entries
      .map(([key, value]) => {
        const pyValue = jsonToPythonDict(value, indent + 1)
        return `${innerSpaces}"${key}": ${pyValue}`
      })
      .join(',\n')
    return `{\n${items}\n${spaces}}`
  }

  return String(data)
}

/**
 * Maps web client endpoints to SlideRule run() API names (for non-GEDI endpoints)
 */
const endpointToRunName: Record<string, string> = {
  atl06: 'atl06',
  atl06p: 'atl06',
  atl06sp: 'atl06',
  atl03x: 'atl03x',
  'atl03x-surface': 'atl03x',
  'atl03x-phoreal': 'atl03x',
  atl03sp: 'atl03x',
  atl03vp: 'atl03x',
  atl08: 'atl08',
  atl08p: 'atl08',
  atl24x: 'atl24x',
  atl13x: 'atl13x'
}

/**
 * Maps GEDI endpoints to their gedi module function names
 */
const gediEndpointToFunc: Record<string, string> = {
  gedi01bp: 'gedi01bp',
  gedi02ap: 'gedi02ap',
  gedi04ap: 'gedi04ap'
}

/**
 * Checks if the request parameters specify a file output format
 * @param jsonData - The request parameters object
 * @returns The output format if specified, otherwise null
 */
function getOutputFormat(jsonData: unknown): string | null {
  if (jsonData && typeof jsonData === 'object' && 'output' in jsonData) {
    const output = (jsonData as Record<string, unknown>).output
    if (output && typeof output === 'object' && 'format' in output) {
      return (output as Record<string, unknown>).format as string
    }
  }
  return null
}

/**
 * Generates complete SlideRule Python client code
 * @param jsonData - The request parameters object
 * @param endpoint - The API endpoint (e.g., 'atl06p')
 * @returns Complete runnable Python script
 */
export function generatePythonClientCode(jsonData: unknown, endpoint: string): string {
  const normalizedEndpoint = endpoint.toLowerCase().trim()
  const parmsDict = jsonToPythonDict(jsonData, 0)

  // Check if this is a GEDI endpoint
  const gediFunc = gediEndpointToFunc[normalizedEndpoint]
  const isGedi = !!gediFunc

  // Check if output format is specified (returns file path instead of GeoDataFrame)
  const outputFormat = getOutputFormat(jsonData)
  const hasFileOutput =
    outputFormat === 'parquet' || outputFormat === 'geoparquet' || outputFormat === 'csv'

  // Determine import and execute statements based on endpoint type
  const importStatement = isGedi
    ? 'from sliderule import sliderule, gedi'
    : 'from sliderule import sliderule'

  const executeStatement = isGedi
    ? `gedi.${gediFunc}(parms)`
    : `sliderule.run("${endpointToRunName[normalizedEndpoint] || normalizedEndpoint}", parms)`

  if (hasFileOutput) {
    // When output format is specified, the API returns a file path
    const geopandasImport =
      outputFormat === 'csv' ? 'import pandas as pd' : 'import geopandas as gpd'
    const readFunc = outputFormat === 'csv' ? 'pd.read_csv' : 'gpd.read_parquet'

    return `#!/usr/bin/env python3
"""
SlideRule request generated from web client
Endpoint: ${endpoint}
"""

${importStatement}
${geopandasImport}

# Initialize SlideRule client
sliderule.init("slideruleearth.io")

# Request parameters
parms = ${parmsDict}

# Execute request (returns file path when output format is specified)
output_file = ${executeStatement}
print(f"Data saved to: {output_file}")

# Read the output file into a GeoDataFrame
gdf = ${readFunc}(output_file)

# Display results
print(f"Retrieved {len(gdf)} records")
print(gdf.head())
`
  }

  return `#!/usr/bin/env python3
"""
SlideRule request generated from web client
Endpoint: ${endpoint}
"""

${importStatement}

# Initialize SlideRule client
sliderule.init("slideruleearth.io")

# Request parameters
parms = ${parmsDict}

# Execute request
gdf = ${executeStatement}

# Display results
print(f"Retrieved {len(gdf)} records")
print(gdf.head())
`
}

/**
 * Converts a JavaScript value to Lua table literal representation
 * @param data - The value to convert
 * @param indent - Current indentation level
 * @returns Lua table literal string
 */
export function jsonToLuaTable(data: unknown, indent: number = 0): string {
  const spaces = '    '.repeat(indent)
  const innerSpaces = '    '.repeat(indent + 1)

  if (data === null || data === undefined) {
    return 'nil'
  }

  if (typeof data === 'boolean') {
    return data ? 'true' : 'false'
  }

  if (typeof data === 'number') {
    return String(data)
  }

  if (typeof data === 'string') {
    // Use double quotes and escape as needed
    const escaped = data.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')
    return `"${escaped}"`
  }

  if (Array.isArray(data)) {
    if (data.length === 0) {
      return '{}'
    }
    // Check if it's a simple array (all primitives)
    const isSimple = data.every((item) => typeof item !== 'object' || item === null)
    if (isSimple && data.length <= 5) {
      const items = data.map((item) => jsonToLuaTable(item, 0)).join(', ')
      return `{${items}}`
    }
    const items = data
      .map((item) => `${innerSpaces}${jsonToLuaTable(item, indent + 1)}`)
      .join(',\n')
    return `{\n${items}\n${spaces}}`
  }

  if (typeof data === 'object') {
    const entries = Object.entries(data as Record<string, unknown>)
    if (entries.length === 0) {
      return '{}'
    }
    const items = entries
      .map(([key, value]) => {
        const luaValue = jsonToLuaTable(value, indent + 1)
        // Use bracket notation for keys with special characters or starting with numbers
        const needsBrackets = /[^a-zA-Z0-9_]/.test(key) || /^[0-9]/.test(key)
        const luaKey = needsBrackets ? `["${key}"]` : key
        return `${innerSpaces}${luaKey} = ${luaValue}`
      })
      .join(',\n')
    return `{\n${items}\n${spaces}}`
  }

  return String(data)
}

/**
 * Triggers a file download with the given content
 * @param content - The file content
 * @param filename - The filename to use for download
 */
export function downloadAsFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
