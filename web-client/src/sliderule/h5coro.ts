// Copyright (c) 2021, University of Washington
// All rights reserved.
//
// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions are met:
//
// 1. Redistributions of source code must retain the above copyright notice,
//    this list of conditions and the following disclaimer.
//
// 2. Redistributions in binary form must reproduce the above copyright notice,
//    this list of conditions and the following disclaimer in the documentation
//    and/or other materials provided with the distribution.
//
// 3. Neither the name of the University of Washington nor the names of its
//    contributors may be used to endorse or promote products derived from this
//    software without specific prior written permission.
//
// THIS SOFTWARE IS PROVIDED BY THE UNIVERSITY OF WASHINGTON AND CONTRIBUTORS
// “AS IS” AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED
// TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
// PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE UNIVERSITY OF WASHINGTON OR
// CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
// EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
// PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS;
// OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY,
// WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR
// OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF
// ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
import mitt from 'mitt';
import * as core from './core.js';

//------------------------------------
// File Data
//------------------------------------

const ALL_ROWS = -1;

const datatypes = {
    TEXT:     0,
    REAL:     1,
    INTEGER:  2,
    DYNAMIC:  3
};
  
//------------------------------------
// Exported Functions
//------------------------------------

//
// h5
//
export function h5( dataset:string, 
                    resource:string,
                     asset:string, 
                     datatype:number=datatypes.DYNAMIC, 
                     col:number=0, 
                     startrow:number=0, 
                     numrows:number=ALL_ROWS, 
                     callbacks: { [key: string]: (...args: any[]) => void } | null=null){
    const parm = {
      asset: asset,
      resource: resource,
      datasets: [ { dataset: dataset, datatype: datatype, col: col, startrow: startrow, numrows: numrows } ]
    };
    if (callbacks != null) {
        return core.source('h5p', parm, true, callbacks);
    } else {
        const emitter = mitt();

        let values:any = null;
        const callbacks = {
            h5file: (result:any) => {
                values = core.get_values(result.data, result.datatype);
                emitter.emit('complete');
            },
        };
        return new Promise(resolve => {
            core.source('h5p', parm, true, callbacks).then(
                () => {
                    const onComplete = () => {
                        resolve(values);
                        emitter.off('complete', onComplete); // Remove the event listener after it's called
                    };
                    emitter.on('complete', onComplete);
                }
            );
        });
    }
  }
  