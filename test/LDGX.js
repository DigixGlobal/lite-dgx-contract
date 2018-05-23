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
  let wrapperDgxContract;

  before(async function () {
    libs = await deployLibraries();
    addressOf = getUserAccounts(accounts);
    await deployTestData(libs, addressOf, contracts);
    wrapperDgxContract = contracts.liteDgx;
    await mintSomeTokens(contracts, addressOf, bN);
  });

  const reportLdgxDetails = async () => {
      console.log('\t\tdgx:ldgx = ', (await wrapperDgxContract.getDgxLdgxRate.call()).toNumber() / 1.0e9);
      console.log('\t\tbalance of dgx in contract: ', (await contracts.dgx.balanceOf.call(wrapperDgxContract.address)).toNumber());
      console.log('\t\tldgx total supply :         ', (await wrapperDgxContract.totalSupply.call()).toNumber());
  }

  // force demurrage for nDays number of days
  // basically to skew the dgx:ldgx ratio
  const daysCorrection = async function (nDays, user) {
    // set last payment to nDays ago
    await contracts.dgx.modifyLastPaymentDate(user, ((nDays * 24 * 60) + 1));
  };

  const timeTravelAndDepositDaily = async (dailyDepositAmount, numberOfDays) => {
      for (const d of indexRange(0, numberOfDays)) {
        await daysCorrection(1, wrapperDgxContract.address);
        await contracts.dgx.transferAndCall(wrapperDgxContract.address, dailyDepositAmount, '', { from: addressOf.testUser3 });
      }
  }

  const makeSureTransferFeesIsOn = async () => {
    await contracts.dgx.updateUserFeesConfigs(addressOf.testUser1, false, false, { from: addressOf.feesadmin });
    await contracts.dgx.updateUserFeesConfigs(addressOf.testUser2, false, false, { from: addressOf.feesadmin });
    await contracts.dgx.updateUserFeesConfigs(addressOf.testUser3, false, false, { from: addressOf.feesadmin });
    await contracts.dgx.updateUserFeesConfigs(wrapperDgxContract.address, false, false, { from: addressOf.feesadmin });
  }

  const getDgxEquilavent = async (userAddress) => {
    return (await wrapperDgxContract.balanceOf.call(userAddress)).times(
      await contracts.dgx.balanceOf.call(wrapperDgxContract.address)
    ).toNumber() / ((await wrapperDgxContract.totalSupply.call()).toNumber());
  }

  describe('Dummy DGX Token', function () {
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
      await reportLdgxDetails();
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
    it('Valid deposit: goes through', async function () {
      const deposit = bN(2e9); // 2DGX
      await contracts.dgx.transferAndCall(contracts.liteDgx.address, deposit, '', { from: addressOf.testUser1 });

      await reportLdgxDetails();
      console.log('\tbalance of ldgx of user: ', await contracts.liteDgx.balanceOf.call(addressOf.testUser1));
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
    it('[after some time, dgx:ldgx is not 1] correct amount of LDGX is minted, correct amount of DGX is received', async function () {
      // We just created the wrapper today, so amount of LDGX is exactly the same as amount of DGX in the wrapper
      const wrapperDgxBalanceBefore = await contracts.dgx.balanceOf.call(contracts.liteDgx.address);
      const ldgxTotalSupplyBefore = await contracts.liteDgx.totalSupply.call();
      assert.deepEqual(wrapperDgxBalanceBefore, ldgxTotalSupplyBefore);

      // "time-warp" for 5 days, and find the expected demurraged balance
      // this will be the balance when the tokenFallback is eventually called
      await daysCorrection(5, contracts.liteDgx.address);
      const expectedDemurrageFor5Days = calculateFees(wrapperDgxBalanceBefore.times(bN(5)), 'demurrage'); // 5 days correction
      const expectedDemurragedBalance = wrapperDgxBalanceBefore.minus(expectedDemurrageFor5Days);

      // make the deposit
      const depositAmount = bN(1e9);
      await contracts.dgx.transferAndCall(
        contracts.liteDgx.address,
        depositAmount,
        '',
        { from: addressOf.testUser1 },
      );
      const expectedTransferFees = calculateFees(depositAmount, 'transfer');

      // do the expected calculation in js, find expected balance and supply
      const ldgxTotalSupplyAdded = (depositAmount.minus(expectedTransferFees)).times(ldgxTotalSupplyBefore).dividedToIntegerBy(expectedDemurragedBalance);
      const ldgxTotalSupplyAfterShouldBe = ldgxTotalSupplyBefore.plus(ldgxTotalSupplyAdded);

      // after calculation contract side, these are the balance and supply
      const wrapperDgxBalanceNow = await contracts.dgx.balanceOf.call(contracts.liteDgx.address);
      const ldgxTotalSupplyNow = await contracts.liteDgx.totalSupply.call();

      assert.deepEqual(wrapperDgxBalanceNow, expectedDemurragedBalance.plus(depositAmount).minus(expectedTransferFees));
      assert.deepEqual(ldgxTotalSupplyNow, ldgxTotalSupplyAfterShouldBe);
    });
    it('[when transfer fees is zero for user] correct amount of LDGX is minted, correct amount of DGX is received', async function () {
      // exempt testUser1 from transfer fees
      await contracts.dgx.updateUserFeesConfigs(addressOf.testUser1, false, true, { from: addressOf.feesadmin });

      // before the transaction
      const wrapperDgxBalanceBefore = await contracts.dgx.balanceOf.call(contracts.liteDgx.address);
      const ldgxTotalSupplyBefore = await contracts.liteDgx.totalSupply.call();

      // "time-warp" for 3 days, and find the expected demurraged balance
      // this will be the balance when the tokenFallback is eventually called
      await daysCorrection(3, contracts.liteDgx.address);
      const expectedDemurrageFor3Days = calculateFees(wrapperDgxBalanceBefore.times(bN(3)), 'demurrage'); // 3 days correction
      const expectedDemurragedBalance = wrapperDgxBalanceBefore.minus(expectedDemurrageFor3Days);

      // make the deposit
      const depositAmount = bN(1e9);
      await contracts.dgx.transferAndCall(
        contracts.liteDgx.address,
        depositAmount,
        '',
        { from: addressOf.testUser1 },
      );
      const expectedTransferFees = bN(0); // since we have exempted user from transfer fees

      // do the expected calculation in js, find expected balance and supply
      const ldgxTotalSupplyAdded = (depositAmount.minus(expectedTransferFees)).times(ldgxTotalSupplyBefore).dividedToIntegerBy(expectedDemurragedBalance);
      const ldgxTotalSupplyAfterShouldBe = ldgxTotalSupplyBefore.plus(ldgxTotalSupplyAdded);

      // after calculation contract side, these are the balance and supply
      const wrapperDgxBalanceNow = await contracts.dgx.balanceOf.call(contracts.liteDgx.address);
      const ldgxTotalSupplyNow = await contracts.liteDgx.totalSupply.call();

      // assertions
      assert.deepEqual(wrapperDgxBalanceNow, expectedDemurragedBalance.plus(depositAmount).minus(expectedTransferFees));
      assert.deepEqual(ldgxTotalSupplyNow, ldgxTotalSupplyAfterShouldBe);
    });
  });

  describe('withdraw DGX', function () {
    it('[withdraw more than ldgx balance]: revert', async function () {
      assert(await a.failure(contracts.liteDgx.withdraw.call(
        bN(10 * (10 ** 18)),
        { from: addressOf.testUser1 },
      )));
    });
    it('[Valid withdrawal] correct amount of LDGX burned, correct amount of DGX withdrawn', async function () {
      // initial balances
      const userDgxBalanceBefore = await contracts.dgx.balanceOf.call(addressOf.testUser1);
      const userLdgxBalanceBefore = await contracts.liteDgx.balanceOf.call(addressOf.testUser1);
      const wrapperDgxBalanceBefore = await contracts.dgx.balanceOf.call(contracts.liteDgx.address);
      const ldgxTotalSupplyBefore = await contracts.liteDgx.totalSupply.call();

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
      const ldgxToBurn = withdrawAmount.times(ldgxTotalSupplyBefore).dividedToIntegerBy(demurragedWrapperBalance);
      const userLdgxBalanceAfter = userLdgxBalanceBefore.minus(ldgxToBurn);
      const wrapperDgxBalanceAfter = demurragedWrapperBalance.minus(withdrawAmount);
      const userDgxBalanceAfter = demurragedUserBalance.plus(withdrawAmount).minus(expectedTransferFees);
      const wrapperDgxSupplyAfter = ldgxTotalSupplyBefore.minus(ldgxToBurn);

      // assertions
      assert.deepEqual(await contracts.dgx.balanceOf.call(addressOf.testUser1), userDgxBalanceAfter);
      assert.deepEqual(await contracts.dgx.balanceOf.call(contracts.liteDgx.address), wrapperDgxBalanceAfter);
      assert.deepEqual(await contracts.liteDgx.balanceOf.call(addressOf.testUser1), userLdgxBalanceAfter);
      assert.deepEqual(await contracts.liteDgx.totalSupply.call(), wrapperDgxSupplyAfter);
    });
  });

  const setupTestWrapperContract = async () => {
    wrapperDgxContract = await LDGX.new(contracts.dgx.address, contracts.dgxStorage.address);
    const firstDepositAmount = bN(1e7);
    await contracts.dgx.approve(wrapperDgxContract.address, firstDepositAmount, { from: addressOf.testUser3 });
    await wrapperDgxContract.firstDeposit(firstDepositAmount, { from: addressOf.testUser3 });
    await makeSureTransferFeesIsOn();
  }

  describe('dgxEquivalent', function () {
    before(async () => {
      await setupTestWrapperContract();
      await timeTravelAndDepositDaily(bN(1e7), 30);
    });
    it('[dgxEquivalent+1 cannot be withdrawn]', async function () {
      const dgx = await contracts.liteDgx.dgxEquivalent.call({ from: addressOf.testUser1 });
      assert(await a.failure(contracts.liteDgx.withdraw(dgx.plus(bN(1))), { from: addressOf.testUser1 }));
    });
    it('[dgxEquivalent can be withdrawn]', async function () {
      const dgx = await contracts.liteDgx.dgxEquivalent.call({ from: addressOf.testUser1 });
      assert.ok(await contracts.liteDgx.withdraw(dgx, { from: addressOf.testUser1 }));
    });
  });

  describe('Scenarios testing', function () {
    beforeEach(setupTestWrapperContract);
    it('[checking rounding errors for 100DGX daily deposits in 1 month]', async function () {
      const dailyDepositAmount = bN(100e9);
      const dailyTransferFees = calculateFees(dailyDepositAmount, 'transfer');
      let totalLdgxMintedExpected = (await wrapperDgxContract.totalSupply.call()).toNumber();
      let demurragedBalance = 0;

      for (const d of indexRange(0, 30)) {
        await daysCorrection(1, wrapperDgxContract.address);
        demurragedBalance = await contracts.dgx.balanceOf.call(wrapperDgxContract.address);
        await contracts.dgx.transferAndCall(wrapperDgxContract.address, dailyDepositAmount, '', { from: addressOf.testUser1 });
        const addition = ((dailyDepositAmount.toNumber() - dailyTransferFees.toNumber()) * totalLdgxMintedExpected) / demurragedBalance.toNumber();
        totalLdgxMintedExpected += addition;
      }
      console.log('\tshould be : ', totalLdgxMintedExpected);
      const totalLdgxOutActual = await wrapperDgxContract.totalSupply.call();
      console.log('\tis        : ', totalLdgxOutActual.toNumber());
      console.log('\terror for 1 month : ', ((totalLdgxMintedExpected - totalLdgxOutActual.toNumber()) * 100.0) / totalLdgxMintedExpected, ' %');
    });
    it('[checking rounding errors for 100DGX daily deposits over 6 month]', async function () {
      const dailyDepositAmount = bN(100e9);
      const dailyTransferFees = calculateFees(dailyDepositAmount, 'transfer');
      let totalLdgxMintedExpected = (await wrapperDgxContract.totalSupply.call()).toNumber();
      let demurragedBalance = 0;

      for (const d of indexRange(0, 180)) {
        await daysCorrection(1, wrapperDgxContract.address);
        demurragedBalance = await contracts.dgx.balanceOf.call(wrapperDgxContract.address);
        await contracts.dgx.transferAndCall(wrapperDgxContract.address, dailyDepositAmount, '', { from: addressOf.testUser1 });
        const addition = ((dailyDepositAmount.toNumber() - dailyTransferFees.toNumber()) * totalLdgxMintedExpected) / demurragedBalance.toNumber();
        totalLdgxMintedExpected += addition;
      }

      console.log('\tshould be : ', totalLdgxMintedExpected);
      const totalLdgxOutActual = await wrapperDgxContract.totalSupply.call();
      console.log('\tis        : ', totalLdgxOutActual.toNumber());
      console.log('\terror for 6 months : ', ((totalLdgxMintedExpected - totalLdgxOutActual.toNumber()) * 100.0) / totalLdgxMintedExpected, ' %');
    });



    it('[Sending back and forth between another account versus wrapper contract] the amount of DGX received in the end should be the same', async function () {
      await timeTravelAndDepositDaily(bN(1e7), 30); // bootstrap the wrapper contract for 30 days;

      // send to ldgx contract and withdraw

      const initialUserBalance = await contracts.dgx.balanceOf.call(addressOf.testUser2);
      const fixedAmount = randomBigNumber(bN, initialUserBalance);
      await contracts.dgx.transferAndCall(wrapperDgxContract.address, fixedAmount, '', { from: addressOf.testUser2 });

      const dgxEquivalent = bN(await getDgxEquilavent(addressOf.testUser2));

      await wrapperDgxContract.withdraw(dgxEquivalent, { from: addressOf.testUser2 });

      const balanceAfterInteractingWithWrapper = await contracts.dgx.balanceOf.call(addressOf.testUser2);
      const diffForUsingWrapperContract = initialUserBalance.minus(balanceAfterInteractingWithWrapper);

      // send to account and get back
      await contracts.dgx.transfer(addressOf.testUser1, fixedAmount, { from: addressOf.testUser2 });
      const transferFees = calculateFees(fixedAmount, 'transfer');
      // const transferFees = bN(0);
      await contracts.dgx.transfer(addressOf.testUser2, fixedAmount.minus(transferFees), { from: addressOf.testUser1 });
      const balanceAfterTransferToAnotherAccount = await contracts.dgx.balanceOf.call(addressOf.testUser2);
      const diffForTransferingToAnotherAccount = balanceAfterInteractingWithWrapper.minus(balanceAfterTransferToAnotherAccount);

      // difference should be the same
      console.log('\tdiffForUsingWrapperContract :        ', diffForUsingWrapperContract.toNumber());
      console.log('\tdiffForTransferingToAnotherAccount : ', diffForTransferingToAnotherAccount.toNumber());
      const percentageDiff = (diffForUsingWrapperContract.toNumber() - diffForTransferingToAnotherAccount.toNumber()) /
        diffForUsingWrapperContract.toNumber() * 100;

      console.log('\t\t% diff (due to rounding errors) = ', percentageDiff);
      assert.deepEqual(percentageDiff < 0.00001, true);
    });

    it('[Sending DGX to another account and back after 30days VS depositing and withdrawing DGX from wrapper contract after 30 days] Demurrage deducted should be the same', async function () {
      await timeTravelAndDepositDaily(bN(100e9), 30); // bootstrap the wrapper contract for 30 days;

      // send to ldgx contract and withdraw
      const initialUserBalance = await contracts.dgx.balanceOf.call(addressOf.testUser2);
      const fixedAmount = randomBigNumber(bN, initialUserBalance);
      await contracts.dgx.transferAndCall(wrapperDgxContract.address, fixedAmount, '', { from: addressOf.testUser2 });

      const minTransferAmount = bN(initialMinimumPurchase);
      // dummy transactions for a month
      await timeTravelAndDepositDaily(minTransferAmount, 30)

      await wrapperDgxContract.withdraw(await wrapperDgxContract.dgxEquivalent.call({ from: addressOf.testUser2 }), { from: addressOf.testUser2 });
      const balance2 = await contracts.dgx.balanceOf.call(addressOf.testUser2);
      const diff1 = initialUserBalance.minus(balance2);

      // send to account and get back
      const newAccount = accounts[7];
      await contracts.dgx.transfer(newAccount, fixedAmount, { from: addressOf.testUser2 });
      const transferFees = calculateFees(fixedAmount, 'transfer');
      await daysCorrection(30, newAccount);
      await contracts.dgx.transfer(addressOf.testUser2, await contracts.dgx.balanceOf.call(newAccount), { from: newAccount });
      const balance3 = await contracts.dgx.balanceOf.call(addressOf.testUser2);
      const diff2 = balance2.minus(balance3);

      // difference should be the same
      console.log('\tDemurrage + transfer fees [depositing/withdrawing from wrapper contract] : ', diff1.toNumber());
      console.log('\tDemurrage + transfer fees [sending/receiving to another account] :         ', diff2.toNumber());
      const percentageDiff = (diff2.toNumber() * 1.0 / diff1.toNumber()) * 100 - 100;
      console.log('\t\t% diff (due to compound vs non-compound calculations) = ', percentageDiff);
      assert.deepEqual(percentageDiff < 0.005, true);
    });

    it('[Sending DGX to another account, deduct his demurrage everyday, and transfer back after 30days VS depositing and withdrawing DGX from wrapper contract] Demurrage deducted should be the same', async function () {
      await timeTravelAndDepositDaily(bN(1e7), 30); // bootstrap the wrapper contract for 30 days;

      // send to ldgx contract and withdraw
      const initialBalanceUser1 = await contracts.dgx.balanceOf.call(addressOf.testUser1);
      const initialBalanceUser2 = await contracts.dgx.balanceOf.call(addressOf.testUser2);

      // const fixedAmount = randomBigNumber(bN, Math.min(initialBalanceUser1, initialBalanceUser2));
      const fixedAmount = bN(100e9);
      await contracts.dgx.transferAndCall(wrapperDgxContract.address, fixedAmount, '', { from: addressOf.testUser1 });
      //user2 sends to new account
      const newAccount = accounts[8];
      await contracts.dgx.transfer(newAccount, fixedAmount, { from: addressOf.testUser2 });

      const dummyDepositAmount = bN(100e9);

      // dummy transactions for a month, to update the demurrage fees
      for (const d of indexRange(0, 30)) {
        await daysCorrection(1, wrapperDgxContract.address);
        await daysCorrection(1, newAccount);
        await contracts.dgx.transferAndCall(wrapperDgxContract.address, dummyDepositAmount, '', { from: addressOf.testUser3 });
        await contracts.dgxStorage.deduct_demurrage(newAccount);
      }

      const dgxEquivalent = bN(await getDgxEquilavent(addressOf.testUser1));
      // console.log(dgxEquivalent);
      await wrapperDgxContract.withdraw(dgxEquivalent, { from: addressOf.testUser1 });
      const finalBalanceUser1 = await contracts.dgx.balanceOf.call(addressOf.testUser1);

      const totalFeesUser1 = initialBalanceUser1.minus(finalBalanceUser1);

      await contracts.dgx.transfer(addressOf.testUser2, await contracts.dgx.balanceOf.call(newAccount), { from: newAccount });
      const finalBalanceUser2 = await contracts.dgx.balanceOf.call(addressOf.testUser2);
      const totalFeesUser2 = initialBalanceUser2.minus(finalBalanceUser2);

      // difference should be the same
      console.log('\tDemurrage + transfer fees [depositing/withdrawing from wrapper contract] : ', totalFeesUser1.toNumber());
      console.log('\tDemurrage + transfer fees [sending/receiving to another account] :         ', totalFeesUser2.toNumber());
      const percentageDiff = (totalFeesUser1.toNumber() * 1.0 / totalFeesUser2.toNumber()) * 100 - 100;
      console.log('\t\t% diff (due to rounding errors) = ', percentageDiff);
      assert.deepEqual(percentageDiff < 0.0001, true);
    });

  });
});
