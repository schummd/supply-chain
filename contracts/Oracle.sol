//SPDX-License-Identifier: UNLICENSED
 
pragma solidity ^0.8.0;
import "./OracleClient.sol";

// abstract class for oracle contract, which implements the oracle interface
contract Oracle is OracleInterface {
    
    event temperatureRequest(bytes32 batchID, address caller);

    address public trustedServer;

    // only get temperature from declared source
    // modifier trusted(address serverAddr) { require(serverAddr == trustedServer, 'data must come from the trusted source'); _; }

    constructor(address serverAddr) {
        trustedServer = serverAddr;
    }

    // emit a request for temperature data for the given batchId for the 
    // listener to hear
    function requestData(bytes32 batchId) public override {
        emit request(batchId, msg.sender);
    }
    
    // send the data from the oracle to the client
    // called by the listener after obtaining the requested
    // data and sends the new data to the product contract
    function replyTemp(bytes32 batchId, uint256 data, address caller) public virtual returns (bool){
        return TemperatureOracleClient(caller).receiveDataFromOracle(data, batchId);
    }
}
