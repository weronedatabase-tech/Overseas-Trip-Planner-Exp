global.window = {};
window.formatDDMmmYYYY = function(dateStr) {
    if (dateStr instanceof Date) {
        if (isNaN(dateStr.getTime())) return '-';
        const day = String(dateStr.getDate()).padStart(2, '0');
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${day} ${months[dateStr.getMonth()]} ${dateStr.getFullYear()}`;
    }
    if (typeof dateStr === 'number') dateStr = new Date(dateStr);
    if (!dateStr || (typeof dateStr === 'string' && dateStr.trim() === '')) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${day} ${months[d.getMonth()]} ${d.getFullYear()}`;
};

console.log(window.formatDDMmmYYYY(new Date()));
console.log(window.formatDDMmmYYYY(1682390820000));
console.log(window.formatDDMmmYYYY("2023-01-01"));
console.log(window.formatDDMmmYYYY(""));
console.log(window.formatDDMmmYYYY(null));
