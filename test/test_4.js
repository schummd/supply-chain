const Product = artifacts.require("Product");
const Registry = artifacts.require("AuthorityRegistry");
const Oracle = artifacts.require("Oracle");

const assert = require("chai").assert;
const truffleAssertions = require("truffle-assertions");
const { authorityKeys, generateCertificate } = require('../utilities/certificate.js'); 
const { initGlobalIpfs, loadIpfs, getIpfs } = require('../utilities/storage'); 
const { fetchTemperature } = require('../utilities/temperature'); 

// testing oracle functionality
// for simplicity, we have used API to a random number 
// that represents a temperature in our case 

// in a real-world deployment, this API can be changed 
// to track the temperature from hardware termometers 
// located in the batch storage 

contract('Product', (accounts) => {

    let CA;         
    let batchID; 
    let authorityAddress;               // CA's public key 

    let status; 
    let productInfo;                    // producer's product data 
    let productCID;                     // keeps the ID of the product in IPFS
    
	const owner = accounts[0];          // product owner 
	const producer = accounts[1];       // batch producer
    const oracle = accounts[8];         // oracle owner 
    const DOA = accounts[9];            // certification registry owner 

    let oracleInstance; 
    let productInstance; 
    let registryInstance; 
    
    before('Deploying contracts', async() => {
        registryInstance = await Registry.deployed(); 
        oracleInstance = await Oracle.deployed(); 
        productInstance = await Product.deployed();

        console.log("\nContracts deployed and IPFS node initialised..."); 
        await initGlobalIpfs();   // initiate a global IPFS node for user 

        await web3.eth.getBalance(productInstance.address).then((balance) => {
			assert.equal(balance, 0, "check balance of contract"); 
		});
    }); 

    // ------------------------------------------------------------------------------------------------

    it('DOA adding a certifying authority to the registry', async() => {
        CA = await authorityKeys();     // generate random account keys 
        authorityAddress = CA[0];	    // certifying authority public key
        await registryInstance.addPublicKey(authorityAddress, { from: DOA }); 
        let check = await registryInstance.checkPublicKey(authorityAddress); 
        assert.isTrue(check, "check if public key was added"); 
    });

    // ------------------------------------------------------------------------------------------------
    // producer adds data about the batch he produced to the off-chain 
    // IPFS storage, sends the JSON object to the distributed file system; 
    // the data is accepted though off-chain front-end application
    
    it('Contract owner authorising producer', async() => {
        // contract deployer declares a producer as authorised 
        await productInstance.addProducer(producer, { from: owner }); 
        let verifyProducer = await productInstance.getProducer.call(producer); 
        assert.isTrue(verifyProducer, "check if producer authorised in contract"); 
    });

    it('Producer sending product batch data to the database', async() => {
        // database is imitated using a simple JSON object; assuming 
        // producer adds the product data though front-end interface
        // sends it to the IPFS storage
        productInfo = {
            "barcode": "1845678901001",
            "quantity": 1100,
            "productName": "Gala Apples",
            "produceDate": "01/01/2023",
            "expiryDate": "20/01/2023",
            "producer": "Sydney Orchard",
            "location": "Newcastle, NSW",
            "phone": "0403332323",
            "email": "hello@sydneyorchard.com.au", 
            "description": "apples",
            "saleContract": "#4513404285"
        }

        productCID = await loadIpfs(productInfo);       // store data of the product and get the CID
        let retrieveData = await getIpfs(productCID);   // verify the data stored is correct in IPFS 
        assert.equal(JSON.stringify(productInfo), retrieveData, "the data stored on IPFS is the same"); 
    });

    it('Producer adding product to the product contract', async() => {
        let retrieveData = await getIpfs(productCID);       // retrieve data from the file storage 
        let productHash = web3.utils.sha3(retrieveData);    // generate hash of the data 
        let stringCID = productCID.toString();

        // add a product to the contract 
        await productInstance.addProduct(productHash, 5, stringCID, { from: producer })
        await productInstance.getPastEvents().then((ev) => batchID = ev[0].args[0]); 

        // get the product infromation and check if correct 
        let checkProduct = await productInstance.getProduct(batchID); 
        assert.equal(checkProduct[0], productHash, "check the supplied product hash is the same as stored");  
        assert.equal(checkProduct[1], producer, "check the owner is the same who transacted"); 
    }); 

    it('Producer adding certificate to the product', async() => {
        // certifying authority generates certificate for product batch 
        let certData = await generateCertificate(batchID, CA[1]); 
        let certificate = certData[0];
        let signature = certData[1]; 

        // producer adds certificate to the product 
        await productInstance.addCertificate(batchID, certificate, signature, { from: producer }); 

        // check if the certificate the same on-chain 
        let response = await productInstance.getCertificate.call(batchID); 
        assert.equal(response[0], certificate, "check the certificated stored is the same"); 
        assert.equal(response[1], signature, "check the signature stored is the same"); 
    });

    // ------------------------------------------------------------------------------------------------

    it('Oracle requesting temperature, it is too high', async() => {
        // from the product contract trigger temperature request 
        // for testing purposes indicate the range of requested temperature
        await productInstance.getTemperature(batchID, { from: producer }).then(async() => {
            await oracleInstance.getPastEvents('request').then(async(ev) => {
                await fetchTemperature(6, 10).then(async(response) => {
                    await oracleInstance.replyTemp(ev[0].args[0], response, productInstance.address, { from: oracle });
                }); 
            }); 
        }); 
        // verify status was changed because temperature is too high 
        status = await productInstance.getStatus.call(batchID);
        assert.isFalse(status, "check if status is false");
    });

    it('Temporarily disabling contract to conduct hardware checks', async() => {
        // since the disabling contract can be called by the contract owner, 
        // the current batch owner has to contract off-chain the manager;
        // then manager / contract owner halts the contract 
        await productInstance.emergencyHalt({ from: owner }); 
        status = await productInstance.checkHalt.call({ from: producer }); 
        assert.isTrue(status, "check if contract is on pause"); 
    }); 

    it('Producer attempts to change status back while halt is on', async() => {
        await truffleAssertions.fails(productInstance.updateStatus(batchID, true, { from: producer }), "contract halt");
    });

    it('Contract owner re-activating contract', async() => {
        // after physical examination of the hardware and ensurance there
        // is no issue with the storage, the batch owner notifies contract
        // manager that the contract can be reactivated, and owner 
        // reactivates the contract 
        await productInstance.restartContract({ from: owner }); 
        status = await productInstance.checkHalt.call({ from: producer }); 
        assert.isFalse(status, "check if contract is active"); 
    }); 

    it('Product owner resetting status after physical checks', async() => {
        // after notification of incorrect temperature, the current batch
        // owner can conduct physical inspection of the product and verify
        // whether the temperature within norm and there were some malfunction
        // with termometer; in such case, owner can reset the status to true 
        await productInstance.updateStatus(batchID, true, { from: producer }); 
        // verify status was changed because temperature is too high 
        status = await productInstance.getStatus.call(batchID);
        assert.isTrue(status, "check if status has been reset");
    }); 

    it('Oracle requesting temperature, it is as required', async() => {
        await productInstance.getTemperature(batchID, { from: producer }).then(async() => {
            await oracleInstance.getPastEvents('request').then(async(ev) => {
                await fetchTemperature(1, 5).then(async(response) => {
                    await oracleInstance.replyTemp(ev[0].args[0], response, productInstance.address, { from: oracle });
                }); 
            }); 
        });
        // verify status was changed because temperature is too high 
        status = await productInstance.getStatus.call(batchID);
        assert.isTrue(status, "check if status is true");
    });

}); 