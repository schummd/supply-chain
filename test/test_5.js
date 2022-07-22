const Product = artifacts.require("Product");
const Registry = artifacts.require("AuthorityRegistry");
const Oracle = artifacts.require("Oracle");
const axios = require('axios');



const assert = require("chai").assert;
const truffleAssert = require('truffle-assertions');
const timeMachine = require('ganache-time-traveler');

const { authorityKeys, generateSignature, generateCertificate } = require('../utilities/certificate.js'); 
const { initGlobalIpfs, loadIpfs, getIpfs } = require('../utilities/storage'); 
// const { oracleInstance } = require('../utilities/listener');

contract('Product', (accounts) => {

    let CA;         
    let batchID; 
    let authorityAddress;               // CA's public key 

    let productInfo;                    // producer's product data 
    let productCID;                     // keeps the ID of the product in IPFS
    const DOA = accounts[9];            // certification registry owner 
	const owner = accounts[0];          // contract owner 
	const producer = accounts[1];       // batch producer
	const distributor = accounts[2];    // batch distributor 
    const oracleOwner = accounts[8];

    let oracleInstance; 
    let productInstance; 
    let registryInstance; 


    // LISTENER
    before('setup contract', async() => {

        registryInstance = await Registry.deployed(); 
        oracleInstance = await Oracle.deployed(); 
        productInstance = await Product.deployed();
        // console.log(productInstance.address); 
        // monitor for events 
        oracleInstance.request(("request"), (error, result) => {
            // if(error) { console.error(error); }
            if(error) {console.log(error)}
            assert.equal(result.args[1], productInstance.address)
            //console.log("received request"); 
            // console.log(result.args.batchID); 
            //console.log(result.args)
            // make sure sending back to the right place
            // async() => {
            //    temperature = await replyTemperature();
            // }
            let temperature;
            async() => {
                temperature = await replyTemperature();
            }
            console.log('oracle found:')
            console.log(temperature);
            oracleInstance.replyTemp(result.args[0], 6, result.args[1], {from: oracleOwner});
            // force to wait for compare temperature event to emit
        })
    });

    async function replyTemperature() {
        let temperature = await axios.get(`https://www.random.org/integers/?num=1&min=1&max=6&col=1&base=10&format=plain&rnd=new`)
        .then(response => {
            console.log(response.data);
            return parseInt(response.data)
        })
        .catch(error =>  {
            console.log(error);
            return;
        });
        return temperature;
    };



    // ------------------------------------------------------------------------------------------------

    // it('Authority deploying CA registry contract', async () => {
    //     registryInstance = await Registry.deployed(); 
    //     await web3.eth.getBalance(registryInstance.address).then((balance) => {
	// 		assert.equal(balance, 0, "check balance of contract"); 
	// 	});
    // });
    
    // it('Deploying oracle contract', async() => {
    //     oracleInstance = await Oracle.deployed(); 
    //     await web3.eth.getBalance(oracleInstance.address).then((balance) => {
	// 		assert.equal(balance, 0, "check balance of contract"); 
	// 	});
    // }); 

    // it('Deploying product constract', async () => {
	// 	productInstance = await Product.deployed();
	// 	await web3.eth.getBalance(productInstance.address).then((balance) => {
	// 		assert.equal(balance, 0, "check balance of contract"); 
	// 	});
	// }); 

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
        //console.log(); 
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
        let newProductHash;                 // newly computed hash of the product 
        let productHash = web3.utils.sha3(retrieveData);
        let temperature = 5; 
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

    it('Oracle requesting temperature', async() => {
        let result = await productInstance.getTemperature(batchID, { from: producer });
        // await oracleInstance.getPastEvents().then((ev) => caughtEvent = ev[0]); 
        // let recvBatchID = caughtEvent.args[0];
        // let caller = caughtEvent.args[1];
        // assert.equal(caller, productInstance.address); // assert caller is product contract
        // console.log('event received');
        // console.log(recvBatchID, caller);

        // let res = await oracleInstance.replyTemp(recvBatchID, 6, caller, {from: oracleOwner});

        // stall tests 
        await getIpfs(productCID); 

        let status = await productInstance.getProduct(batchID);
        assert.equal(status[2], false);
        // console.log(result); 
        
        // console.log(status); 
        

        // let response = await oracleInstance.replyTemp(batchID, 10, productInstance.address, { from: oracle });
        // console.log(response); // returned true
        // let status = await productInstance.getProduct(batchID);
        // assert.equal(status[2], false);
        
        // status = await productInstance.getStatus.call(batchID, { from: producer }); 
        // console.log(status); 

        // let temp = await productInstance.checkTemp({ from: producer }); 
        // console.log(temp); 
    });



    it('Oracle pushing data to products', async() => {
        for (i = 0; i < 10; i++) {
            let temp = await replyTemperature();
            console.log(temp);
            let sendTemp = await oracleInstance.replyTemp(batchID, temp, productInstance.address, {from: oracleOwner});
            let status = await productInstance.getProduct(batchID);
            console.log(status);
        }
    });

})