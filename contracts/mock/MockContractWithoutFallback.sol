pragma solidity ^0.4.23;

contract MockContractWithoutFallback {
  bytes32 public latestData;

  constructor() public {
    latestData = "a";
  }
}
