//SPDX-License-Identifier: UNLICENSED
 
pragma solidity ^0.8.0;
import "./OracleInterface.sol";
import "./OracleClient.sol";
// abstract class for oracle contract, which implements the oracle interface
contract Oracle is OracleInterface {
    event request(bytes batchId, address caller);

    address public trustedServer;

    // only get temperature from declared source
    modifier trusted(address serverAddr) {
        
        require(serverAddr == trustedServer); _;
    }

    constructor(address serverAddr) {
        trustedServer = serverAddr;
    }

    // emit a request for temperature data for the given batchId for the 
    // listener to hear
    function requestData(bytes memory batchId) public override {
        emit request(batchId , msg.sender);
    }
    
    // send the data from the oracle to the client
    function replyTemp(bytes memory data, address caller) public virtual trusted(caller) {
        TemperatureOracleClient(caller).receiveDataFromOracle(data);
    }
}
