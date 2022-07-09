// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract CARegistryContract {

	// registry of public keys of CA's that are authorised to issue certificates 

    address owner; // contract owner who can add/remove CA's authorisation

    mapping(address => bool) public registry; 

    constructor(address _owner) {
        owner = _owner; 
    }

    // only owner an call functions 
    modifier onlyOwner(address _owner) { require(msg.sender == _owner, "Only owner can call this"); _; }

    // owner adds pubic key to the registry 
    function addPublicKey(address _publicKey) public onlyOwner(owner) returns(bool) {
        registry[_publicKey] = true; 
        return true; 
    }

    // owner removes public key from the registry 
    function deletePublicKey(address _publicKey) public onlyOwner(owner) {
        delete registry[_publicKey];
    }

    // other contracts can call this and see if the given key in regestry 
    function checkPublicKey(address _publicKey) external view returns(bool) {
        if (registry[_publicKey]) { return true; }
        return false; 
    }

}
