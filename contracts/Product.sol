// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./CARegistry.sol"; 

contract Product {

    bool internal locked;                   // lock for payments (not sure if necessary yet)
    address owner;
    // address CA;
    address DOA;                            // Department of Agriculture contract address 

    // another option to map multiple structs:
    // https://ethereum.stackexchange.com/questions/82157/mapping-multiple-structs-to-a-struct-and-call-them
    
    // keeps the hash of product data and contions,
    // certificate infromation and the current owner 
    struct Batch {
        bytes32 productHash; 
        bytes32 conditionsHash;

        bytes32 certificate; 
        bytes signature;                // created with web3.eth.sign(), bytes 

        // uint256 expiration;          // not sure if we need it? 
        // address issuer;

        address currentOwner;
        uint256 temperature;            // keeping temperature of storage from oracle 
    }

    // maps each product ID to a product data   
    mapping (bytes32 => Batch) products; 

    // alternatively keep as array:
    // Product[] products; 

    constructor(address _DOA, address _owner) {
        DOA = _DOA; 
        owner = _owner; 
    }

    // only owner can call the function 
    modifier onlyOwner(address _owner) { require(msg.sender == _owner); _; }
    // only after that time can call the function 
    modifier onlyAfter(uint256 _time) { require(block.timestamp > _time); _; }
    // only before that time can call the function 
    modifier onlyBefore(uint256 _time) { require(block.timestamp < _time); _;}
    // lock against reentrancy 
    modifier lock() { 
        require(!locked); 
        locked = true; _; 
        locked = false;
    }

    // send generated product ID to off-chain 
    event batchIdentifier(bytes32 productID); 

    event batchCertificate(bytes32 certificate, bytes signature); 


    /* PRODUCT FUNCTIONS ------------------------------------------------------------------ */

    // adds product data hash and conditions hash 
    function addProduct(bytes32 _data, bytes32 _conditions) public {
        bytes32 batchID = bytes32(keccak256(abi.encodePacked(_data, _conditions))); 
        products[batchID].productHash = _data; 
        products[batchID].conditionsHash = _conditions; 
        products[batchID].currentOwner = msg.sender; 
        emit batchIdentifier(batchID);
    }

    // only current owner 
    function updateProduct(bytes32 _updatedData) public {
        
    }

    // 
    function updateConditions(bytes32 _updateConditions) public {

    }

    // requires oracle 
    function updateTemperature(uint256 _temperature) public {

    }

    // update certificate data in product - only authorised CA 
    function updateCertificate(bytes32 _batchID, bytes32 _certificate, bytes memory _signature) public {
        products[_batchID].certificate = _certificate; 
        products[_batchID].signature = _signature; 
        emit batchCertificate(_certificate, _signature);
    }

    function getProduct(bytes32 _batchID) public view returns(bytes32, bytes32, address) {
        return (products[_batchID].productHash, products[_batchID].conditionsHash, products[_batchID].currentOwner);
    }


    /* CERTIFICATE FUNCTIONS ------------------------------------------------------------------ */
    
    // anyone can send a product ID and verify its certificate
    // should check if the certificate exists first, if not then false 
    function verifyCertificate(bytes32 _batchID) external view returns(bool) {
        bytes32 certificate = products[_batchID].certificate; 
        bytes memory signature = products[_batchID].signature; 
        // recovered issuer from the certificate and his signature 
        address issuer = recoverIssuer(certificate, signature); 
        if (verifyIssuer(issuer) == true) { return true; }
        return false; 
    }

    // verify that the certifying authority is registered with DOA 
    // and eligible to issue organic certificates
    function verifyIssuer(address _issuer) internal view returns(bool) {
        AuthorityRegistry registry = AuthorityRegistry(DOA);  
        return registry.checkPublicKey(_issuer);
    }

    /**
     * @notice functions recovers the signer of the certificate from the provided certificate 
               (message signed by authority) and signature 
     * @dev    called internally from placeBid function  
     * @param  _hash the batch certificate signed by CA 
     * @param  _sig CA's bytes signature generated using web3.eth.sign()
     * @return issuer address (authority who issued/signed the organic certificate to the product batch)
    **/
    // copyright: https://github.com/protofire/zeppelin-solidity/blob/master/contracts/ECRecovery.sol
    function recoverIssuer(bytes32 _hash, bytes memory _sig) internal pure returns(address) {
        bytes32 r; bytes32 s; uint8 v;
        //Check the signature length
        if (_sig.length != 65) { return (address(0)); }
        assembly {
            r := mload(add(_sig, 32))
            s := mload(add(_sig, 64))
            v := byte(0, mload(add(_sig, 96)))
        }
        if (v < 27) { v += 27; }

        // If the version is correct return the signer address
        if (v != 27 && v != 28) { return (address(0)); } 
        else { return ecrecover(_hash, v, r, s); }
    }

}