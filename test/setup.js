const MathUtils = artifacts.require('./MathUtils.sol');
const Types = artifacts.require('./Types.sol');

const DGXStorage = artifacts.require('./DGXStorage.sol');
const DGX = artifacts.require('./DGX.sol');
const WDGX = artifacts.require('./WDGX.sol');

const deployLibraries = async function () {
  const libs = {};
  libs.mathUtils = await MathUtils.new();
  libs.types = await Types.new();
  return libs;
};

const deployTestData = async function (libs, addressOf, contracts) {
  // console.log('linking');
  await DGXStorage.link('Types', libs.types.address);
  await DGXStorage.link('MathUtils', libs.mathUtils.address);
  // console.log('deploying dgx storage');
  contracts.dgxStorage = await DGXStorage.new();
  // console.log('deploying dgx interactive');
  contracts.dgx = await DGX.new(contracts.dgxStorage.address);
  // console.log('setting interactive address in storage');
  await contracts.dgxStorage.setInteractive(contracts.dgx.address);
  // console.log('deploying wrapperDgx');
  contracts.wrapperDgxToken = await WDGX.new(
    contracts.dgx.address,
    contracts.dgx.address
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
