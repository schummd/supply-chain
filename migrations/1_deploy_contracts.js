
const Registry = artifacts.require("AuthorityRegistry");
const Product = artifacts.require("Product"); 
const Oracle = artifacts.require("Oracle");

// need account for oracle listener to pass to oracle constructor
// offChainSender = account listener responds from


module.exports = function(deployer, network, accounts) {
    const owner = accounts[0];              // supply chain contract owner 
    const DOA = accounts[9];                // Department of Agriculture owns a registry of CAs 
    const ownerOfOracle = accounts[8];      // trusted address to receive data from
    deployer.then(async() => {
        await deployer.deploy(Registry, DOA); // on a different network 
        // need to get the address of the off chain listener
        await deployer.deploy(Oracle, ownerOfOracle);
        await deployer.deploy(Product, Oracle.address, Registry.address, owner); 
    });

    // deployer.deploy(Registry, DOA);
    // deployer.deploy(Product, DOA, owner); 
}
