**Install & Test**

Before deploying the contracts, install all the required dependancies by 
running ```npm install```.   

In the separate terminal window run the Ganache with ```ganache-cli``` command.  

Then run test files to see the contracts being deployed and tested with 
```truffle test``` command (will run all the tests). 


**Contracts Deployment**

The code has been set up using Truffle framework and contains the following contracts:
```CARegistry.sol```, ```Product.sol``` and oracle contracts ```Oracle.sol```, 
```OracleClient.sol```, ```OracleInterface.sol```.  

All contracts can be deployed by running ```truffle deploy``` command.  

First, it deploys ```CARegistry.sol``` with DOA address as the contract owner. Then 
we ```Oracle.sol``` with oracle owner address, and then ```Product.sol``` with 
contract owner address, CA Registry contract address and Oracle contract address.  


**Test Files** 

The directory *test* has four test files that deploy and test smart contracts
using various scenarious. 


**Utilities**

The *utilities* directory contains three files that provide off-chain computations
to the smart contracts, such as generating certificate, initiating and sending data
to the IPFS storage, retrieving data from IPFS, and quering external API.  

Since our oracle ideally would be connected to the thermometer installed in the 
physical batch storage to report the temperature, we have used a random number generator 
API to imitate query for temperature.  
