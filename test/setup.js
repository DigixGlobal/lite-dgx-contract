const MathUtils = artifacts.require('./MathUtils.sol');
const Types = artifacts.require('./Types.sol');

const DGXStorage = artifacts.require('./DGXStorage.sol');
const DGX = artifacts.require('./DGX.sol');
const LDGX = artifacts.require('./LDGX.sol');

const deployLibraries = async function () {
  const libs = {};
  libs.mathUtils = await MathUtils.new();
  libs.types = await Types.new();
  return libs;
};

const deployTestData = async function (libs, addressOf, contracts) {
  await DGXStorage.link('Types', libs.types.address);
  await DGXStorage.link('MathUtils', libs.mathUtils.address);
  contracts.dgxStorage = await DGXStorage.new();
  contracts.dgx = await DGX.new(contracts.dgxStorage.address, addressOf.feesadmin);
  await contracts.dgxStorage.setInteractive(contracts.dgx.address);
  contracts.liteDgx = await LDGX.new(
    contracts.dgx.address,
    contracts.dgxStorage.address
  );
};

const mintSomeTokens = async function (contracts, addressOf, bN) {
  await contracts.dgx.mintDgxFor(addressOf.testUser1, bN(1000 * (10 ** 9)));
  await contracts.dgx.mintDgxFor(addressOf.testUser2, bN(1000 * (10 ** 9)));
};

const getUserAccounts = function (accounts) {
  const addressOf = {
    feesadmin: accounts[1],
    testUser1: accounts[2],
    testUser2: accounts[3]
  };
  return addressOf;
};

module.exports = {
  deployLibraries,
  deployTestData,
  getUserAccounts,
  mintSomeTokens
};
