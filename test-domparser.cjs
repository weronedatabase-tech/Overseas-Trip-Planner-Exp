const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const fs = require('fs');

const html = fs.readFileSync('finance.html', 'utf8');

// Simulate DOMParser behavior in browser
const dom = new JSDOM();
const parser = new dom.window.DOMParser();
const doc = parser.parseFromString(html, 'text/html');

let found = false;
Array.from(doc.body.children).forEach(child => {
    console.log("Child ID:", child.id, "Tag:", child.tagName);
    if (child.id === 'financeRatesModal') found = true;
});
console.log("Found modal in doc.body.children?", found);
