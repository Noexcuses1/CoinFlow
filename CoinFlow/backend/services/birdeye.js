import fetch from 'node-fetch'; 
const BASE_URL = 'https://public-api.birdeye.so/public';

export async function getTokenPrice(tokenAddress) {
  const res = await fetch(`${BASE_URL}/price?address=${tokenAddress}`, {
    headers: { 'X-API-KEY': process.env.BIRDEYE_API_KEY }
  });
  return res.json();
}

export async function getTokenOverview(tokenAddress) {
  const res = await fetch(`${BASE_URL}/token_overview?address=${tokenAddress}`, {
    headers: { 'X-API-KEY': process.env.BIRDEYE_API_KEY }
  });
  return res.json();
}