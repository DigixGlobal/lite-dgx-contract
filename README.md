# LiteDGX

Wrapper contract for Digix Gold Token (DGX)

### Overview
* No transfer fees
* No demurrage fees
* ERC-20 and ERC-677 compliant
* Rate of DGX/LiteDGX will decay over time due to the demurrage fees on the underlying DGXs in the contract. This rate can be read from calling `getDgxLdgxRate` and divide the result by 10^9


### Test
* Install the dependencies
  ```
  npm install
  npm i -g truffle
  ```
* Compile the contracts
  ```
  truffle compile
  ```
* Run tests
  ```
  npm test
  ```
