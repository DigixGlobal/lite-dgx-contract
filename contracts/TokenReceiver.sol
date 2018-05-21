pragma solidity ^0.4.19;

contract TokenReceiver {
  function tokenFallback(address from, uint256 amount, bytes32 data) public returns (bool success);
}
