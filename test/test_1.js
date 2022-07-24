const Product = artifacts.require("Product");
const Registry = artifacts.require("AuthorityRegistry");
const Oracle = artifacts.require("Oracle");

const assert = require("chai").assert;
const truffleAssert = require('truffle-assertions');
const { authorityKeys, generateCertificate } = require('../utilities/certificate.js'); 
const { initGlobalIpfs, loadIpfs, getIpfs } = require('../utilities/storage'); 
const { fetchTemperature } = require('../utilities/temperature'); 

contract('Product', (accounts) => {

    let CA;         
    let batchID; 
    let authorityAddress;               // CA's public key 

    let productInfo;                    // producer's product data 
    let productCID;                     // keeps the ID of the product in IPFS
    let newProductHash;                 // newly computed hash of the product 

    const DOA = accounts[9];            // certification registry owner 
	const owner = accounts[0];          // contract owner 
	const producer = accounts[1];       // batch producer
	const distributor = accounts[2];    // distributor 

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
        CA = await authorityKeys(); // generate random account keys 
        authorityAddress = CA[0];	// certifying authority public key
        await registryInstance.addPublicKey(authorityAddress, { from: DOA }); 
        let check = await registryInstance.checkPublicKey(authorityAddress); 
        assert.isTrue(check, "check if public key was added"); 
    });

    // ------------------------------------------------------------------------------------------------
    // producer adds data about the batch he produced to the off-chain 
    // IPFS storage, sends the JSON object to the distributed file system; 
    // the data is accepted though off-chain front-end application

    it('Producer sending product data to the database', async() => {
        // database is imitated using a simple JSON object that stores the
        // infromation about the product; producer can add their own data 
        // and send it to the IPFS storage, which can be retrieved later on 
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

    it('Contract owner authorising producer', async() => {
        // contract deployer declares a producer as authorised 
        await productInstance.addProducer(producer, { from: owner }); 
        let verifyProducer = await productInstance.getProducer.call(producer); 
        assert.isTrue(verifyProducer, "check if producer authorised in contract"); 
    });

    it('Producer adding product to the product contract', async() => {
        // retrieve data from the file storage 
        let retrieveData = await getIpfs(productCID); 
        // generate hash of the data 
        let productHash = web3.utils.sha3(retrieveData);
        let temperature = 8; 
        let stringCID = productCID.toString();

        // add a product to the contract 
        await productInstance.addProduct(productHash, temperature, stringCID, { from: producer })
        await productInstance.getPastEvents().then((ev) => batchID = ev[0].args[0]); 

        // get the product infromation 
        let checkProduct = await productInstance.getProduct(batchID); 
        // check if the data is correct 
        assert.equal(checkProduct[0], productHash, "check the supplied product hash is the same as stored"); 
        // assert.equal(checkProduct[1], conditionsHash, "check the supplied conditions hash is the same as stored"); 
        assert.equal(checkProduct[1], producer, "check the owner is the same who transacted"); 
    }); 

    // producer can request a certifying authority to issue oragnic certificate 
    // to a batch he produced; the request producer does is off-chain and may 
    // involve various communication means (e.g., email)
    
    // the CA conducts physical product audit and releases certificate 
    // to the producer that certifies the product meets organic guidelines 

    // once the producer received the certificate and issuer signature,
    // he adds this infromation on-chain 

    it('Producer adding certificate to the product', async() => {
        // CA generates certificate for product batch 
        let certData = await generateCertificate(batchID, CA[1]); 
        let certificate = certData[0];
        let signature = certData[1]; 

        // producer adds certificate to the product 
        await productInstance.addCertificate(batchID, certificate, signature, { from: producer }); 
        // check if the certificate the same on-chain 
        let response = await productInstance.getCertificate.call(batchID); 
        let returnedCertificate = response[0];
        let returnedSignature = response[1]; 
        assert.equal(certificate, returnedCertificate, "check the certificated stored is the same"); 
        assert.equal(signature, returnedSignature, "check the signature stored is the same"); 
    });

    // ------------------------------------------------------------------------------------------------
    // the producer now wants to sell the batch to the distributor and 
    // we assume the negotiation and sale conducted off-chain, but 
    // distributor can verify batch certificate and data using on-chain 
    // functionalities; 

    // onces the buyer satisfied with results, the producer initiates 
    // change of ownership on-chain and dispatches the batch off-chain 

    it('Distributor verifying the certificate of the batch', async() => {
        let verification = await productInstance.verifyCertificate(batchID, { from: distributor });
        assert.isTrue(verification, "batch certificate was signed by a valid authority"); 
    });

    it('Distributor verifying off-chain data to on-chain hash', async() => {
        // distributor recovers IPFS CID from the contract 
        let storageCID = await productInstance.getDatabase.call(batchID, { from: distributor });
        // then recovers actual product data from IPFS 
        let retrievedData = await getIpfs(storageCID); 
        // then computes hash of the received data 
        newProductHash = web3.utils.sha3(retrievedData);
        // // then recovers the product hash from the contract and compares 
        let onchainHash = await productInstance.getProduct.call(batchID, { from: distributor }); 
        assert.equal(onchainHash[0], newProductHash, "check if newly computed product hash is the same as stored on-chain"); 
    }); 

    // the certificate is ligitimate and data off-chain has not been tampered 
    // then distributor satisfied with the batch and purchases it 
    // the funds transfer are done off-chain, we only record transfer of 
    // ownership in the product data struct 

    // update owner function performs additional check of the certificate
    // and product hash 

    it('Producer transferring ownership to the distributor', async() => {
        await productInstance.updateOwner(batchID, newProductHash, distributor, { from: producer }); 
        let checkOnwer = await productInstance.getProduct.call(batchID, { from: distributor }); 
        assert.equal(checkOnwer[1], distributor, "check if the current owner is the distributor"); 
    }); 

})