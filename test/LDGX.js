const a = require('awaiting');

const LDGX = artifacts.require('./LDGX.sol');

const {
  deployLibraries,
  deployTestData,
  getUserAccounts,
  mintSomeTokens,
} = require('./setup');

const {
  calculateFees,
  feesConfigs,
} = require('./feesHelpers');

const {
  randomAddress,
  randomBigNumber,
  initialMinimumPurchase,
  indexRange,
} = require('@digix/helpers/lib/helpers');

const bN = web3.toBigNumber;

contract('Lite DGX', function (accounts) {
  let libs;
  let addressOf;
  let contracts = {};

  before(async function () {
    libs = await deployLibraries();
    addressOf = getUserAccounts(accounts);
    await deployTestData(libs, addressOf, contracts);
    await mintSomeTokens(contracts, addressOf, bN);
  });

  // force demurrage for nDays number of days
  // basically to skew the dgx:ldgx ratio
  const daysCorrection = async function (nDays, user) {
    // set last payment to nDays ago
    await contracts.dgx.modifyLastPaymentDate(user, ((nDays * 24 * 60) + 1));
  };

  describe('DGX Token', function () {
    it('transfer', async function () {
      // initial balances
      const initialBalance1 = await contracts.dgx.balanceOf.call(addressOf.testUser1);
      const initialBalance2 = await contracts.dgx.balanceOf.call(addressOf.testUser2);
      const estimatedFees = calculateFees(bN(1e9), 'transfer');
      // transfer 1 dgx from testUser1 to testUser2
      assert.deepEqual(await contracts.dgx.transfer.call(
        addressOf.testUser2,
        bN(1e9),
        { from: addressOf.testUser1 },
      ), true);
      await contracts.dgx.transfer(addressOf.testUser2, bN(1e9), { from: addressOf.testUser1 });
      assert.deepEqual(await contracts.dgx.balanceOf.call(addressOf.testUser1), initialBalance1.minus(bN(1e9)));
      assert.deepEqual(await contracts.dgx.balanceOf.call(addressOf.testUser2), initialBalance2.plus(bN(1e9)).minus(estimatedFees));
    });
    it('transferFrom', async function () {
      // initial balances
      const initialBalance1 = await contracts.dgx.balanceOf.call(addressOf.testUser1);
      const initialBalance2 = await contracts.dgx.balanceOf.call(addressOf.testUser2);
      const estimatedFees = calculateFees(bN(1e9), 'transfer');
      // approve spending
      assert.deepEqual(await contracts.dgx.approve.call(
        addressOf.testUser2,
        bN(1e9),
        { from: addressOf.testUser1 },
      ), true);
      await contracts.dgx.approve(addressOf.testUser2, bN(1e9), { from: addressOf.testUser1 });
      assert.deepEqual(await contracts.dgx.allowance.call(addressOf.testUser1, addressOf.testUser2), bN(1e9));
      // try to spend
      assert.deepEqual(await contracts.dgx.transferFrom.call(
        addressOf.testUser1,
        addressOf.testUser2,
        bN(1e9),
        { from: addressOf.testUser2 },
      ), true);
      await contracts.dgx.transferFrom(addressOf.testUser1, addressOf.testUser2, bN(1e9), { from: addressOf.testUser2 });
      assert.deepEqual(await contracts.dgx.balanceOf.call(addressOf.testUser1), initialBalance1.minus(bN(1e9)));
      assert.deepEqual(await contracts.dgx.balanceOf.call(addressOf.testUser2), initialBalance2.plus(bN(1e9)).minus(estimatedFees));
    });
  });

  describe('firstDeposit', function () {
    const initialDeposit = bN(1e9);
    it('Valid first deposit: successful', async function () {
      await contracts.dgx.approve(contracts.liteDgx.address, initialDeposit, { from: addressOf.testUser1 });
      await contracts.liteDgx.firstDeposit(initialDeposit, { from: addressOf.testUser1 });
      console.log('dgx:ldgx = ', await contracts.liteDgx.getDgxLdgxRate.call());
      console.log('balance of dgx in contract: ', await contracts.dgx.balanceOf.call(contracts.liteDgx.address));
      console.log('ldgx supply : ', await contracts.liteDgx.totalSupply.call());
    });
    it('[re-initialize]: revert', async function () {
      await contracts.dgx.approve(contracts.liteDgx.address, initialDeposit, { from: addressOf.testUser1 });
      assert(await a.failure(contracts.liteDgx.firstDeposit(
        initialDeposit,
        { from: addressOf.testUser1 },
      )));
    });
  });

  describe('deposit DGX', function () {
    it('Valid deposit: successful', async function () {
      const deposit = bN(2e9); // 2DGX
      await contracts.dgx.transferAndCall(contracts.liteDgx.address, deposit, '', { from: addressOf.testUser1 });

      console.log('dgx:ldgx = ', await contracts.liteDgx.getDgxLdgxRate.call());
      console.log('balance of dgx in contract: ', await contracts.dgx.balanceOf.call(contracts.liteDgx.address));
      console.log('ldgx supply : ', await contracts.liteDgx.totalSupply.call());
      console.log('balance of ldgx of user: ', await contracts.liteDgx.balanceOf.call(addressOf.testUser1));
    });
    it('[not initialized]: revert', async function () {
      const dummyLdgx = await LDGX.new(contracts.dgx.address, contracts.dgxStorage.address);
      assert.deepEqual(await dummyLdgx.initialized.call(), false);
      const deposit = bN(2e9);
      assert(await a.failure(contracts.dgx.transferAndCall(
        dummyLdgx.address,
        deposit,
        '',
        { from: addressOf.testUser1 },
      )));
    });
    it('[when dgx:ldgx is not 1 (due to demurrage fee for ldgx contract)]', async function () {
      // before the transaction, both are the same
      const wrapperDgxBalanceBefore = await contracts.dgx.balanceOf.call(contracts.liteDgx.address);
      const wrapperDgxSupplyBefore = await contracts.liteDgx.totalSupply.call();
      assert.deepEqual(wrapperDgxBalanceBefore, wrapperDgxSupplyBefore);

      // set last payment date 5 days ago, and find the expected demurraged balance
      // this will be the balance when the tokenFallback is eventually called
      await daysCorrection(5, contracts.liteDgx.address);
      const expectedDemurrageFor5Days = calculateFees(wrapperDgxBalanceBefore.times(bN(5)), 'demurrage'); // 5 days correction
      const expectedDemurragedBalance = wrapperDgxBalanceBefore.minus(expectedDemurrageFor5Days);

      // make dummy deposit
      const transferAmount = bN(1e9);
      await contracts.dgx.transferAndCall(
        contracts.liteDgx.address,
        transferAmount,
        '',
        { from: addressOf.testUser1 },
      );
      const expectedTransferFees = calculateFees(bN(1e9), 'transfer');

      // do the expected calculation in js, find expected balance and supply
      const wrapperDgxSupplyAdded = (transferAmount.minus(expectedTransferFees)).times(wrapperDgxSupplyBefore).dividedToIntegerBy(expectedDemurragedBalance);
      const wrapperDgxSupplyAfterShouldBe = wrapperDgxSupplyBefore.plus(wrapperDgxSupplyAdded);

      // after calculation contract side, these are the balance and supply
      const wrapperDgxBalanceNow = await contracts.dgx.balanceOf.call(contracts.liteDgx.address);
      const wrapperDgxSupplyNow = await contracts.liteDgx.totalSupply.call();

      assert.deepEqual(wrapperDgxBalanceNow, expectedDemurragedBalance.plus(transferAmount).minus(expectedTransferFees));
      assert.deepEqual(wrapperDgxSupplyNow, wrapperDgxSupplyAfterShouldBe);
    });
    it('[when transfer fees is zero for user]: verify', async function () {
      // exempt testRichKycUser from transfer fees
      await contracts.dgx.updateUserFeesConfigs(addressOf.testUser1, false, true, { from: addressOf.feesadmin });

      // before the transaction
      const wrapperDgxBalanceBefore = await contracts.dgx.balanceOf.call(contracts.liteDgx.address);
      const wrapperDgxSupplyBefore = await contracts.liteDgx.totalSupply.call();

      // set last payment date 5 days ago, and find the expected demurraged balance
      // this will be the balance when the tokenFallback is eventually called
      await daysCorrection(3, contracts.liteDgx.address);
      const expectedDemurrageFor3Days = calculateFees(wrapperDgxBalanceBefore.times(bN(3)), 'demurrage'); // 3 days correction
      const expectedDemurragedBalance = wrapperDgxBalanceBefore.minus(expectedDemurrageFor3Days);

      // make dummy deposit
      const transferAmount = bN(1e9);
      await contracts.dgx.transferAndCall(
        contracts.liteDgx.address,
        transferAmount,
        '',
        { from: addressOf.testUser1 },
      );
      const expectedTransferFees = bN(0); // since we have exempted user from transfer fees

      // do the expected calculation in js, find expected balance and supply
      const wrapperDgxSupplyAdded = (transferAmount.minus(expectedTransferFees)).times(wrapperDgxSupplyBefore).dividedToIntegerBy(expectedDemurragedBalance);
      const wrapperDgxSupplyAfterShouldBe = wrapperDgxSupplyBefore.plus(wrapperDgxSupplyAdded);

      // after calculation contract side, these are the balance and supply
      const wrapperDgxBalanceNow = await contracts.dgx.balanceOf.call(contracts.liteDgx.address);
      const wrapperDgxSupplyNow = await contracts.liteDgx.totalSupply.call();

      // assertions
      assert.deepEqual(wrapperDgxBalanceNow, expectedDemurragedBalance.plus(transferAmount).minus(expectedTransferFees));
      assert.deepEqual(wrapperDgxSupplyNow, wrapperDgxSupplyAfterShouldBe);
    });
  });

  describe('withdraw DGX', function () {
    it('[withdraw more than ldgx balance]: revert', async function () {
      assert(await a.failure(contracts.liteDgx.withdraw.call(
        bN(10 * (10 ** 18)),
        { from: addressOf.testUser1 },
      )));
    });
    it('Valid withdrawal with transfer fees and demurrage: successful', async function () {
      // initial balances
      const userDgxBalanceBefore = await contracts.dgx.balanceOf.call(addressOf.testUser1);
      const userLdgxBalanceBefore = await contracts.liteDgx.balanceOf.call(addressOf.testUser1);
      const wrapperDgxBalanceBefore = await contracts.dgx.balanceOf.call(contracts.liteDgx.address);
      const wrapperDgxSupplyBefore = await contracts.liteDgx.totalSupply.call();

      // set last payment date to be 1 day earlier
      // demurrage will be cut on both sides then
      await daysCorrection(1, addressOf.testUser1);
      await daysCorrection(1, contracts.liteDgx.address);

      // expected fees
      const withdrawAmount = bN(1e9); // 1DGX
      const expectedTransferFees = calculateFees(withdrawAmount, 'transfer');
      const demurragedUserBalance = userDgxBalanceBefore.minus(calculateFees(userDgxBalanceBefore, 'demurrage'));
      const demurragedWrapperBalance = wrapperDgxBalanceBefore.minus(calculateFees(wrapperDgxBalanceBefore, 'demurrage'));

      // make the withdraw
      await contracts.liteDgx.withdraw(withdrawAmount, { from: addressOf.testUser1 });

      // expected calculation values
      const ldgxToBurn = withdrawAmount.times(wrapperDgxSupplyBefore).dividedToIntegerBy(demurragedWrapperBalance);
      const userLdgxBalanceAfter = userLdgxBalanceBefore.minus(ldgxToBurn);
      const wrapperDgxBalanceAfter = demurragedWrapperBalance.minus(withdrawAmount);
      const userDgxBalanceAfter = demurragedUserBalance.plus(withdrawAmount).minus(expectedTransferFees);
      const wrapperDgxSupplyAfter = wrapperDgxSupplyBefore.minus(ldgxToBurn);

      // assertions
      assert.deepEqual(await contracts.dgx.balanceOf.call(addressOf.testUser1), userDgxBalanceAfter);
      assert.deepEqual(await contracts.dgx.balanceOf.call(contracts.liteDgx.address), wrapperDgxBalanceAfter);
      assert.deepEqual(await contracts.liteDgx.balanceOf.call(addressOf.testUser1), userLdgxBalanceAfter);
      assert.deepEqual(await contracts.liteDgx.totalSupply.call(), wrapperDgxSupplyAfter);
    });
  });

  describe('dgxEquivalent', function () {
    it('[dgxEquivalent+1 cannot be withdrawn]', async function () {
      const dgx = await contracts.liteDgx.dgxEquivalent.call({ from: addressOf.testUser1 });
      assert(await a.failure(contracts.liteDgx.withdraw(dgx.plus(bN(1))), { from: addressOf.testUser1 }));
    });
    it('[dgxEquivalent can be withdrawn]', async function () {
      const dgx = await contracts.liteDgx.dgxEquivalent.call({ from: addressOf.testUser1 });
      assert.ok(await contracts.liteDgx.withdraw(dgx, { from: addressOf.testUser1 }));
    });
  });

  describe('scenario testing', function () {
    let wrapperDgxContract;
    before(async function () {
      wrapperDgxContract = await LDGX.new(contracts.dgx.address, contracts.dgxStorage.address);
      const firstDepositAmount = bN(5e9);
      await contracts.dgx.approve(wrapperDgxContract.address, firstDepositAmount, { from: addressOf.testUser1 });
      await wrapperDgxContract.firstDeposit(firstDepositAmount, { from: addressOf.testUser1 });
      await contracts.dgx.updateUserFeesConfigs(addressOf.testUser1, false, false, { from: addressOf.feesadmin });
    });
    it('[checking rounding errors over 1 month]', async function () {
      const minTransferAmount = bN(initialMinimumPurchase);
      const minTransferFees = calculateFees(minTransferAmount, 'transfer');
      let totalLdgxOutShouldBe = (await wrapperDgxContract.totalSupply.call()).toNumber();
      let demurragedBalance = 0;
      for (const d of indexRange(0, 30)) {
        await daysCorrection(1, wrapperDgxContract.address);
        demurragedBalance = await contracts.dgx.balanceOf.call(wrapperDgxContract.address);
        await contracts.dgx.transferAndCall(wrapperDgxContract.address, minTransferAmount, '', { from: addressOf.testUser1 });
        const addition = ((minTransferAmount.toNumber() - minTransferFees.toNumber()) * totalLdgxOutShouldBe) / demurragedBalance.toNumber();
        totalLdgxOutShouldBe += addition;
        // console.log('done : ', d);
      }
      console.log('should be : ', totalLdgxOutShouldBe);
      const totalLdgxOutActual = await wrapperDgxContract.totalSupply.call();
      console.log('is        : ', totalLdgxOutActual.toNumber());
      console.log('error for 1 month : ', ((totalLdgxOutShouldBe - totalLdgxOutActual.toNumber()) * 100.0) / totalLdgxOutShouldBe, ' %');
    });
    it('[checking rounding errors over 6 month]', async function () {
      const minTransferAmount = bN(initialMinimumPurchase);
      const minTransferFees = calculateFees(minTransferAmount, 'transfer');
      let totalLdgxOutShouldBe = (await wrapperDgxContract.totalSupply.call()).toNumber();
      let demurragedBalance = 0;
      for (const d of indexRange(0, 180)) {
        await daysCorrection(1, wrapperDgxContract.address);
        demurragedBalance = await contracts.dgx.balanceOf.call(wrapperDgxContract.address);
        await contracts.dgx.transferAndCall(wrapperDgxContract.address, minTransferAmount, '', { from: addressOf.testUser1 });
        const addition = ((minTransferAmount.toNumber() - minTransferFees.toNumber()) * totalLdgxOutShouldBe) / demurragedBalance.toNumber();
        totalLdgxOutShouldBe += addition;
        // console.log('done : ', d);
      }
      console.log('should be : ', totalLdgxOutShouldBe);
      const totalLdgxOutActual = await wrapperDgxContract.totalSupply.call();
      console.log('is        : ', totalLdgxOutActual.toNumber());
      console.log('error for 6 months : ', ((totalLdgxOutShouldBe - totalLdgxOutActual.toNumber()) * 100.0) / totalLdgxOutShouldBe, ' %');
    });
    it('[how does holding 1 DGX differ from holding LDGX in terms of demurrage paid (1 month | 1 tx per day)]', async function () {
      // addressOf.testUser2 converts DGX to LDGX
      // after d days what would have been the demurrage paid in DGX
      // after d days what is user getting back by withdrawing from LDGX

      const userDgxBalanceBefore = await contracts.dgx.balanceOf.call(addressOf.testUser2);
      await contracts.dgx.transferAndCall(wrapperDgxContract.address, bN(1e9), '', { from: addressOf.testUser2 });
      const minTransferAmount = bN(initialMinimumPurchase);

      // dummy transactions for a month
      for (const d of indexRange(0, 30)) {
        await daysCorrection(1, wrapperDgxContract.address);
        await contracts.dgx.transferAndCall(wrapperDgxContract.address, minTransferAmount, '', { from: addressOf.testUser1 });
      }

      // kycUsers[0] withdraws
      const dgxEquivalent = await wrapperDgxContract.dgxEquivalent.call({ from: addressOf.testUser2 });
      await wrapperDgxContract.withdraw(dgxEquivalent, { from: addressOf.testUser2 });
      const userDgxBalanceAfter = await contracts.dgx.balanceOf.call(addressOf.testUser2);

      // simply holding 1 DGX for 1 month would have cost demurrage of
      const demurrageForOneMonth = calculateFees(bN(1e9).times(bN(30)), 'demurrage');
      console.log('holding demurrage : ', demurrageForOneMonth.toNumber());
      console.log('holding LDGX paid : ', userDgxBalanceBefore.minus(userDgxBalanceAfter).toNumber());
    });
    it('[how does holding 1 DGX differ from holding LDGX in terms of demurrage paid (1 month | 2 tx per day)]', async function () {
      // addressOf.testUser2 converts DGX to LDGX
      // after d days what would have been the demurrage paid in DGX
      // after d days what is user getting back by withdrawing from LDGX
      const userDgxBalanceBefore = await contracts.dgx.balanceOf.call(addressOf.testUser2);
      await contracts.dgx.transferAndCall(wrapperDgxContract.address, bN(1e9), '', { from: addressOf.testUser2 });
      const minTransferAmount = bN(initialMinimumPurchase);

      // dummy transactions for a month
      for (const d of indexRange(0, 30)) {
        await daysCorrection(1, wrapperDgxContract.address);
        await contracts.dgx.transferAndCall(wrapperDgxContract.address, minTransferAmount, '', { from: addressOf.testUser1 });
        await contracts.dgx.transferAndCall(wrapperDgxContract.address, minTransferAmount, '', { from: addressOf.testUser1 });
      }

      // kycUsers[0] withdraws
      const dgxEquivalent = await wrapperDgxContract.dgxEquivalent.call({ from: addressOf.testUser2 });
      await wrapperDgxContract.withdraw(dgxEquivalent, { from: addressOf.testUser2 });
      const userDgxBalanceAfter = await contracts.dgx.balanceOf.call(addressOf.testUser2);

      // simply holding 1 DGX for 1 month would have cost demurrage of
      const demurrageForOneMonth = calculateFees(bN(1e9).times(bN(30)), 'demurrage');
      console.log('holding demurrage : ', demurrageForOneMonth.toNumber());
      console.log('holding LDGX paid : ', userDgxBalanceBefore.minus(userDgxBalanceAfter).toNumber());
    });
    it('[how does holding ~300 DGX differ from holding LDGX in terms of demurrage paid (1 month | 1 tx per day)]', async function () {
      // addressOf.testUser2 converts DGX to LDGX
      // after d days what would have been the demurrage paid in DGX
      // after d days what is user getting back by withdrawing from LDGX
      const userDgxBalanceBefore = await contracts.dgx.balanceOf.call(addressOf.testUser2);
      // console.log('balance is : ', userDgxBalanceBefore.toNumber());
      await contracts.dgx.transferAndCall(wrapperDgxContract.address, userDgxBalanceBefore, '', { from: addressOf.testUser2 });
      const minTransferAmount = bN(initialMinimumPurchase);

      // dummy transactions for a month
      for (const d of indexRange(0, 2)) {
        await daysCorrection(1, wrapperDgxContract.address);
        await contracts.dgx.transferAndCall(wrapperDgxContract.address, minTransferAmount, '', { from: addressOf.testUser1 });
        await contracts.dgx.transferAndCall(wrapperDgxContract.address, minTransferAmount, '', { from: addressOf.testUser1 });
      }

      // kycUsers[0] withdraws
      const dgxEquivalent = await wrapperDgxContract.dgxEquivalent.call({ from: addressOf.testUser2 });
      await wrapperDgxContract.withdraw(dgxEquivalent, { from: addressOf.testUser2 });
      const userDgxBalanceAfter = await contracts.dgx.balanceOf.call(addressOf.testUser2);

      // simply holding 1 DGX for 1 month would have cost demurrage of
      const demurrageForOneMonth = calculateFees(userDgxBalanceBefore.times(bN(2)), 'demurrage');
      console.log('holding demurrage : ', demurrageForOneMonth.toNumber());
      console.log('holding LDGX paid : ', userDgxBalanceBefore.minus(userDgxBalanceAfter).toNumber());
    });
    it('[convert to ldgx when dgx:ldgx != 1, and back to dgx]', async function () {
      const minTransferAmount = bN(initialMinimumPurchase);
      // dummy transactions for a month
      for (const d of indexRange(0, 30)) {
        await daysCorrection(1, wrapperDgxContract.address);
        await contracts.dgx.transferAndCall(wrapperDgxContract.address, minTransferAmount, '', { from: addressOf.testUser1 });
      }

      const userDgxBalanceBefore = await contracts.dgx.balanceOf.call(addressOf.testUser2);
      await contracts.dgx.transferAndCall(wrapperDgxContract.address, userDgxBalanceBefore, '', { from: addressOf.testUser2 });

      // dummy transactions for a month
      for (const d of indexRange(0, 30)) {
        await daysCorrection(1, wrapperDgxContract.address);
        await contracts.dgx.transferAndCall(wrapperDgxContract.address, minTransferAmount, '', { from: addressOf.testUser1 });
      }

      // kycUsers[0] withdraws
      const dgxEquivalent = await wrapperDgxContract.dgxEquivalent.call({ from: addressOf.testUser2 });
      await wrapperDgxContract.withdraw(dgxEquivalent, { from: addressOf.testUser2 });
      const userDgxBalanceAfter = await contracts.dgx.balanceOf.call(addressOf.testUser2);

      // simply holding 1 DGX for 1 month would have cost demurrage of
      const demurrageForOneMonth = calculateFees(userDgxBalanceBefore.times(bN(2)), 'demurrage');
      console.log('holding demurrage : ', demurrageForOneMonth.toNumber());
      console.log('holding LDGX paid : ', userDgxBalanceBefore.minus(userDgxBalanceAfter).toNumber());
    });
    it('[sending back and forth between another account versus wrapper contract]', async function () {
      // the Wrapper should just behave as another Address from the point of view of DGX
      // everybody pays transfer fees
      await contracts.dgx.updateUserFeesConfigs(addressOf.testUser2, false, false, { from: addressOf.feesadmin });
      await contracts.dgx.updateUserFeesConfigs(addressOf.testUser1, false, false, { from: addressOf.feesadmin });
      await contracts.dgx.updateUserFeesConfigs(wrapperDgxContract.address, false, false, { from: addressOf.feesadmin });
      // send to ldgx contract and withdraw
      const balance1 = await contracts.dgx.balanceOf.call(addressOf.testUser2);
      const fixedAmount = randomBigNumber(bN, balance1);
      await contracts.dgx.transferAndCall(wrapperDgxContract.address, fixedAmount, '', { from: addressOf.testUser2 });
      await wrapperDgxContract.withdraw(await wrapperDgxContract.dgxEquivalent.call({ from: addressOf.testUser2 }), { from: addressOf.testUser2 });
      const balance2 = await contracts.dgx.balanceOf.call(addressOf.testUser2);
      const diff1 = balance1.minus(balance2);

      // send to account and get back
      await contracts.dgx.transfer(addressOf.testUser1, fixedAmount, { from: addressOf.testUser2 });
      const transferFees = calculateFees(fixedAmount, 'transfer');
      await contracts.dgx.transfer(addressOf.testUser2, fixedAmount.minus(transferFees), { from: addressOf.testUser1 });
      const balance3 = await contracts.dgx.balanceOf.call(addressOf.testUser2);
      const diff2 = balance2.minus(balance3);

      // difference should be the same
      console.log('diff1 : ', diff1.toNumber());
      console.log('diff2 : ', diff2.toNumber());
      assert.deepEqual(diff1, diff2);
    });
    it('[how does holding DGX differ from holding LDGX in terms of demurrage paid (1 month | 10 tx per day), turning off transfer fees for LDGX contract]', async function () {
      // addressOf.testUser2 converts DGX to LDGX
      // after d days what would have been the demurrage paid in DGX
      // after d days what is user getting back by withdrawing from LDGX
      await contracts.dgx.updateUserFeesConfigs(wrapperDgxContract.address, false, true, { from: addressOf.feesadmin });
      await contracts.dgx.updateUserFeesConfigs(addressOf.testUser2, false, true, { from: addressOf.feesadmin });

      const userDgxBalanceBefore = await contracts.dgx.balanceOf.call(addressOf.testUser2);
      await contracts.dgx.transferAndCall(wrapperDgxContract.address, bN(1e9), '', { from: addressOf.testUser2 });
      const minTransferAmount = bN(initialMinimumPurchase);

      // dummy transactions for a month
      for (const d of indexRange(0, 30)) {
        await daysCorrection(1, wrapperDgxContract.address);
        await contracts.dgx.transferAndCall(wrapperDgxContract.address, minTransferAmount, '', { from: addressOf.testUser1 });
        await contracts.dgx.transferAndCall(wrapperDgxContract.address, minTransferAmount, '', { from: addressOf.testUser1 });
        await contracts.dgx.transferAndCall(wrapperDgxContract.address, minTransferAmount, '', { from: addressOf.testUser1 });
        await contracts.dgx.transferAndCall(wrapperDgxContract.address, minTransferAmount, '', { from: addressOf.testUser1 });
        await contracts.dgx.transferAndCall(wrapperDgxContract.address, minTransferAmount, '', { from: addressOf.testUser1 });
        await contracts.dgx.transferAndCall(wrapperDgxContract.address, minTransferAmount, '', { from: addressOf.testUser1 });
        await contracts.dgx.transferAndCall(wrapperDgxContract.address, minTransferAmount, '', { from: addressOf.testUser1 });
        await contracts.dgx.transferAndCall(wrapperDgxContract.address, minTransferAmount, '', { from: addressOf.testUser1 });
        await contracts.dgx.transferAndCall(wrapperDgxContract.address, minTransferAmount, '', { from: addressOf.testUser1 });
        await contracts.dgx.transferAndCall(wrapperDgxContract.address, minTransferAmount, '', { from: addressOf.testUser1 });
      }

      // kycUsers[0] withdraws
      const dgxEquivalent = await wrapperDgxContract.dgxEquivalent.call({ from: addressOf.testUser2 });
      await wrapperDgxContract.withdraw(dgxEquivalent, { from: addressOf.testUser2 });
      const userDgxBalanceAfter = await contracts.dgx.balanceOf.call(addressOf.testUser2);

      // simply holding 1 DGX for 1 month would have cost demurrage of
      const demurrageForOneMonth = calculateFees(bN(1e9).times(bN(30)), 'demurrage');
      const demurrageCompound = 1e9 - (1e9 * ((1 - (feesConfigs.demurrageRate / feesConfigs.demurrageBase)) ** 30));
      console.log('holding demurrage (simple) : ', demurrageForOneMonth.toNumber());
      console.log('holding demurrage (compound) : ', demurrageCompound);
      console.log('holding LDGX paid : ', userDgxBalanceBefore.minus(userDgxBalanceAfter).toNumber());
    });
  });
});
