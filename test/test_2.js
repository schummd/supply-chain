
const Product = artifacts.require("Product");
const Registry = artifacts.require("AuthorityRegistry");
const Oracle = artifacts.require("Oracle");
const truffleAssert = require('truffle-assertions');

const assert = require("chai").assert;
const truffleAssertions = require("truffle-assertions");
const { authorityKeys, generateCertificate } = require('../utilities/certificate.js'); 
const { initGlobalIpfs, loadIpfs, getIpfs } = require('../utilities/storage'); 
const { fetchTemperature } = require('../utilities/temperature'); 

contract('Product', (accounts) => {

    let CA; 
    let authorityAddress; 

    let batchIDOne;
    let batchIDTwo; 
    let productOneInfo;                    // producer's product data 
    let productTwoInfo; 
    let productOneCID;                     // keeps the ID of the product in IPFS
    let productTwoCID

    const DOA = accounts[9];               // certification registry owner 
	const owner = accounts[0];             // contract owner 
	const producerOne = accounts[1];    
    const producerTwo = accounts[2];
    const retailer = accounts[3];          // buyer of the batch 

    const thirdParty = accounts[3]; 

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

    it('Contract owner authorising producer #1', async() => {
        // contract deployer declares a producer as authorised 
        await productInstance.addProducer(producerOne, { from: owner }); 
        let verifyProducer = await productInstance.getProducer.call(producerOne); 
        assert.isTrue(verifyProducer, "check if producer authorised in contract"); 
    });

    it('Producer #1 sending product data to the database', async() => {
        // database is imitated using a simple JSON object that stores the
        // infromation about the product; producer can add their own data 
        // and send it to the IPFS storage, which can be retrieved later on 
        productOneInfo = {
            "barcode": "7391413312094",
            "quantity": 3200,
            "productName": "Madagascar Bananas",
            "produceDate": "24/11/2023",
            "expiryDate": "30/12/2023",
            "producer": "Fruits Orchard",
            "location": "Newcastle, NSW",
            "phone": "04222333990",
            "email": "hello@fruitsorchard.com.au", 
            "description": "bananas",
            "saleContract": "#38850138"
        }
        productOneCID = await loadIpfs(productOneInfo);       // store data of the product and get the CID
        let retrieveData = await getIpfs(productOneCID);   // verify the data stored is correct in IPFS 
        assert.equal(JSON.stringify(productOneInfo), retrieveData, "the data stored on IPFS is the same"); 
    });

    it('Producer #2 sending product data to the database', async() => {
        // database is imitated using a simple JSON object that stores the
        // infromation about the product; producer can add their own data 
        // and send it to the IPFS storage, which can be retrieved later on 
        productTwoInfo = {
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
        productTwoCID = await loadIpfs(productTwoInfo);       // store data of the product and get the CID
        let retrieveData = await getIpfs(productTwoCID);   // verify the data stored is correct in IPFS 
        assert.equal(JSON.stringify(productTwoInfo), retrieveData, "the data stored on IPFS is the same"); 
    });

    it('Producer #1 adding product to the product contract', async() => {
        retrieveData = await getIpfs(productOneCID);           // retrieve data from the file storage 
        let productHash = web3.utils.sha3(retrieveData);    // generate hash of the data 
        let stringCID = productOneCID.toString();

        // add a product to the contract 
        await productInstance.addProduct(productHash, 5, stringCID, { from: producerOne })
        await productInstance.getPastEvents().then((ev) => batchIDOne = ev[0].args[0]); 

        // get the product infromation and check if correct 
        let checkProduct = await productInstance.getProduct(batchIDOne); 
        assert.equal(checkProduct[0], productHash, "check the supplied product hash is the same as stored");  
        assert.equal(checkProduct[1], producerOne, "check the owner is the same who transacted"); 
    }); 

    it('Producer #2 attempting to add product to the product contract', async() => {
        // since the producer #2 not authorised yet by the contract owner 
        // they cannot add the product to it and have to get the authorisation first 
        retrieveData = await getIpfs(productTwoCID);           // retrieve data from the file storage 
        let productHash = web3.utils.sha3(retrieveData);    // generate hash of the data 
        let stringCID = productTwoCID.toString();

        // add a product to the contract, but fails 
        await truffleAssertions.fails(productInstance.addProduct(productHash, 5, stringCID, { from: producerTwo }));
    }); 

    it('Contract owner authorising producer #2', async() => {
        // contract deployer declares a producer as authorised 
        await productInstance.addProducer(producerTwo, { from: owner }); 
        let verifyProducer = await productInstance.getProducer.call(producerTwo); 
        assert.isTrue(verifyProducer, "check if producer authorised in contract"); 
    });

    // ------------------------------------------------------------------------------------------------
    
    it('Producer #1 adding a certificate from unauthorised CA', async() => {
        let badCA = await authorityKeys(); 
        // certifying authority generates certificate for product batch 
        let certData = await generateCertificate(batchIDOne, badCA[1]); 
        let certificate = certData[0];
        let signature = certData[1]; 

        // producer adds certificate to the product 
        await productInstance.addCertificate(batchIDOne, certificate, signature, { from: producerOne }); 
        
        // check if the certificate the same on-chain 
        let response = await productInstance.getCertificate.call(batchIDOne); 
        assert.equal(response[0], certificate, "check the certificated stored is the same"); 
        assert.equal(response[1], signature, "check the signature stored is the same"); 
    });

    it('Retailer attempting to verify certificate before sale', async() => {
        // verification returns false becuase CA was not registered with DOA 
        let verification = await productInstance.verifyCertificate(batchIDOne, { from: retailer });
        assert.isFalse(verification, "batch certificate was signed by a valid authority"); 
    }); 

    // ------------------------------------------------------------------------------------------------

    it('Producer #2 adding product to the product contract', async() => {
        retrieveData = await getIpfs(productTwoCID);           // retrieve data from the file storage 
        let productHash = web3.utils.sha3(retrieveData);    // generate hash of the data 
        let stringCID = productTwoCID.toString();

        // add a product to the contract 
        await productInstance.addProduct(productHash, 5, stringCID, { from: producerTwo })
        await productInstance.getPastEvents().then((ev) => batchIDTwo = ev[0].args[0]); 

        // get the product infromation and check if correct 
        let checkProduct = await productInstance.getProduct(batchIDTwo); 
        assert.equal(checkProduct[0], productHash, "check the supplied product hash is the same as stored");  
        assert.equal(checkProduct[1], producerTwo, "check the owner is the same who transacted"); 
    }); 

    it('Producer #2 adding a certificate from authorised CA', async() => {
        // CA generates certificate for product batch 
        let certData = await generateCertificate(batchIDTwo, CA[1]); 
        let certificate = certData[0];
        let signature = certData[1]; 

        // producer adds certificate to the product 
        await productInstance.addCertificate(batchIDTwo, certificate, signature, { from: producerTwo }); 
        // check if the certificate the same on-chain 
        let response = await productInstance.getCertificate.call(batchIDTwo); 
        assert.equal(response[0], certificate, "check the certificated stored is the same"); 
        assert.equal(response[1], signature, "check the signature stored is the same"); 
    });
    
    it('Retailer verifies off-chain data with on-chain data hash', async() => {
        let storageCID = await productInstance.getDatabase.call(batchIDTwo, { from: retailer });
        let retrievedData = await getIpfs(storageCID);          // then recovers actual product data from IPFS 
        let newProductHash = web3.utils.sha3(retrievedData);    // then computes hash of the received data 

        let onchainHash = await productInstance.getProduct.call(batchIDTwo, { from: retailer }); 
        assert.equal(onchainHash[0], newProductHash, "check if newly computed product hash is the same as stored on-chain"); 
    }); 

    it('Retailer purchasing the batch and becoming a new owner', async() => {
        let storageCID = await productInstance.getDatabase.call(batchIDTwo, { from: retailer });
        let retrievedData = await getIpfs(storageCID);          // then recovers actual product data from IPFS 
        let newProductHash = web3.utils.sha3(retrievedData);    // then computes hash of the received data 

        await productInstance.updateOwner(batchIDTwo, newProductHash, retailer, { from: producerTwo }); 
        let checkOnwer = await productInstance.getProduct.call(batchIDTwo, { from: retailer }); 
        assert.equal(checkOnwer[1], retailer, "check if the current owner is the distributor"); 
    });

});