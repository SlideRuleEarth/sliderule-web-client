import {Buffer} from 'buffer/'; // note: the trailing slash is important!

export type SysConfig = {
  domain: string;
  organization: string;
  jwt: string;

};
//
// System Configuration
//
const globalSysConfig = {
  domain: "slideruleearth.io",
  organization: "sliderule",
  jwt: "",

};


// Define type for type_code
type TypeCode = typeof INT8 | typeof INT16 | typeof INT32 | typeof INT64 | typeof UINT8 | typeof UINT16 | typeof UINT32 | typeof UINT64 | typeof BITFIELD | typeof FLOAT | typeof DOUBLE | typeof TIME8 | typeof STRING | typeof USER;

type field_def_Type = { // C.E.U. defined this type
  "type": string,
  "elements": number,
  "offset": number,
  "flags": string
}

type rec_def_Type = Record<string, any> // C.E.U. defined this type

export type Sr_Results_type = Record<string, number>;// C.E.U. defined
//
// Record Definitions
//
let recordDefinitions: rec_def_Type = {}

const REC_HDR_SIZE = 8;
export const REC_VERSION = 2; // Record version for
export let num_defs_fetched = 0;
export let num_defs_rd_from_cache = 0;

// Define types for the constants
const INT8: number   = 0;
const INT16: number  = 1;
const INT32: number  = 2;
const INT64: number  = 3;
const UINT8: number  = 4;
const UINT16: number = 5;
const UINT32: number = 6;
const UINT64: number = 7;
const BITFIELD: number = 8;
const FLOAT: number  = 9;
const DOUBLE: number = 10;
const TIME8: number  = 11;
const STRING: number = 12;
const USER: number   = 13;


//Define type for fieldtypes
const fieldtypes:{
  [key: string]: { code: number; size: number };
} = {
  INT8:     {code: INT8,      size: 1},
  INT16:    {code: INT16,     size: 2},
  INT32:    {code: INT32,     size: 4},
  INT64:    {code: INT64,     size: 8},
  UINT8:    {code: UINT8,     size: 1},
  UINT16:   {code: UINT16,    size: 2},
  UINT32:   {code: UINT32,    size: 4},
  UINT64:   {code: UINT64,    size: 8},
  BITFIELD: {code: BITFIELD,  size: 1},
  FLOAT:    {code: FLOAT,     size: 4},
  DOUBLE:   {code: DOUBLE,    size: 8},
  TIME8:    {code: TIME8,     size: 8},
  STRING:   {code: STRING,    size: 1},
  USER:     {code: USER,      size: 0},
};

//------------------------------------
// Local Functions
//------------------------------------
export function set_recordDefinitions(data: any) {
  //console.log('set_recordDefinitions data:', data);
  //console.log('set_recordDefinitions before:', recordDefinitions);
  recordDefinitions = data;
  //console.log('set_recordDefinitions after:', recordDefinitions);
}
export function get_recordDefinitions() {
  return recordDefinitions;
}

export function get_num_defs_fetched() {
  return num_defs_fetched;
}
export function set_num_defs_fetched(num: number) {
  num_defs_fetched = num;
}
export function get_num_defs_rd_from_cache() {
  return num_defs_rd_from_cache;
}
//
// populateDefinition
//
// function populateDefinition(rec_type:any):any {
//   if (rec_type in recordDefinitions) {
//     num_defs_rd_from_cache++;
//     return recordDefinitions[rec_type];
//   }
//   else {
//     //console.log(`populateDefinition: ${rec_type} (type: ${typeof rec_type}) not found in recordDefinitions`);
//     return new Promise((resolve, reject) => {
//       num_defs_fetched++;
//       //console.log('populateDefinition rec_type:', rec_type,' num_defs_fetched:', num_defs_fetched);
//       source("definition", {"rectype" : rec_type}).then(
//         result => {
//           recordDefinitions[rec_type] = result;
//           resolve(recordDefinitions[rec_type]);
//         },
//         error => {
//           console.error(`failed to retrieve definition for ${rec_type}: ${error}`);
//           reject(new Error(`failed to retrieve definition for ${rec_type}: ${error}`));
//         }
//       );
//     });
//   }
// }
async function populateDefinition(rec_type: any): Promise<any> {
  if (rec_type in recordDefinitions) {
    num_defs_rd_from_cache++;
    return recordDefinitions[rec_type];
  } else {
    num_defs_fetched++;
    try {
      const result = await source("definition", { "rectype": rec_type });
      recordDefinitions[rec_type] = result;
      return recordDefinitions[rec_type];
    } catch (error) {
      console.error(`failed to retrieve definition for ${rec_type}: ${error}`);
      throw new Error(`failed to retrieve definition for ${rec_type}: ${error}`);
    }
  }
}

