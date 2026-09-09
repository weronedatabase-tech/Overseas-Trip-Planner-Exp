const fs = require('fs');
const jsdom = require("jsdom");
const { JSDOM } = jsdom;

const html = `<html><body><input id="nat" type="text" value="Martian" /></body></html>`;
const dom = new JSDOM(html, { runScripts: "outside-only" });
const window = dom.window;
const document = window.document;

let uiJs = fs.readFileSync('frontend/js/ui.js', 'utf8');
window.eval(uiJs);

try {
    window.setupNationalityDropdown('nat');
    const wrapper = document.getElementById('nat').parentNode;
    console.log("Manual Input value:", wrapper.querySelector('.flex.items-center input[type=text]').value);
} catch (e) {
    console.error(e);
}
