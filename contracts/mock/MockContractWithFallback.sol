pragma solidity ^0.4.23;

contract MockContractWithFallback {
  bytes32 public latestData;
  function tokenFallback(address _sender, uint256 _value, bytes32 _data)
    public
    returns (bool _success)
  {
    latestData = _data;
    _success = true;
  }
}
