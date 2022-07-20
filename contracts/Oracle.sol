//SPDX-License-Identifier: UNLICENSED
 
pragma solidity ^0.8.0;
import "./OracleInterface.sol";
// abstract class for oracle contract, which implements the oracle interface
abstract contract Oracle is OracleInterface {
    event request(bytes32 bacthId, bytes data, address caller);

    address public trustedServer;

    // only get temperature from declared source
    modifier trusted(address serverAddr) {
        
        require(serverAddr == trustedServer); _;
    }

    constructor(address serverAddr) {
        trustedServer = serverAddr;
    }

    function requestData(bytes32 batchId, bytes memory data) public override {
        emit request(batchId, data, msg.sender);
    }
}

// The concrete class for the temperature oracle
contract TempOracle is Oracle {
    constructor(address tempSource) Oracle(tempSource) {}
}