//
// getFieldSize
//
async function getFieldSize(type:any) {
  if (type in fieldtypes) {
    return fieldtypes[type].size;
  }
  else {
    const rec_def = await populateDefinition(type);
    return rec_def.__datasize;
  }
}

//
// decodeElement
//
function decodeElement(type_code: TypeCode, big_endian: boolean, buffer: Buffer, byte_offset: number): number | bigint | Date | string  {
  if (big_endian) {
    switch (type_code) {
      case INT8:      return buffer.readInt8(byte_offset);
      case INT16:     return buffer.readInt16BE(byte_offset);
      case INT32:     return buffer.readInt32BE(byte_offset);
      case INT64:     return buffer.readBigInt64BE(byte_offset) as bigint;
      case UINT8:     return buffer.readUInt8(byte_offset);
      case UINT16:    return buffer.readUInt16BE(byte_offset);
      case UINT32:    return buffer.readUInt32BE(byte_offset);
      case UINT64:    return buffer.readBigUInt64BE(byte_offset) as bigint;
      case BITFIELD:  throw new Error(`Bit fields are unsupported`);
      case FLOAT:     return buffer.readFloatBE(byte_offset);
      case DOUBLE:    return buffer.readDoubleBE(byte_offset);
      case TIME8:     
      {
        const rawval = buffer.readBigInt64BE(byte_offset)as bigint;
        return new Date(Number(rawval / BigInt(1000000)));
      }
      case STRING:    return String.fromCharCode(buffer.readUInt8(byte_offset));
      case USER:      throw new Error(`User fields cannot be decoded as a primitive`);
      default:        throw new Error(`Invalid field type ${type_code}`);
    }
  }
  else {
    switch (type_code) {
      case INT8:      return buffer.readInt8(byte_offset);
      case INT16:     return buffer.readInt16LE(byte_offset);
      case INT32:     return buffer.readInt32LE(byte_offset);
      case INT64:     return buffer.readBigInt64LE(byte_offset) as bigint;
      case UINT8:     return buffer.readUInt8(byte_offset);
      case UINT16:    return buffer.readUInt16LE(byte_offset);
      case UINT32:    return buffer.readUInt32LE(byte_offset);
      case UINT64:    return buffer.readBigUInt64LE(byte_offset) as bigint;
      case BITFIELD:  throw new Error(`Bit fields are unsupported`);
      case FLOAT:     return buffer.readFloatLE(byte_offset);
      case DOUBLE:    return buffer.readDoubleLE(byte_offset);
      case TIME8:     
      {
        const rawval = buffer.readBigInt64LE(byte_offset) as bigint;
        return new Date(Number(rawval / BigInt(1000000)));
      }
      case STRING:    return String.fromCharCode(buffer.readUInt8(byte_offset));
      case USER:      throw new Error(`User fields cannot be decoded as a primitive`);
      default:        throw new Error(`Invalid field type ${type_code}`);
    };
  }
}

//
// decodeField
//
async function decodeField(field_def:field_def_Type , buffer:any, offset:number, rec_size:number): Promise<any> {
  let value:any[] | string = []; // ultimately returned

  // Pull out field attributes
  const big_endian = (field_def.flags.match('BE') != null);
  let byte_offset = offset + (field_def.offset / 8);
  let num_elements = field_def.elements;
  const field_size = await getFieldSize(field_def.type);

  // Get type code
  let type_code = USER;
  if (field_def.type in fieldtypes) {
     type_code = fieldtypes[field_def.type].code;
  }

  // For variable length fields, recalculate number of elements using size of record
  if (num_elements == 0) {
    num_elements = (rec_size - byte_offset) / field_size;
  }

  // Decode elements
  for (let i = 0; i < num_elements; i++) {
    if (field_def.type in fieldtypes) {
      value.push(decodeElement(type_code, big_endian, buffer, byte_offset));
    }
    else {
      value.push(await decodeRecord(field_def.type, buffer, byte_offset, rec_size));
    }
    byte_offset += field_size;
  }

  // Create final value
  if (type_code == STRING) {
    value = value.join('') ;
    const null_index = value.indexOf('\0');
    if (null_index > -1) {
      value = value.slice(0, null_index); // Modified to use slice
    }
  }
  else if (num_elements == 1) {
    value = value[0];
  }

  // Return value
  return value;
}

