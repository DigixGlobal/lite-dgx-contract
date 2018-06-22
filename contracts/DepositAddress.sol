pragma solidity ^0.4.23;

import './LDGX.sol';

contract DepositAddress {

    address public DGX_TOKEN_ADDRESS;
    address public LDGX_TOKEN_ADDRESS;
    address public EXCHANGE_LDGX_WALLET;
    address public owner;

    modifier if_owner() {
        require(owner == msg.sender);
        _;
    }

    constructor(address _dgx_token_address, address _ldgx_token_address, address _exchange_ldgx_wallet) public {
        DGX_TOKEN_ADDRESS = _dgx_token_address;
        LDGX_TOKEN_ADDRESS = _ldgx_token_address;
        EXCHANGE_LDGX_WALLET = _exchange_ldgx_wallet;
        owner = msg.sender;
    }

    function sweep() public if_owner() returns (bool _success) {
       uint256 _balance = ERC20(DGX_TOKEN_ADDRESS).balanceOf(address(this));
       require(LDGX(LDGX_TOKEN_ADDRESS).tokenFallback(EXCHANGE_LDGX_WALLET, _balance, 0x0));
    }
}
