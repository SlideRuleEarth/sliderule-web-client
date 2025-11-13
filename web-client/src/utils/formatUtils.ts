import { useReqParamsStore } from '@/stores/reqParamsStore'
import { useSrcIdTblStore } from '@/stores/srcIdTblStore'
function gpsToUnixTimestamp(gpsSeconds: number): number {
  const gpsToUnixOffset = 315964800 // Seconds from Jan 1, 1970 to Jan 6, 1980

  // Leap second history — UTC effective dates and total count at that time
  const leapSecondTable = [
    { effective: Date.UTC(1981, 6, 1), total: 1 },
    { effective: Date.UTC(1982, 6, 1), total: 2 },
    { effective: Date.UTC(1983, 6, 1), total: 3 },
    { effective: Date.UTC(1985, 6, 1), total: 4 },
    { effective: Date.UTC(1988, 0, 1), total: 5 },
    { effective: Date.UTC(1990, 0, 1), total: 6 },
    { effective: Date.UTC(1991, 0, 1), total: 7 },
    { effective: Date.UTC(1992, 6, 1), total: 8 },
    { effective: Date.UTC(1993, 6, 1), total: 9 },
    { effective: Date.UTC(1994, 6, 1), total: 10 },
    { effective: Date.UTC(1996, 0, 1), total: 11 },
    { effective: Date.UTC(1997, 6, 1), total: 12 },
    { effective: Date.UTC(1999, 0, 1), total: 13 },
    { effective: Date.UTC(2006, 0, 1), total: 14 },
    { effective: Date.UTC(2009, 0, 1), total: 15 },
    { effective: Date.UTC(2012, 6, 1), total: 16 },
    { effective: Date.UTC(2015, 6, 1), total: 17 },
    { effective: Date.UTC(2017, 0, 1), total: 18 }
  ]

  // Estimate UTC time in milliseconds without leap second correction
  const gpsEpoch = Date.UTC(1980, 0, 6) // Jan 6, 1980 UTC
  const approxUtcMillis = gpsEpoch + gpsSeconds * 1000

  // Determine leap seconds in effect at that time
  let leapSeconds = 0
  for (const { effective, total } of leapSecondTable) {
    if (approxUtcMillis >= effective) {
      leapSeconds = total
    } else {
      break
    }
  }

  // Final GPS to Unix conversion, correcting for leap seconds
  return gpsSeconds + gpsToUnixOffset - leapSeconds
}

export function formatTime(value: number): string {
  const gpsToATLASOffset = 1198800018 // Offset in seconds from GPS to ATLAS SDP time
  const gpsToUnixOffset = 315964800 // Offset in seconds from GPS epoch to Unix epoch
  const gpsToUTCOffset = useReqParamsStore().getGpsToUTCOffset()
  // 1) Convert GPS to ATLAS SDP by subtracting the ATLAS offset
  let adjustedTime = value - gpsToATLASOffset
  // 2) Align ATLAS SDP with Unix epoch by adding the GPS-to-Unix offset
  adjustedTime += gpsToUnixOffset
  // 3) Adjust for UTC by subtracting the GPS-UTC offset
  adjustedTime -= gpsToUTCOffset
  const date = new Date(adjustedTime)
  return date.toISOString() // Format as ISO string in UTC
}

export function formatKeyValuePair(key: string, value: any, reqId?: number): string {
  const srcIdStore = useSrcIdTblStore()

  let formattedValue: string | number
  if ((key === 'time' || key.includes('time_ns')) && typeof value === 'number') {
    formattedValue = formatTime(value) // Use the formatTime function for time values
  } else if (key.includes('.time')) {
    //console.log('formatKeyValuePair: key:',key,' value:',value, 'typeof value:',typeof value);
    const gpsdate = new Date(gpsToUnixTimestamp(value) * 1000) // Convert seconds to ms
    formattedValue = `raw:${value} gps:${gpsdate.toISOString()}` // Format as ISO string in UTC
    //console.log( `raw:${value} gps:${gpsdate.toISOString()}`)
    //   const test1 = new Date(gpsToUnixTimestamp(1396483218*1000));
    //   const test2 = new Date(gpsToUnixTimestamp(1309046418*1000));
    //   console.log('test1 time:1396483218',test1);
    //   console.log('test2 time:1309046418',test2);
  } else if (
    key === 'canopy_h_metrics' &&
    typeof value === 'object' &&
    typeof value.toArray === 'function'
  ) {
    const arr = value.toArray()
    const formattedPairs = [...arr]
      .reduce((pairs: number[][], num: number, index: number) => {
        if (index % 3 === 0) {
          pairs.push([num]) // start a new triple
        } else {
          pairs[pairs.length - 1].push(num)
        }
        return pairs
      }, [])
      .map((triple: number[]) => triple.map((n: number) => n.toFixed(5)).join(', '))
      .join('<br>')

    formattedValue = `[<br>${formattedPairs}<br>]`
  } else if (key === 'srcid') {
    // Use reqId-specific source table if available, otherwise fall back to legacy sourceTable
    const sourceTable =
      reqId !== undefined ? srcIdStore.getSourceTableForReqId(reqId) : srcIdStore.sourceTable

    if (sourceTable.length - 1 >= value) {
      formattedValue = `${value}: ${sourceTable[value]}`
    } else {
      formattedValue = `${value} : <unknown source>`
    }
  } else if (typeof value === 'object' && typeof value.toArray === 'function') {
    const arr = value.toArray()
    formattedValue = `[${arr[0]}, ..., ${arr[value.length - 1]}]`
  } else if (typeof value === 'number') {
    let num = parseFloat(value.toPrecision(10))
    formattedValue = Number.isInteger(num) ? num.toFixed(0) : num.toFixed(3)
  } else if (Array.isArray(value)) {
    if (value.length === 0) {
      formattedValue = '[]'
    } else if (value.length === 1) {
      formattedValue = `[${value[0]}]`
    } else if (value.length === 2) {
      formattedValue = `[${value[0]}, ${value[value.length - 1]}]`
    } else if (value.length === 3) {
      formattedValue = `[${value[0]}, ${value[1]}, ${value[value.length - 1]}]`
    } else if (value.length === 4) {
      formattedValue = `[${value[0]}, ${value[1]}, ${value[2]}, ${value[value.length - 1]}]`
    } else {
      formattedValue = `[${value[0]}, ..., ${value[value.length - 1]}]`
    }
  } else {
    formattedValue = value
  }
  if (key === 'srcid') {
    key = 'granule'
  }
  return `<strong>${key}</strong>: <em>${formattedValue}</em>`
}
