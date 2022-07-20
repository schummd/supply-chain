// CREDIT: https://github.com/COMP6452-UNSW/oracle_example/tree/master/smart_contracts (adapted from above git repo)
// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;
// contract that defines the interface to interact with oracle
interface OracleInterface {
    function requestData(bytes32 batchId, bytes memory data) external;
}


// abstract client class for oracle client
abstract contract OracleClient {
    address _oracleAddress;

    constructor(address oracleAddress) {
        _oracleAddress = oracleAddress;
    } 


    // only the oracle should be able to update the data in the products contract
    modifier oracleOnly(){
        require(msg.sender == _oracleAddress);
        _;
    }

    function requestDataFromOracle(bytes32 batchId, bytes memory data) internal  {
        // request Data from oracle for the given data
        OracleInterface(_oracleAddress).requestData(batchId, data);
    }

    function receiveDataFromOracle(bytes32 batchId, bytes memory data)
    public
    virtual;
}


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
contract TemperatureOracle is Oracle {
    constructor(address tempSource) Oracle(tempSource) {}
}


//The abstract class for the temperature oracle client
abstract contract TemperatureOracleClient is OracleClient {
    constructor(address oracleAd) OracleClient(oracleAd) {}

    // function to request the temperature from the oracle temperature source
    function requestTemperatureFromOracle(bytes32 batchId, uint256 temp) internal {
        requestDataFromOracle(batchId, abi.encode(temp));
    }

    function receiveDataFromOracle(bytes32 batchId, bytes memory data)
    public override
    oracleOnly() {
        (uint256 recvdTemp) = abi.decode(data, (uint256));
        receiveTemperatureFromOracle(batchId, recvdTemp);
    }

    function receiveTemperatureFromOracle (
        bytes32 batchId, uint256 recvdTemp)
        internal virtual;
}