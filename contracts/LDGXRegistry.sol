pragma solidity ^0.4.23;

import './LDGX.sol';

contract LDGXRegistry {

  address public DGX_TOKEN_ADDRESS;
  address public DGX_TOKEN_STORAGE;
  address public ROOT;

  struct User {
    address depositAddress;
    address liteDGXWallet;
  }

  struct Exchange { 
    address owner;
    address exchangeWallet;
    uint256 totalUsers;
    mapping(uint256 => User) users;
    address ldgxInstance;
  }

  uint256 totalExchanges;
  mapping(uint256 => Exchange) exchanges;

  constructor(address _dgxTokenAddress, address _dgxTokenStorage) public {
    DGX_TOKEN_ADDRESS = _dgxTokenAddress;
    DGX_TOKEN_STORAGE = _dgxTokenStorage;
    ROOT = msg.sender;
  }

  // Creates a new exchange contract which holds its own list of users
  function createExchange(address _exchange_wallet) public returns (uint256 _id) {
    address _ldgxInstance;
    _id = totalExchanges + 1;
    Exchange exchange;
    exchange[_id].owner = msg.sender;
    exchange[_id].exchangeWallet = _exchange_wallet;
    exchange[_id].totalUsers = 0;
    exchange[_id].ldgxInstance = new LDGX;
  }

  // Creates a new deposit address for an exchange 
  function createUser(uint256 _exchange_id) public returns (address _new_deposit_address) {
    require(exchanges[_exchange_id].owner == msg.sender); 
    uint256 _total_users = exchange[_exchange_id].totalUsers + 1;
    assembly {
      _new_deposit_address := create(0,0,0)
    }
    exchange[_exchange_id].users[_total_users].depositAddress = _new_deposit_address;
  }

  // Sweep DGX balances from deposit address associated with an exchange and moves it into exchange
  function sweepBalance(uint256 _exchange_id, uint256 _user_id, address _lite_dgx_target) public returns (bool _success) {
  }

  // Withdraw DGX from LiteDGX and send to recipient
  function withdraw(uint256 _exchange_id, uint256 _user_id, address _user) public returns (bool _success) {
  }

  // Implement per-exchange bulkSweep function here
  // Implement per-exchange bulkWithdraw function

}
