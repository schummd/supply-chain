
const Product = artifacts.require("Product");
const Registry = artifacts.require("AuthorityRegistry");
const truffleAssert = require('truffle-assertions');

const assert = require("chai").assert;
// const timeMachine = require('ganache-time-traveler');

const { authorityKeys, generateSignature, generateCertificate } = require('../utilities/certificate.js'); 
const { initGlobalIpfs, loadIpfs, getIpfs } = require('../utilities/storage'); 

contract('Product', (accounts) => {

    let CA; 
    let batchID; 
    let authorityAddress; 

    let productInfo;                    // producer's product data 
    let productCID;                     // keeps the ID of the product in IPFS

    const DOA = accounts[9];        // certification registry owner 
	const owner = accounts[0];      // contract owner 
	const producer = accounts[1]; 
    const newOwner = accounts[2];
    const thirdParty = accounts[3]; 

    // ------------------------------------------------------------------------------------------------

    it('Authority deploying CA registry contract', async () => {
        registryInstance = await Registry.deployed(); 
        await web3.eth.getBalance(registryInstance.address).then((balance) => {
			assert.equal(balance, 0, "check balance of contract"); 
		});
    });
    
    it('Deploying product constract', async () => {
		productInstance = await Product.deployed();
		await web3.eth.getBalance(productInstance.address).then((balance) => {
			assert.equal(balance, 0, "check balance of contract"); 
		});
	}); 

    it('DOA adding a certifying authority to the registry', async() => {
        CA = await authorityKeys(); // generate random account keys 
        authorityAddress = CA[0];	// certifying authority public key
        await registryInstance.addPublicKey(authorityAddress, { from: DOA }); 
        let check = await registryInstance.checkPublicKey(authorityAddress); 
        assert.isTrue(check, "check if public key was added"); 
    });

    // ------------------------------------------------------------------------------------------------

    it('Producer sending product data to the database', async() => {
        // database is imitated using a simple JSON object that stores the
        // infromation about the product; producer can add their own data 
        // and send it to the IPFS storage, which can be retrieved later on 
        productInfo = {
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
        console.log(); 
        // initiate a global node for user 
        await initGlobalIpfs(); 
        // store data of the product and get the CID
        productCID = await loadIpfs(productInfo); 
        // verify the data stored is correct in IPFS 
        let retrieveData = await getIpfs(productCID); 
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

    // ------------------------------------------------------------------------------------------------

    it('Adding certificate from CA not in registry', async() => {
        let BadCA = await authorityKeys();
        let certData = await generateCertificate(batchID, BadCA[1]); 
        let certificate = certData[0];
        let signature = certData[1]; 

        await productInstance.addCertificate(batchID, certificate, signature, { from: producer }); 

        let verifyCert = await productInstance.verifyCertificate(batchID);
        // cannot verify a certificate of CA who is not in registry
        assert.isFalse(verifyCert); 
    });
    
    it('Adding certificate to the product', async() => {
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

    it('Someone verifying a product that has been tampered with', async() => {
        // modified off-chain data 
        modifiedProductInfo = {
            "barcode": "7391413312094",
            "quantity": 3200,
            "productName": "Madagascar Bananas",
            "produceDate": "24/11/2023",
            "expiryDate": "15/02/2023",
            "producer": "Fruits Orchard",
            "location": "Newcastle, NSW",
            "phone": "04222333990",
            "email": "hello@adversary.com.au", 
            "description": "bananas",
            "saleContract": "#38850138"
        }
        // hash the modified data and try to verify 
        let incorrectProductHash = web3.utils.sha3(modifiedProductInfo.toString());
        let prodVerify = await productInstance.verifyProductHash.call(batchID, incorrectProductHash, { from: thirdParty });
        assert.isFalse(prodVerify, 'The product was verified when it should not have been')
    });

    it('Someone verifying a certificate', async() => {
        let certVerify = await productInstance.verifyCertificate(batchID, { from: thirdParty });
        assert.isTrue(certVerify, 'The certificate could not be verified')
    });
    
    it('Someone getting the ownership of product after verification', async() => {
        let storageCID = await productInstance.getDatabase.call(batchID, { from: thirdParty });
        // then recovers actual product data from IPFS 
        let retrievedData = await getIpfs(storageCID); 
        // then computes hash of the received data 
        let newProductHash = web3.utils.sha3(retrievedData);

        await productInstance.updateOwner(batchID, newProductHash, newOwner, { from: producer });
        let productDetails = await productInstance.getProduct(batchID);
        // console.log(productDetails); 
        assert.equal(productDetails[1], newOwner, "ownership was not correctly updated");
    });

    it('Producer attempting to update certificate after selling', async() => {
        let certData = await generateCertificate(batchID, CA[1]); 
        let certificate = certData[0];
        let signature = certData[1]; 
        await truffleAssert.reverts(
            (productInstance.addCertificate(batchID, certificate, signature, { from: producer })), 
            "only owner can call this function"
        );
    });

    // Tests for multiple products on the supply chain

    // owner of one product cannot update data of another product

    // registered and selected CA cannot update data of another product

})