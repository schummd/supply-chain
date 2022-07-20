
const Registry = artifacts.require("AuthorityRegistry");
const Product = artifacts.require("Product"); 
const TempOracle = artifacts.require("TempOracle");

module.exports = function(deployer, network, accounts) {
    
    const owner = accounts[0];              // supply chain contract owner 
    const DOA = accounts[9];                // Department of Agriculture owns a registry of CAs 

    deployer.then(async() => {
        await deployer.deploy(Registry, DOA); // on a different network 
        await deployer.deploy(TempOracle, Registry.address);
        await deployer.deploy(Product, TempOracle.address, Registry.address, owner); 
    });

    // deployer.deploy(Registry, DOA);
    // deployer.deploy(Product, DOA, owner); 
}