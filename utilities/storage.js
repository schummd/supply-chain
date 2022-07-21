

var node; 

/**
 * Create a new IPFS node for each supply chain app user; 
 * for testing storing and reading files are done from 
 * the same node 
 */
async function initGlobalIpfs() {
    const { create } = await import('ipfs'); 
    node = await create(); 
};


/**
 * Sends the data to the IPFS storage and returns unique identifier 
 * @param  {object} _data added by the producer though front-end 
 * @return {object} unique identifier of the data in IPFS storage 
 */
async function loadIpfs(_data) {
    const data = JSON.stringify(_data); 
    // load the data to IPFS storage 
    const file = await node.add(data); 
    // unique ID of the product data
    const cid = file.cid; 
    console.log(); 
    // return the identifier to producer
    return cid; 
}


/**
 * Queries data from the IPFS using unique identifier CID
 * @param  {string} _CID unique identifier of the data stored 
 * @return {string} recovered data from the storage as string
 */
async function getIpfs(_CID) {
    // retrieve data from storage using identifier 
    const stream = await node.cat(_CID); 
    const decoder = new TextDecoder(); 
    let retrieved = ''; 

    for await (const chunk of stream) {
        retrieved += decoder.decode(chunk, { stream: true }); 
    }
    
    return retrieved; 
}


module.exports = { initGlobalIpfs, loadIpfs, getIpfs }