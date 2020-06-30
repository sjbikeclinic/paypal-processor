let CSVParser = require('./CSVParser');
let parser = new CSVParser(true);
let fs = require('fs');
let transactions = {};

if (process.argv.length != 3) {
    console.log("usage: node main.js <file to process>");
    process.exit(1);
}

let inputFile = process.argv[2];
let data = fs.readFileSync(inputFile, "utf8").trim();

parser.parseData(data, true, processItem);

let fields = ["Date", "Time", "Type", "Item Title", "Gross", "Net", "Fee", "Sales Tax",
    "Gross Taxable", "Net Taxable", "Gross Non Taxable", "Net Non Taxable", 
    "Quantity", "Balance", "Name", "From Email Address"];

let headerStr = "";
for (const field of fields) {
    if (headerStr.length > 0) headerStr += ",";
    headerStr += '"' + field + '"';
}

var dataStr = headerStr + "\n";
for (let [key, transaction] of Object.entries(transactions)) {
    if (transaction["Balance Impact"] == "Debit") {
        console.log("omitting Debit transaction: " + transaction.Type + " / " + transaction["Item Title"]);
        continue;       // don't include debit transactions in our accounting ledger
    }
    let valStr = "";
    for (const field of fields) {
        if (valStr.length > 0) valStr += ",";
        valStr += '"' + (transaction[field] || "") + '"';
    }
    dataStr += valStr + "\n";

    if (transaction.items && transaction.items.length > 0) {
        for (const item of transaction.items) {
            let valStr = '"",""';   // omit Date and Time for sub-items
            for (const field of fields.slice(2)) {
                if (valStr.length > 0) valStr += ",";
                valStr += '"' + (item[field] || "") + '"';
            }
            dataStr += valStr + "\n";
        }
    }
}
fs.writeFileSync("output.csv", dataStr);
console.log("done");

function calcNet(tranGross, tranNet, itemGross) {
    if (itemGross == tranGross)
        return tranNet;
    let fee = tranGross * 0.027;
    return itemGross - (itemGross / tranGross * fee);
}

function processItem(itemData) {
    if (itemData.Status != "Completed") {
        console.log("Skipping non-Completed transaction - status: " + itemData.Status +
            " (" + itemData.Type + " / " + itemData["Item Title"] + ")");
        return;
    }
    let key = itemData.Date + itemData.Time;
    if (!(key in transactions)) {
        let transaction = itemData;
        let tranGross = parseFloat(transaction.Gross).toFixed(2);
        let tranNet = parseFloat(transaction.Net).toFixed(2);
        transaction.items = [];
        if (transaction["Sales Tax"] > 0) {
            let gross = parseFloat(transaction["Sales Tax"]).toFixed(2);
            let net = calcNet(tranGross, tranNet, gross);
            transaction.items.push({ "Item Title": "Sales Tax", "Net Non Taxable": net });
        }
        if (transaction["Tip"] > 0) {
            let gross = parseFloat(transaction["Tip"]).toFixed(2);
            let net = calcNet(tranGross, tranNet, gross);
            transaction.items.push({ "Item Title": "Tip", "Net Non Taxable": net });
        }
        transactions[key] = transaction;
    } else {
        let transaction = transactions[key];
        let tranGross = parseFloat(transaction.Gross).toFixed(2);
        let tranNet = parseFloat(transaction.Net).toFixed(2);
        let item = {
            "Name": itemData["Name"],
            "Type": itemData["Type"],
            "Item Title": itemData["Item Title"]
        };
        let gross = parseFloat(itemData.Gross).toFixed(2);
        let net = calcNet(tranGross, tranNet, gross);
        if (itemData["Sales Tax"] > 0) {
            item["Item Tax"] = parseFloat(itemData["Sales Tax"]).toFixed(2);
            item["Gross Taxable"] = gross;
            item["Net Taxable"] = net;
        } else {
            item["Gross Non Taxable"] = gross;
            item["Net Non Taxable"] = net;
        }
        transactions[key].items.push(item);
    }
}
