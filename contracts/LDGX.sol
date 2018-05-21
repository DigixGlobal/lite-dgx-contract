pragma solidity ^0.4.23;

import 'openzeppelin-solidity/contracts/token/ERC20/StandardToken.sol';
import './TokenReceiver.sol';

contract DGXStorage {
  function read_user_fees_configs(address _account)
    public
    pure
    returns (bool, bool, bool);

  function read_transfer_config()
    public
    pure
    returns (uint256, uint256, uint256, address, bool, uint256);
}

contract LDGX is StandardToken {
  string public constant name = "Lite DGX";
  string public constant symbol = "LDGX";
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

  // first deposit to make sure there is already some DGX/LDGX
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

  // user deposits by calling transferAndCall(LDGX_contract, amount, "") on the DGX Token contract
  function tokenFallback(address _user, uint256 _dgxIn, bytes32 _data) public {
    require(msg.sender == DGX_TOKEN_ADDRESS);
    require(initialized);
    uint256 _transferRate;
    uint256 _transferBase;
    uint256 _realDgxIn;
    bool _globalNoFees;
    bool _userNoFees;

    (,_transferBase, _transferRate,,_globalNoFees,) = DGXStorage(DGX_TOKEN_STORAGE).read_transfer_config();
    (,_userNoFees,) = DGXStorage(DGX_TOKEN_STORAGE).read_user_fees_configs(_user);

    _realDgxIn = _dgxIn;
    if (!_globalNoFees && !_userNoFees) {
        _realDgxIn = _realDgxIn.sub(_transferRate.mul(_dgxIn).div(_transferBase));
    }

    uint256 _dgxBalanceBeforeTransfer = ERC20(DGX_TOKEN_ADDRESS).balanceOf(address(this)).sub(_realDgxIn);
    uint256 _ldgxOut = _realDgxIn.mul(totalSupply_).div(_dgxBalanceBeforeTransfer);

    balances[_user] = balances[_user].add(_ldgxOut);
    totalSupply_ = totalSupply_.add(_ldgxOut);
    emit Transfer(address(0x0), _user, _ldgxOut);
  }

  // withdraw in terms of dgx
  function withdraw(uint _dgxOut) public {
    uint256 _ldgxToBurn = SafeMath.mul(_dgxOut, totalSupply_).div(ERC20(DGX_TOKEN_ADDRESS).balanceOf(address(this)));
    require(balances[msg.sender] >= _ldgxToBurn);
    balances[msg.sender] -= _ldgxToBurn;
    totalSupply_ -= _ldgxToBurn;
    emit Transfer(msg.sender, address(0x0), _ldgxToBurn);

    require(ERC20(DGX_TOKEN_ADDRESS).transfer(msg.sender, _dgxOut));
  }

  function dgxEquivalent()
    public
    constant
    returns (uint256 _dgxEquivalent)
  {
    uint256 _ldgxBalance = balances[msg.sender];
    _dgxEquivalent = ERC20(DGX_TOKEN_ADDRESS).balanceOf(address(this)).mul(_ldgxBalance).div(totalSupply_);
  }

  // the return value is multiplied by a factor of 10^9
  function getDgxLdgxRate()
    public
    constant
    returns (uint256 _dgxLdgx)
  {
    _dgxLdgx = totalSupply_.mul(10**9).div(ERC20(DGX_TOKEN_ADDRESS).balanceOf(address(this)));
  }
}
