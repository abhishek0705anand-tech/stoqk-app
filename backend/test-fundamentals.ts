import { fetchFundamentalsFromYahoo } from "./src/lib/fundamentals.js";

async function test() {
  const ticker = "RELIANCE";
  console.log(`Testing Yahoo API with ${ticker}...`);
  const data = await fetchFundamentalsFromYahoo(ticker);
  console.log(JSON.stringify(data, null, 2));
}

test();
