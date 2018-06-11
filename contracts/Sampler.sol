pragma solidity ^0.4.23;

contract Sampler {

    address public owner;
    uint256 public accountsTotal;
    mapping(uint256 => address) accounts;

    constructor() public {
        owner = msg.sender;
        accountsTotal = 0;
    }

    function createAccounts(uint256 _count) returns (bool _success) {
      for(uint256 i = 0;i < _count;i++) {
        address _account;
        assembly {
          _account := create(0,0,0)
        }
        accounts[accountsTotal++] = _account;
      }
      _success = true;
    }

    function getAccount(uint256 _id) returns (address _account) {
        _account = accounts[_id];
    }
}
