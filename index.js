import fs from "fs";
import { ethers } from "ethers";
import { HttpsProxyAgent } from "https-proxy-agent";
import fetch from "node-fetch";
import { createObjectCsvWriter } from "csv-writer";

// Конфигурационные параметры
const RUN_ASYNC = true;  // true / false, если включено - обработка параллельно без задержек
const DELAY_RANGE_SEC = [1, 3];  // задержки между аккаунтами, если асинхронное выполнение отключено

// Инициализация CSV-писателя
const csvWriter = createObjectCsvWriter({
    path: 'results.csv',
    header: [
        { id: 'address', title: 'Wallet Address' },
        { id: 'amount', title: 'Amount' }
    ]
});

// Вспомогательные функции
const sleep = (sec) => {
    return new Promise(resolve => setTimeout(resolve, sec * 1000));
};

const randInt = (min, max) => {
    return Math.floor(Math.random() * (max - min + 1) + min);
};

const txtToArray = (filePath) => {
    return fs.readFileSync(filePath, 'utf8')
             .toString()
             .replace(/\r\n/g, '\n')
             .split('\n')
             .filter(n => n);
};

const isValidUrl = (url) => {
    try {
        new URL(url);
        return true;
    } catch (err) {
        return false;
    }
};

// Функция для подписи сообщения
async function signMessage(wallet, message) {
    return await wallet.signMessage(message);
};

// Функция для проверки распределения (airdrop) от Orbiter
const checkOrbiterDrop = async (wallet, proxy = null) => {
    const url = "https://airdrop-api.orbiter.finance/airdrop/snapshot";

    const settings = {
        method: 'POST',
        headers: {
            Token: await signMessage(wallet, "Orbiter Airdrop")
        },
        ...(proxy ? { agent: new HttpsProxyAgent(proxy) } : {}),
    };

    try {
        const response = await fetch(url, settings);
        if (![200, 201].includes(response.status)) {
            throw new Error(
                `Unexpected response code: ${response.status}, response: ${await response.text()}`
            );
        }

        const data = await response.json();
        console.log(`Ответ от API для ${wallet.address}:`, data); // Логируем полный ответ

        const { result } = data;
        if (result && result.amount) {
            return parseFloat(result.amount);
        } else {
            return 0;
        }
    } catch (fetchError) {
        throw new Error(`Fetch error: ${fetchError.message}`);
    }
};

// Функция для обработки одного кошелька
const processWallet = async (privateKey, proxy) => {
    let wallet; // Объявляем wallet вне блока try
    try {
        wallet = new ethers.Wallet(privateKey);
        if (proxy) {
            if (!isValidUrl(proxy)) {
                throw new Error(`Некорректный URL прокси: ${proxy}`);
            }
            console.log(`Используется прокси: ${proxy}`);
        } else {
            console.log(`Прокси не используется для кошелька: ${wallet.address}`);
        }

        const amount = await checkOrbiterDrop(wallet, proxy);
        console.log(`${wallet.address}: Amount = ${amount}`);

        return { address: wallet.address, amount };
    } catch (error) {
        const address = wallet ? wallet.address : 'Unknown wallet';
        console.log(`${address} - check failed: ${error}`);
        return { address, amount: 0 };
    }
};

// Основная функция выполнения
const start = async () => {
    const privateKeys = txtToArray('./privateKeys.txt');
    const proxies = txtToArray('./proxies.txt');

    let results = []; // Массив для хранения результатов

    if (RUN_ASYNC) {
        // Асинхронная обработка всех кошельков параллельно
        const promises = privateKeys.map((privateKey, index) => {
            const proxy = proxies[index] || null;
            return processWallet(privateKey, proxy);
        });

        results = await Promise.all(promises);
    } else {
        // Синхронная обработка кошельков с задержкой
        for (let i = 0; i < privateKeys.length; i++) {
            const privateKey = privateKeys[i];
            const proxy = proxies[i] || null;
            const result = await processWallet(privateKey, proxy);
            results.push(result);
            const delaySec = randInt(...DELAY_RANGE_SEC);
            await sleep(delaySec);
        }
    }

    // Запись результатов в CSV
    try {
        await csvWriter.writeRecords(results);
        console.log('Результаты успешно записаны в results.csv');
    } catch (csvError) {
        console.error('Ошибка при записи в CSV:', csvError);
    }
}

start();
