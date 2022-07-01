
const CARegistry = artifacts.require("CARegistryContract.sol");

module.exports = function(deployer, network, accounts) {
    const owner = accounts[0]; 
    deployer.deploy(CARegistry, owner);
}