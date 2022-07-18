const Product = artifacts.require("Product");
const Registry = artifacts.require("AuthorityRegistry");

const assert = require("chai").assert;
const truffleAssert = require('truffle-assertions');
const timeMachine = require('ganache-time-traveler');

const { authorityKeys, generateSignature, generateCertificate } = require('../utilities/certificate.js'); 


contract('Product', (accounts) => {

    let CA; 
    let batchID; 
    let authorityAddress; 

    const DOA = accounts[9];        // certification registry owner 
	const owner = accounts[0];      // contract owner 
	const a = accounts[1]; 
	const b = accounts[2]; 



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



    it('Adding product to the product contract', async() => {
        // generate 2 random hashes for testing
        let productHash = web3.utils.sha3('product');
        let conditionsHash = web3.utils.sha3('conditions');

        // add a product to the contract 
        await productInstance.addProduct(productHash, conditionsHash, { from: a })
        await productInstance.getPastEvents().then((ev) => batchID = ev[0].args[0]); 

        // get the product infromation 
        let checkProduct = await productInstance.getProduct(batchID); 
        // console.log(checkProduct);
        
        // check if the data is correct 
        assert.equal(checkProduct[0], productHash, "check the supplied product hash is the same as stored"); 
        assert.equal(checkProduct[1], conditionsHash, "check the supplied conditions hash is the same as stored"); 
        assert.equal(checkProduct[2], a, "check the owner is the same who transacted"); 
    }); 



    it('Adding certificate to the product', async() => {
        let certData = await generateCertificate(batchID, CA[1]); 
        let certificate = certData[0];
        let signature = certData[1]; 
        let returnedCertificate; 
        let returnedSignature; 
        // console.log(certificate);
        // console.log(signature); 

        let productHash = web3.utils.sha3('product');
        let conditionsHash = web3.utils.sha3('conditions');

        // producer requests a CA who can then add certificate
        // make sure they are in the CA registry
        let authoriseCAresponse = await productInstance.authoriseCA(batchID, CA[0], { from: a })
        console.log(authoriseCAresponse);
        assert.isTrue(authoriseCAresponse, "Check CA is in Ca registry")

        // I only commented this out while trying to debug the above issue
        
    //     // now can update the certificate
    //     await productInstance.updateCertificate(batchID, certificate, signature); 
    //     await productInstance.getPastEvents().then((ev) => returnedCertificate = ev[0].args[0]);
    //     await productInstance.getPastEvents().then((ev) => returnedSignature = ev[0].args[1]);
    //     // console.log(returnedCertificate);
    //     // console.log(returnedSignature); 

    //     assert.equal(certificate, returnedCertificate, "check the certificated stored is the same"); 
    //     assert.equal(signature, returnedSignature, "check the signature stored is the same"); 
    // });

    // it('Verify the certificate of the batch', async() => {
    //     let verification = await productInstance.verifyCertificate(batchID);
    //     assert.isTrue(verification, "batch certificate was signed by a valid authority"); 
    });

})