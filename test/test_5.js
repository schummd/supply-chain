const Product = artifacts.require("Product");
const Registry = artifacts.require("AuthorityRegistry");
const Oracle = artifacts.require("Oracle");

const assert = require("chai").assert;
const truffleAssertions = require("truffle-assertions");
const { authorityKeys, generateCertificate } = require('../utilities/certificate.js'); 
const { initGlobalIpfs, loadIpfs, getIpfs } = require('../utilities/storage'); 
const { fetchTemperature } = require('../utilities/temperature'); 


contract('Product', (accounts) => {

    let CA;         
    let batchID; 
    let authorityAddress;               // CA's public key 

    let status; 
    let productInfo;                    // producer's product data 
    let productCID;                     // keeps the ID of the product in IPFS
    let newProductHash;                 // newly computed hash of the product 

    const DOA = accounts[9];            // certification registry owner 
	const owner = accounts[0];          // contract owner 
	const producer1 = accounts[1];       // batch producer
    const producer2 = accounts[3];       // batch producer
	const distributor = accounts[2];    // distributor 
    const oracle = accounts[8];         // oracle owner

    // ------------------------------------------------------------------------------------------------
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

    it('Producers sending two product data to the database', async() => {
        // database is imitated using a simple JSON object that stores the
        // infromation about the product; producer can add their own data 
        // and send it to the IPFS storage, which can be retrieved later on 
        product1Info = {
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
        product2Info = {
            "barcode": "3690278390461",
            "quantity": 2000,
            "productName": "Orange(Navel)",
            "produceDate": "04/01/2023",
            "expiryDate": "31/01/2023",
            "producer": "Schofields Orchard",
            "location": "Richmond, NSW",
            "phone": "0411119701",
            "email": "schosons@bigpond.com", 
            "description": "oranges",
            "saleContract": "#4513404285"
        }
        console.log();  
        // store data of the product and get the CID
        product1CID = await loadIpfs(product1Info); 
        product2CID = await loadIpfs(product2Info);
        // verify the data stored is correct in IPFS 
        let retrieveData1 = await getIpfs(product1CID); 
        let retrieveData2 = await getIpfs(product2CID);
        assert.equal(JSON.stringify(product1Info), retrieveData1, "the data stored on IPFS is the same");
        assert.equal(JSON.stringify(product2Info), retrieveData2, "the data stored on IPFS is the same"); 
    });

    it('Contract owner authorising two producers', async() => {
        // contract deployer declares a producer as authorised 
        await productInstance.addProducer(producer1, { from: owner }); 
        await productInstance.addProducer(producer2, { from: owner }); 
        let verifyProducer1 = await productInstance.getProducer.call(producer1); 
        let verifyProducer2 = await productInstance.getProducer.call(producer2); 
        assert.isTrue(verifyProducer1, "check if producer authorised in contract"); 
        assert.isTrue(verifyProducer2, "check if producer authorised in contract"); 
    });

    it('Producer adding product to the product contract', async() => {
        // retrieve data from the file storage 
        let retrieveData1 = await getIpfs(product1CID);
        let retrieveData2 = await getIpfs(product2CID); 
        // generate hash of the data 
        let product1Hash = web3.utils.sha3(retrieveData1);
        let product2Hash = web3.utils.sha3(retrieveData2);
        let temperature = 8; 
        let string1CID = product1CID.toString();
        let string2CID = product2CID.toString();

        // add a product to the contract 
        await productInstance.addProduct(product1Hash, temperature, string1CID, { from: producer1 })
        await productInstance.getPastEvents().then((ev) => batchID1 = ev[0].args[0]);
        await productInstance.addProduct(product2Hash, temperature, string2CID, { from: producer2 })
        console.log(batchID)
        await productInstance.getPastEvents().then((ev) => batchID2 = ev[0].args[0]); 

        // get the product infromation 
        let checkProduct1 = await productInstance.getProduct(batchID1); 
        // check if the data is correct 
        assert.equal(checkProduct1[0], product1Hash, "check the supplied product hash is the same as stored"); 
        // assert.equal(checkProduct[1], conditionsHash, "check the supplied conditions hash is the same as stored"); 
        assert.equal(checkProduct1[1], producer1, "check the owner is the same who transacted"); 
        // get the product infromation 
        let checkProduct2 = await productInstance.getProduct(batchID2); 
        // check if the data is correct 
        assert.equal(checkProduct2[0], product2Hash, "check the supplied product hash is the same as stored"); 
        // assert.equal(checkProduct[1], conditionsHash, "check the supplied conditions hash is the same as stored"); 
        assert.equal(checkProduct2[1], producer2, "check the owner is the same who transacted"); 
    }); 

    // producer can request a certifying authority to issue oragnic certificate 
    // to a batch he produced; the request producer does is off-chain and may 
    // involve various communication means (e.g., email)
    
    // the CA conducts physical product audit and releases certificate 
    // to the producer that certifies the product meets organic guidelines 

    // once the producer received the certificate and issuer signature,
    // he adds this infromation on-chain 
    it('Wrong producer adding certificate to the product', async() => {
        // CA generates certificate for product batch 
        let certData = await generateCertificate(batchID2, CA[1]); 
        let certificate = certData[0];
        let signature = certData[1]; 
        // producer1 adds certificate to the product2
        // it should be return false only owner can call this function 
        await productInstance.addCertificate(batchID2, certificate, signature, { from: producer1 }); 
    });

    it('Producer adding certificate to the product', async() => {
        // CA generates certificate for product batch 
        let certData1 = await generateCertificate(batchID1, CA[1]);
        let certData2 = await generateCertificate(batchID2, CA[1]);
        // let certificate = certData1[0];
        // let signature = certData1[1]; 

        // producer adds certificate to the product 
        await productInstance.addCertificate(batchID1, certData1[0], certData1[1], { from: producer1 });
        await productInstance.addCertificate(batchID2, certData2[0], certData2[1], { from: producer2 }); 
        // check if the certificate the same on-chain 
        let response1 = await productInstance.getCertificate.call(batchID1); 
        let response2 = await productInstance.getCertificate.call(batchID2);
        // console.log(response1)
        // console.log(response2)
        // let returnedCertificate = response1[0];
        // let returnedSignature = response1[1]; 
        assert.equal(certData1[0], response1[0], "check the certificated stored is the same"); 
        assert.equal(certData1[1], response1[1], "check the signature stored is the same"); 
        assert.equal(certData2[0], response2[0], "check the certificated stored is the same"); 
        assert.equal(certData2[1], response2[1], "check the signature stored is the same");
    });

    // ------------------------------------------------------------------------------------------------
    // the producer now wants to sell the batch to the distributor and 
    // we assume the negotiation and sale conducted off-chain, but 
    // distributor can verify batch certificate and data using on-chain 
    // functionalities; 

    // onces the buyer satisfied with results, the producer initiates 
    // change of ownership on-chain and dispatches the batch off-chain 

    it('Distributor verifying the certificate of the batch', async() => {
        let verification = await productInstance.verifyCertificate(batchID1, { from: distributor });
        assert.isTrue(verification, "batch certificate was signed by a valid authority"); 
    });

    it('Distributor verifying off-chain data of product1 to on-chain hash', async() => {
        // distributor recovers IPFS CID from the contract 
        let storageCID = await productInstance.getDatabase.call(batchID1, { from: distributor });
        // then recovers actual product data from IPFS 
        let retrievedData = await getIpfs(storageCID); 
        // then computes hash of the received data 
        newProductHash = web3.utils.sha3(retrievedData);
        // // then recovers the product hash from the contract and compares 
        let onchainHash = await productInstance.getProduct.call(batchID1, { from: distributor }); 
        assert.equal(onchainHash[0], newProductHash, "check if newly computed product hash is the same as stored on-chain"); 
    }); 

    // the certificate is ligitimate and data off-chain has not been tampered 
    // then distributor satisfied with the batch and purchases it 
    // the funds transfer are done off-chain, we only record transfer of 
    // ownership in the product data struct 

    // update owner function performs additional check of the certificate
    // and product hash 

    it('Wrong producer transferring ownership to the distributor', async() => {
        // producer1 transfer ownership of the product2 to the distributor
        // it should be return false only owner can call this function
        await productInstance.updateOwner(batchID1, newProductHash, distributor, { from: producer2 });
    }); 

    it('Wrong product transferring ownership to the distributor', async() => {
        // producer1 transfer ownership of the product2 to the distributor
        // it should be return false only owner can call this function
        await productInstance.updateOwner(batchID2, newProductHash, distributor, { from: producer2 });
    });

    it('Producer transferring ownership of product1 to the distributor', async() => {
        await productInstance.updateOwner(batchID1, newProductHash, distributor, { from: producer1 }); 
        let checkOnwer = await productInstance.getProduct.call(batchID1, { from: distributor }); 
        assert.equal(checkOnwer[1], distributor, "check if the current owner is the distributor"); 
    }); 

    // ------------------------------------------------------------------------------------------------

    it('Oracle requesting temperature, compared with the required temperature of product1, it is too high', async() => {
        // from the product contract trigger temperature request 
        // for testing purposes indicate the range of requested temperature
        await productInstance.getTemperature(batchID1).then(async() => {
            await oracleInstance.getPastEvents('request').then(async(ev) => {
                await fetchTemperature(9, 15).then(async(response) => {//the required temperature of product1 is set to 8
                    console.log('Temperature from thermometers '+response)
                    await oracleInstance.replyTemp(ev[0].args[0], response, productInstance.address, { from: oracle });
                }); 
            }); 
        }); 
        // verify status was changed because temperature is too high 
        status = await productInstance.getStatus.call(batchID1);
        assert.isFalse(status, "check if status is false");
    });

    it('Temporarily disabling contract to conduct hardware checks', async() => {
        // since the disabling contract can be called by the contract owner, 
        // the current batch owner has to contract off-chain the manager;
        // then manager / contract owner halts the contract 
        await productInstance.emergencyHalt({ from: owner }); 
        status = await productInstance.checkHalt.call({ from: producer2 }); 
        assert.isTrue(status, "check if contract is on pause"); 
    }); 

    it('Producer attempts to change status back while halt is on', async() => {
        await truffleAssertions.fails(productInstance.updateStatus(batchID2, true, { from: producer2 }), "contract halt");
    });

    it('Contract owner re-activating contract', async() => {
        // after physical examination of the hardware and ensurance there
        // is no issue with the storage, the batch owner notifies contract
        // manager that the contract can be reactivated, and owner 
        // reactivates the contract 
        await productInstance.restartContract({ from: owner }); 
        status = await productInstance.checkHalt.call({ from: producer1 }); 
        assert.isFalse(status, "check if contract is active"); 
    }); 

    it('Product owner resetting status after physical checks', async() => {
        // after notification of incorrect temperature, the current batch
        // owner can conduct physical inspection of the product and verify
        // whether the temperature within norm and there were some malfunction
        // with termometer; in such case, owner can reset the status to true 
        await productInstance.updateStatus(batchID2, true, { from: producer2 }); 
        // verify status was changed because temperature is too high 
        status = await productInstance.getStatus.call(batchID2);
        assert.isTrue(status, "check if status has been reset");
    }); 

    it('Oracle requesting temperature, the actual temperature is lower than required of product2', async() => {
        await productInstance.getTemperature(batchID1).then(async() => {
            await oracleInstance.getPastEvents('request').then(async(ev) => {
                await fetchTemperature(1, 5).then(async(response) => {
                    console.log('Temperature from thermometers '+response)
                    await oracleInstance.replyTemp(ev[0].args[0], response, productInstance.address, { from: oracle });
                }); 
            }); 
        });
        // verify status was changed because temperature is too high 
        status = await productInstance.getStatus.call(batchID2);
        assert.isTrue(status, "check if status is true");
    });
})