//
// decodeRecord
//
async function decodeRecord(rec_type:string, buffer:any, offset:number, rec_size:number): Promise<any> {
  const rec_obj:rec_def_Type = {}
  const rec_def = await populateDefinition(rec_type);
  //console.log('decodeRecord rec_type:', rec_type, 'rec_def:', rec_def, 'offset:', offset, 'rec_size:', rec_size);
  // For each field defined in record
  for (const field in rec_def) {
    // Check if not property
    if (field.match(/^__/) == null) {
      rec_obj[field] = await decodeField(rec_def[field], buffer, offset, rec_size);
    }
  }
  // Return decoded record
  return rec_obj;
}

async function fetchAndProcessResult(url:string, options:any, callbacks:{ [key: string]: any } ={}, stream: boolean) {
  try {
      //console.log('fetchAndProcessResult url:', url);
      //console.log('fetchAndProcessResult options:', options);
      //console.log('fetchAndProcessResult callbacks:', callbacks);
      // Fetch the resource
      const response = await fetch(url, options);
      //console.log('fetchAndProcessResult response:', response);
      // Check if the response is ok (status in the range 200-299)
      if (!response.ok) {
          throw new Error(`fetchAndProcessResult HTTP error! status: ${response.status}`);
      }

      // Examine the headers from the response
      // for (const [key, value] of response.headers.entries()) {
      //     console.log(`fetchAndProcessResult header: ${key}: ${value}`);
      // }
      const contentType = response.headers.get('content-type');

      // Ensure response.body is not null before attempting to read the stream
      if (!response.body) {
        throw new Error('Response body is null');
      }

      if (stream) {
        // Get the reader from the response stream
        //console.log('fetchAndProcessResult streaming response:', response);
        const reader = response.body.getReader();

        // Process the stream
        let receivedLength = 0; // length of the received  data
        let chunks:any[] = []; // array to store received  chunks
        let num_chunks = 0;
        const results: Sr_Results_type = {};
        let bytes_read = 0;
        let bytes_processed = 0;
        let bytes_to_process = 0;
        let got_header = false;
        let rec_size = 0;
        let rec_type_size = 0;
        let loop_done = false;
        let empty_chunks = 0;
        let decode_errors = 0;
        const recs_cnt:{ [key: string]: any} = {}

        while (loop_done === false) {
          const { done, value } = await reader.read();
          if (value) {
            num_chunks++;
            //console.log(`fetchAndProcessResult chunk:${num_chunks} Received ${value.length} bytes of data`);
            chunks.push(value);
            receivedLength += value.length;

            if (contentType == 'application/octet-stream') {
              bytes_read += value.length;
              bytes_to_process += value.length;
              while (bytes_to_process > 0) {
                // State: Accumulating Header
                if (!got_header && bytes_to_process > REC_HDR_SIZE) {
                  // Process header
                  got_header = true;
                  bytes_processed += REC_HDR_SIZE;
                  bytes_to_process -= REC_HDR_SIZE;
                  const buffer = Buffer.concat(chunks);
                  // Get header info
                  const rec_version = buffer.readUInt16BE(0);
                  rec_type_size = buffer.readUInt16BE(2);
                  const rec_data_size = buffer.readUInt32BE(4);
                  if (rec_version != REC_VERSION) {
                    loop_done = true;
                    throw new Error(`fetchAndProcessResult invalid record format: ${rec_version}`);
                  }
                  // Set record attributes
                  rec_size = rec_type_size + rec_data_size;
                  chunks = [buffer.subarray(REC_HDR_SIZE)];
                } else if (got_header && bytes_to_process >= rec_size) {
                  // State: Accumulating Record
                  // Process record
                  got_header = false;
                  bytes_to_process -= rec_size;
                  bytes_processed += rec_size;
                  const buffer = Buffer.concat(chunks);
                  const rec_type = buffer.toString('utf8', 0, rec_type_size - 1);
                  //console.log('fetchAndProcessResult rec_type:', rec_type, 'rec_size:', rec_size, 'rec_type_size:', rec_type_size, 'bytes_to_process:', bytes_to_process, 'bytes_processed:', bytes_processed);
                  if (!(rec_type in recs_cnt)) {
                    recs_cnt[rec_type] = 1;
                  } else {
                    recs_cnt[rec_type]++;
                  }              
                  decodeRecord(rec_type, buffer, rec_type_size, rec_size).then(
                    result => {
                      if (rec_type in callbacks) {
                        callbacks[rec_type](result);
                      } else {
                        console.warn('NO callback for rec_type:',rec_type, 'result:', result)
                      }
                      //console.log('rec_type:',rec_type, 'result:', result)
                    }
                  ).catch(error => {
                    decode_errors++;
                    console.error(`Error decoding record of type ${rec_type}:`, error, 'decode_errors:', decode_errors);
                    loop_done = true;
                    bytes_to_process = 0;
                  });
                  // Update stats
                  if (!(rec_type in results)) {
                    results[rec_type] = 0;
                    //console.log('Not in results rec_type:', rec_type);
                  }
                  results[rec_type]++;
                  // Restore unused bytes that have been read
                  if(bytes_to_process > 0) {
                    chunks = [buffer.subarray(rec_size)];
                  } else {
                    chunks = [];
                  }
                } else {
                  // State: Need More Data
                  break;
                }
              }
            } else {
              throw new Error('fetchAndProcessResult invalid content type for streaming');
            }
          } else {
            empty_chunks++;
            console.log(`fetchAndProcessResult chunk:${num_chunks} Received empty chunk`);
            if (empty_chunks > 10) {
              loop_done = true;
              console.error('fetchAndProcessResult empty_chunks > 10? Done! ');
              break;
            }
          } 
          if (done) {
            // The stream has been read completely
            results["bytes_read"] = bytes_read;
            results["bytes_processed"] = bytes_processed;
            results["num_chunks"] = num_chunks;
            results["empty_chunks"] = empty_chunks;
            console.log('fetchAndProcessResult read returned done: results:', results);
            break;
          }
        }

        // Combine any straggling chunks into a single Uint8Array
        const binaryData = new Uint8Array(receivedLength);
        let position = 0;
        let num_chunks_appended = 0;
        for (const value of chunks) {
            num_chunks_appended++;
            binaryData.set(value, position);
            position += value.length;
        }
        console.log("fetchAndProcessResult final recs_cnt:", recs_cnt, " num_chunks_appended:", num_chunks_appended, "results:", results);
        //console.log('fetchAndProcessResult returning binaryData:', binaryData);
        //return binaryData;
        return results;

    } else if (contentType == 'application/json' || contentType == 'text/plain') {
      const data = await response.json();
      //console.log('fetchAndProcessResult Non-streaming returning json data:', data);
      return data;
    }
  } catch (error) {
      // Handle any errors
      console.error('fetchAndProcessResult Error fetching or processing stream:', error);
      throw error; // Re-throw the error if you want to handle it further up the call stack
  }
}

