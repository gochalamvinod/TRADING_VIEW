async function verify() {
  const acc = await fetch('http://127.0.0.1:9000/trade/account').then(r => r.json());
  console.log('ACCOUNT SUMMARY:');
  console.log('Balance:', acc.balance);
  console.log('Equity:', acc.equity);
  console.log('Profit (Open P&L):', acc.profit);
  console.log('Margin:', acc.margin);
  console.log('Free Margin:', acc.margin_free);

  const pos = await fetch('http://127.0.0.1:9000/trade/positions').then(r => r.json());
  console.log('\nPOSITIONS COUNT:', pos.length);
  pos.forEach(p => {
    console.log('Ticket: ' + p.ticket + ' | Sym: ' + p.symbol + ' | Vol: ' + p.volume + ' | Profit: ' + p.profit + ' | ContractSize: ' + p.contract_size + ' | TickVal: ' + p.tick_value);
  });
}
verify().catch(console.error);
