const bN = web3.toBigNumber;

const feesConfigs = {
  demurrageBase: bN(10000000),
  demurrageRate: bN(165),
  recastBase: bN(100000000000),
  recastRate: bN(1000000000),
  transferBase: bN(10000),
  transferRate: bN(13),
  minimumTransferAmount: bN(1000000),
};

function calculateFees(amount, fees = 'transfer') {
  const calculate = (base, rate) => amount.times(rate).dividedToIntegerBy(base);

  switch (fees) {
    case 'transfer':
      return calculate(feesConfigs.transferBase, feesConfigs.transferRate);
    case 'recast':
      return calculate(feesConfigs.recastBase, feesConfigs.recastRate);
    case 'demurrage':
      return calculate(feesConfigs.demurrageBase, feesConfigs.demurrageRate);
    default:
      return bN(0);
  }
}

function balanceAfterFees(balance, fees = 'transfer') {
  return balance.minus(calculateFees(balance, fees));
}


module.exports = {
  feesConfigs,
  balanceAfterFees,
  calculateFees,
};
