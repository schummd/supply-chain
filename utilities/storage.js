

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
async function loadIpfs(_barcode, _quantity, _name, _produced, _expiry, _producer, _location, _phone, _email, _description, _contract) {
    // stores the received data as JSON object 
    product = {
        "barcode": _barcode,
        "quantity": _quantity,
        "productName": _name,
        "produceDate": _produced,
        "expiryDate": _expiry,
        "producer": _producer,
        "location": _location,
        "phone": _phone,
        "email": _email, 
        "description": _description,
        "saleContract": _contract
    }
    const data = JSON.stringify(product); 
    // load the data to IPFS storage 
    const file = await node.add(data); 
    // unique ID of the product data
    const cid = file.cid; 
    // console.log(); 
    // return the identifier to producer
    return [product, cid]; 
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


/**
 * Shutdown the running IPFS node when called
 **/
async function stopIpfs() {
    await node.stop(); 
}


module.exports = { initGlobalIpfs, loadIpfs, getIpfs, stopIpfs }