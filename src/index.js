import { ethers } from "ethers";
import { HttpsProxyAgent } from "https-proxy-agent";
import fetch from "node-fetch";

import { randInt, txtToArray, sleep } from './utils/helpers.js';
import { logger } from './logging/logger.js';
import 'dotenv/config';


const DELAY_RANGE_SEC = [1, 3];


async function signMessage(wallet, message) {
    return await wallet.signMessage(message);
};


const checkOrbiterDrop = async (wallet, proxy=null) => {
    const url = "https://airdrop-api.orbiter.finance/airdrop/snapshot";

    const settings = {
        method: 'POST',
        headers: {
            Token: await signMessage(wallet, "Orbiter Airdrop")
        },
        ...(proxy ? { agent: new HttpsProxyAgent(proxy) } : {}),
    };

    const response = await fetch(url, settings);

    if (![200, 201].includes(response.status)) {
        throw new Error(
            `Unexpected html fetch listings code: ${response.status}, response: ${await response.text()}`
        );
    }

    const data = await response.json();
    const { result } = data;
    return result == null ? 0 : result;
};


const start = async () => {
    const privateKeys = txtToArray('./privateKeys.txt');
    const proxies = txtToArray('./proxies.txt');
    
    let i = 0;
    for (const privateKey of privateKeys) {
        try {
            const wallet = new ethers.Wallet(privateKey);
            const allocation = await checkOrbiterDrop(wallet, proxies[i]);
            logger.info(`${i+1} - ${wallet.address}: ${allocation}`);
        } catch (error) {
            logger.error(`${i+1} - check failed: ${error}`);
        } finally {
            i++;
            const delaySec = randInt(...DELAY_RANGE_SEC);
            await sleep(delaySec);
        }
    }
};


start();