//------------------------------------
// Exported Functions
//------------------------------------

//
// Initialize Client
//
// Define type for the init function
// export function init(config: {
//   domain?: string;
//   organization?: string;
//   protocol?: string;
//   verbose?: boolean;
//   desired_nodes?: number|null; 
//   time_to_live?: number;
//   timeout?: number;
// }): void
// {
//   Object.assign(globalSysConfig, config)
//   //console.log('globalSysConfig:', globalSysConfig); 
// };
export function init(domain: string, organization: string, jwt:string): void {
  globalSysConfig.domain = domain;
  globalSysConfig.organization = organization;
  globalSysConfig.jwt = jwt;
  //console.log('globalSysConfig:', globalSysConfig); 
}
export interface Callbacks {
  [key: string]: ((result: any) => void) | undefined; 
}
// Define type for the source function
export async function source(
  api: string,
  parm?: any, // Replace 'any' with a more specific type if possible
  stream: boolean = false,
  callbacks?: Callbacks
): Promise<any>{ // Replace 'any' with a more specific return type if possible
  //console.log('source api: ', api);
  //console.log('source parm: ', parm);
  //console.log('globalSysConfig at source call:', JSON.stringify(globalSysConfig));
  const host = globalSysConfig.organization && (globalSysConfig.organization + '.' + globalSysConfig.domain) || globalSysConfig.domain;
  const api_path = 'source/'+ api;
  const url = 'https://' + host + '/' + api_path;
  //console.log('source url:', url);
  // Setup Request Options
  let body = null;
  const options: RequestInit = {
    method: 'POST',
    mode: 'cors', 
  };
  
  if (parm != null) {
    body = JSON.stringify(parm);
    options.headers = {
      'Content-Type': 'application/json', 
      'Content-Length': Buffer.byteLength(body).toString(),
      'x-sliderule-streaming': stream ? '1' : '0',
    };
    options.body = body;
  }
  // add JWT for Authorization header if present
  if(globalSysConfig.jwt){
    options.headers = {
      ...options.headers,
      'Authorization': `Bearer ${globalSysConfig.jwt}`
    };
  }
  // Make API Request
  // Await the fetchAndProcessResult call
  let result;
  try {
      if (api.includes('atl')) {
        console.log('source url:', url, 'options:',options);
        console.log('options.body:',options.body);
      }
      result = await fetchAndProcessResult(url, options, callbacks, stream);
      //console.log('source url:', url, 'options:',options, 'result:', result);
  } catch (error) {
      console.error('Error in fetchAndProcessResult source url:', url, 'options:',options,' error:', error);
      throw error; // Rethrow or handle as needed
  }
  return result;
}; 

