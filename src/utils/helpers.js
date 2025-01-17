import fs from "fs";


export const sleep = (sec) => {
	return new Promise(resolve => setTimeout(resolve, sec * 1000));
};


export const randInt = (min, max) => {
	return Math.floor(Math.random() * (max - min + 1) + min);
};


export const txtToArray = (filePath) => {
    return fs.readFileSync(filePath, 'utf8').toString().replace(/\r\n/g, '\n').split('\n').filter(n => n);
};
