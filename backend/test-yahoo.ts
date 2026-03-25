import YahooFinance from "yahoo-finance2";

const yahoo = new YahooFinance();

async function testYahoo() {
  const ticker = "RELIANCE.NS";
  console.log(`Testing Yahoo Finance for ${ticker}...`);
  try {
    const result = await yahoo.quoteSummary(ticker, {
      modules: ["defaultKeyStatistics", "financialData", "assetProfile", "summaryDetail"]
    });
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error("Error:", err);
  }
}

testYahoo();
