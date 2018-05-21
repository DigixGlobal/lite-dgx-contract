pragma solidity ^0.4.23;

import 'openzeppelin-solidity/contracts/token/ERC20/StandardToken.sol';
import './TokenReceiver.sol';

contract DGX {
  function read_user_fees_configs(address _account)
    public
    pure
    returns (bool, bool, bool);

  function read_transfer_config()
    public
    pure
    returns (uint256, uint256, uint256, address, bool, uint256);
}

contract WDGX is StandardToken {
  string public constant name = "Wrapped DGX";
  string public constant symbol = "WDGX";
  uint8 public constant decimals = 9;
  address public DGX_TOKEN_ADDRESS;
  address public DGX_TOKEN_STORAGE;
  bool public initialized;

  constructor(address _dgxTokenAddress, address _dgxTokenStorage) public {
    totalSupply_ = 0;
    DGX_TOKEN_ADDRESS = _dgxTokenAddress;
    DGX_TOKEN_STORAGE = _dgxTokenStorage;
  }

  function transferAndCall(address _receiver, uint256 _amount, bytes32 _data)
    public
    returns (bool success)
  {
    transfer(_receiver, _amount);
    success = TokenReceiver(_receiver).tokenFallback(msg.sender, _amount, _data);
    require(success);
  }

  // first deposit to make sure there is already some DGX/WDGX
  function firstDeposit(uint256 _dgxIn) public {
    require(!initialized);
    address _user = msg.sender;
    // this breaks the interaction-last practice, but can be considered safe
    // this transfer is done first so that we don't have to calculate the transfer fees
    require(ERC20(DGX_TOKEN_ADDRESS).transferFrom(_user, address(this), _dgxIn));
    totalSupply_ = ERC20(DGX_TOKEN_ADDRESS).balanceOf(address(this));
    balances[_user] = totalSupply_;
    emit Transfer(address(0x0), _user, totalSupply_);
    initialized = true;
  }

  // user deposits by calling transferAndCall(WDGX_contract, amount, "") on the DGX Token contract
  function tokenFallback(address _user, uint256 _dgxIn, bytes32 _data) public {
    require(msg.sender == DGX_TOKEN_ADDRESS);
    require(initialized);
    uint256 _transferRate;
    uint256 _transferBase;
    uint256 _realDgxIn;
    bool _globalNoFees;
    bool _userNoFees;

    (,_transferBase, _transferRate,,_globalNoFees,) = DGX(DGX_TOKEN_STORAGE).read_transfer_config();
    (,_userNoFees,) = DGX(DGX_TOKEN_STORAGE).read_user_fees_configs(_user);

    _realDgxIn = _dgxIn;
    if (!_globalNoFees && !_userNoFees) {
      _realDgxIn -= _transferRate * _dgxIn / _transferBase;
    }

    uint256 _dgxBalanceBeforeTransfer = ERC20(DGX_TOKEN_ADDRESS).balanceOf(address(this)) - _realDgxIn;
    uint256 _wdgxOut = _realDgxIn * totalSupply_ / _dgxBalanceBeforeTransfer;

    balances[_user] += _wdgxOut;
    totalSupply_ += _wdgxOut;
    emit Transfer(address(0x0), _user, _wdgxOut);
  }

  // withdraw in terms of dgx
  function withdraw(uint _dgxOut) public {
    uint256 _wdgxToBurn = _dgxOut * totalSupply_ / ERC20(DGX_TOKEN_ADDRESS).balanceOf(address(this));
    require(balances[msg.sender] >= _wdgxToBurn);
    balances[msg.sender] -= _wdgxToBurn;
    totalSupply_ -= _wdgxToBurn;
    emit Transfer(msg.sender, address(0x0), _wdgxToBurn);
    require(ERC20(DGX_TOKEN_ADDRESS).transfer(msg.sender, _dgxOut));
  }

  function dgxEquivalent()
    public
    constant
    returns (uint256 _dgxEquivalent)
  {
    uint256 _wdgxBalance = balances[msg.sender];
    _dgxEquivalent = ERC20(DGX_TOKEN_ADDRESS).balanceOf(address(this)) * _wdgxBalance / totalSupply_;
  }

  function getDgxWdgxRate()
    public
    constant
    returns (uint256 _dgxWdgx)
  {
    _dgxWdgx = totalSupply_ / ERC20(DGX_TOKEN_ADDRESS).balanceOf(address(this));
  }
}
