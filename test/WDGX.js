const a = require('awaiting');

const {
  deployLibraries,
  deployTestData,
  getUserAccounts,
  mintSomeTokens,
} = require('./setup.js');

const {
  randomAddress,
} = require('@digix/helpers/lib/helpers');

const bN = web3.toBigNumber;

contract('Wrapper DGX', function (accounts) {
  let libs;
  let addressOf;
  let contracts = {};

  before(async function () {
    libs = await deployLibraries();
    addressOf = getUserAccounts(accounts);
    await deployTestData(libs, addressOf, contracts);
    console.log('token storage : ', contracts.dgxStorage.address);
    console.log('token : ', contracts.dgx.address);
    console.log('wrapper token : ', contracts.wrapperDgxToken.address);
    await mintSomeTokens(contracts, addressOf, bN);
  });

  describe('firstDeposit', function () {
    // initial deposit of 1DGX
    const initialDeposit = bN(1e9);
    it('Valid first deposit: successful', async function () {
      await contracts.dgx.approve(contracts.wrapperDgxToken.address, initialDeposit, { from: addressOf.testUser1 });
      await contracts.wrapperDgxToken.firstDeposit(initialDeposit, { from: addressOf.testUser1 });
      console.log('dgx:wdgx = ', await contracts.wrapperDgxToken.getDgxWdgxRate.call());
      console.log('balance of dgx in contract: ', await contracts.dgx.balanceOf.call(contracts.wrapperDgxToken.address));
      console.log('wdgx supply : ', await contracts.wrapperDgxToken.totalSupply.call());
    });
    it('[re-initialize]: revert', async function () {
      await contracts.dgx.approve(contracts.wrapperDgxToken.address, initialDeposit, { from: addressOf.testUser1 });
      assert(await a.failure(contracts.wrapperDgxToken.firstDeposit(
        initialDeposit,
        { from: addressOf.testUser1 },
      )));
    });
  });
});
