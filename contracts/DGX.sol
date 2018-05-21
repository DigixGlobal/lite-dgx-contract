pragma solidity ^0.4.23;

import "./DGXStorage.sol";

contract DGX {

  address DGX_STORAGE_ADDRESS;

  string public constant name = "Digix Gold Token";
  string public constant symbol = "DGX";
  uint8 public constant decimals = 9;

  constructor(address _dgxStorage)
    public
  {
    DGX_STORAGE_ADDRESS = _dgxStorage;
  }

  function totalSupply()
    public
    constant
    returns (uint256 _totalSupply)
  {
    _totalSupply = DGXStorage(DGX_STORAGE_ADDRESS).read_total_supply();
  }

  function balanceOf(address _owner)
    public
    constant
    returns (uint256 _balance)
  {
    _balance = DGXStorage(DGX_STORAGE_ADDRESS).show_demurraged_balance(_owner);
  }

  function transfer(address _to, uint256 _value)
    public
    returns (bool _success)
  {
    _success = DGXStorage(DGX_STORAGE_ADDRESS).put_transfer(msg.sender, _to, 0x0, _value, false);
  }

  function transferFrom(
    address _from,
    address _to,
    uint256 _value
  )
    public
    returns (bool _success)
  {
    _success = DGXStorage(DGX_STORAGE_ADDRESS).put_transfer(_from, _to, msg.sender, _value, true);
  }

  function transferAndCall(
    address _receiver,
    uint256 _amount,
    bytes32 _data
  )
    public
    returns (bool _success)
  {
    transfer(_receiver, _amount);
    _success = TokenReceiver(_receiver).tokenFallback(msg.sender, _amount, _data);
    require(_success);
  }

  function approve(address _spender, uint256 _value)
    public
    returns (bool _success)
  {
    _success = DGXStorage(DGX_STORAGE_ADDRESS).put_approve(msg.sender, _spender, _value);
  }

  function allowance(address _owner, address _spender)
    public
    constant
    returns (uint256 _allowance)
  {
    _allowance = DGXStorage(DGX_STORAGE_ADDRESS).read_allowance(_owner, _spender);
  }

  ////////////////////////////// MOCK FUNCTIONS ///////////////////////////////

  // This function is not present in the DGX2.0 token contracts.
  // For test purpose, only used to bypass the POP process
  function mintDgxFor(address _for, uint256 _amount)
    public
    returns (bool _success)
  {
    _success = DGXStorage(DGX_STORAGE_ADDRESS).mint_dgx_for(_for, _amount);
  }
}
