import { useReqParamsStore } from '@/stores/reqParamsStore'; 

export function formatKeyValuePair(key: string, value: any): string {
  const gpsToATLASOffset = 1198800018; // Offset in seconds from GPS to ATLAS SDP time
  const gpsToUnixOffset = 315964800;   // Offset in seconds from GPS epoch to Unix epoch
  const gpsToUTCOffset = useReqParamsStore().getGpsToUTCOffset();

  let formattedValue: string | number;

  if (key === 'time' && typeof value === 'number') {
    // 1) Convert GPS to ATLAS SDP by subtracting the ATLAS offset
    let adjustedTime = value - gpsToATLASOffset;
    // 2) Align ATLAS SDP with Unix epoch by adding the GPS-to-Unix offset
    adjustedTime += gpsToUnixOffset;
    // 3) Adjust for UTC by subtracting the GPS-UTC offset
    adjustedTime -= gpsToUTCOffset;

    const date = new Date(adjustedTime); // Convert seconds to ms
    formattedValue = date.toISOString(); // Format as ISO string in UTC

  } else if (
    key === 'canopy_h_metrics' &&
    typeof value === 'object' &&
    typeof value.toArray === 'function'
  ) {
    // Safely call toArray if available
    const arr = value.toArray();
    const formattedPairs = [...arr]
      .reduce((pairs: number[][], num: number, index: number) => {
        if (index % 3 === 0) {
          pairs.push([num]); // start a new triple
        } else {
          pairs[pairs.length - 1].push(num);
        }
        return pairs;
      }, [])
      .map((triple: number[]) => triple.map((n: number) => n.toFixed(5)).join(', '))
      .join('<br>');

    formattedValue = `[<br>${formattedPairs}<br>]`;

  } else if (typeof value === 'number') {
    // Handle numeric formatting
    let num = parseFloat(value.toPrecision(10)); 
    if (Number.isInteger(num)) {
      formattedValue = num.toFixed(0);
    } else {
      formattedValue = num.toFixed(3);
    }

  } else {
    // Default, just return as-is
    formattedValue = value;
  }

  return `<strong>${key}</strong>: <em>${formattedValue}</em>`;
}