//
// Authenticate User
//

interface SysCredentials {
    access: string;
    refresh: string;
    expiration: number;
}

const sysCredentials: SysCredentials = {
    access: '',
    refresh: '',
    expiration: 0,
};

// Define type for the get_version function
// export function get_version(): Promise<{
//   client: { version: string };
//   organization: string;
//   [key: string]: any; // Additional dynamic properties
// }>{
//   //const client_version = import.meta.env.VITE_APP_VERSION
//     return source('version').then(
//       result => {
//         //result['client'] = {version: client_version};
//         result['organization'] = globalSysConfig.organization;
//         return result;
//       }
//     );
//   };
export async function get_version(): Promise<{
  client: { version: string };
  organization: string;
  [key: string]: any; // Additional dynamic properties
}> {
  const result = await source('version');
  // result['client'] = { version: client_version };
  result['organization'] = globalSysConfig.organization;
  return result;
}

// Define type for the get_values function
export function get_values(bytearray: Uint8Array, fieldtype: number):  Array<number | string | BigInt>  // Replace 'any' with a more specific type if possible
{
  let values: Array<number | string | BigInt> = [];
  const buffer = Buffer.from(bytearray);
  switch (fieldtype) {
    case INT8:    for (let i = 0; i < buffer.length; i += 1) values.push(buffer.readInt8(i));   break;
    case INT16:   for (let i = 0; i < buffer.length; i += 2) values.push(buffer.readInt16LE(i));  break;
    case INT32:   for (let i = 0; i < buffer.length; i += 4) values.push(buffer.readInt32LE(i));  break;
    case INT64:   for (let i = 0; i < buffer.length; i += 8) values.push(buffer.readBigInt64LE(i));  break;
    case UINT8:   for (let i = 0; i < buffer.length; i += 1) values.push(buffer.readUInt8(i));  break;
    case UINT16:  for (let i = 0; i < buffer.length; i += 2) values.push(buffer.readUInt16LE(i)); break;
    case UINT32:  for (let i = 0; i < buffer.length; i += 4) values.push(buffer.readUInt32LE(i)); break;
    case UINT64:  for (let i = 0; i < buffer.length; i += 8) values.push(buffer.readBigUInt64LE(i)); break;
    case FLOAT:   for (let i = 0; i < buffer.length; i += 4) values.push(buffer.readFloatLE(i));  break;
    case DOUBLE:  for (let i = 0; i < buffer.length; i += 8) values.push(buffer.readDoubleLE(i)); break;
    case TIME8:   for (let i = 0; i < buffer.length; i += 8) values.push(buffer.readBigInt64LE(i));  break;
    case STRING:
    {
    // Convert the Uint8Array to a string, then split into an array of single-character strings if necessary
      const str = String.fromCharCode.apply(null, Array.from(bytearray));
      values = [str]; 
      break;
    }
    default: break;
  }
  return values;
}


// Function to populate all definitions
// export async function populateAllDefinitions(): Promise<any>{
//   const allRecordTypes = ['atl06rec','atl06rec.elevation','exceptrec','eventrec','arrowrec.meta','arrowrec.data'];
//   try {
//     // Create an array of promises for each record type
//     const definitionPromises = allRecordTypes.map(type => populateDefinition(type));
//     // Wait for all promises to resolve
//     await Promise.all(definitionPromises);
//     //console.log("All record definitions have been populated successfully:",recordDefinitions);
//     return recordDefinitions;
//   } catch (error) {
//     // Handle errors that occur during the population process
//     console.error("Error populating record definitions:", error);
//   }
// }
export async function populateAllDefinitions(): Promise<any> {
  const allRecordTypes = [
    'atl06rec',
    'atl06rec.elevation',
    'exceptrec',
    'eventrec',
    'arrowrec.meta',
    'arrowrec.data'
  ];

  try {
    const definitionPromises = allRecordTypes.map(type => populateDefinition(type));
    await Promise.all(definitionPromises);
    return recordDefinitions;
  } catch (error) {
    console.error("Error populating record definitions:", error);
    throw error; // re-throw the error if you want the caller to handle it
  }
}
