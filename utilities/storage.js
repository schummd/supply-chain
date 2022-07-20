

var node; 

async function initGlobalIpfs() {
    const { create } = await import('ipfs'); 
    node = await create(); 
};

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

async function getIpfs(CID) {
    // retrieve data from storage using identifier 
    const stream = await node.cat(CID); 
    const decoder = new TextDecoder(); 
    let retrieved = ''; 

    for await (const chunk of stream) {
        retrieved += decoder.decode(chunk, { stream: true }); 
    }
    
    return retrieved; 
}

module.exports = { initGlobalIpfs, loadIpfs, getIpfs }