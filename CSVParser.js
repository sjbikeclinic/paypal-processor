function CSVParser(initVerbose) {
    this.items = [];
    this.verbose = initVerbose;
}

CSVParser.prototype.parseData = function (data, firstLineHeaders, visitorFn) {
    var lines = data.split(/[\r\n]+/),
        line, parseAsObjects = false,
        lineNum = 0;
    if (firstLineHeaders) {
        let headersLine = lines.slice(0, 1);
        this.headerNames = this.parseFields(headersLine[0], false);
        lines = lines.slice(1);
        parseAsObjects = true;
    }
    for (line of lines) {
        if (line && line.length > 0) {
            var fields = this.parseFields(line.trim());
            if (fields && fields.length > 0) {
                if (parseAsObjects) {
                    if (fields.length === this.headerNames.length) {
                        let obj = {};
                        for (let i = 0; i < Math.min(fields.length, this.headerNames.length); i++) {
                            addVal(obj, this.headerNames[i], fields[i]);
                        }
                        if (visitorFn) {
                            visitorFn(obj);
                        }
                        this.items.push(obj);
                    } else {
                        if (this.verbose)
                            console.log("skipping line " + lineNum + " due to fields/headers mismatch");
                    }
                } else {
                    this.items.push(fields);
                }
            } else {
                if (this.verbose)
                    console.log("skipping empty line " + lineNum);
            }
        }
        lineNum++;
    }

    function addVal(obj, prop, val) {
        if (!(prop in obj)) {
            obj[prop] = val;
        } else {
            if (Array.isArray(obj[prop])) {
                obj[prop].push(val);
            } else {
                let vals = [obj[prop], val];
                obj[prop] = vals;
            }

        }
    }
};

CSVParser.prototype.parseFields = function (line) {
    let result = [];
    let value = "",
        inValue = false,
        escape = false,
        i, curCh, quotedField = false,
        startOfField = true;

    if (line.length > 0) {
        for (i = 0; i < line.length; i++) {
            curCh = line.charAt(i);
            if (startOfField) {
                quotedField = curCh === '"';
                startOfField = false;
            }
            quotedField ? qfParseChar() : nqfParseChar();
        }
        if (value.length > 0 || !startOfField)
            addValue();
        else if (line.charAt(line.length - 1) === ',')
            addValue();
    }

    // parse a quoted-field character
    function qfParseChar() {
        if (curCh === '"') {
            inValue = !inValue;
            return;
        }
        if (inValue) {
            value += curCh;
            return;
        }
        if (curCh === ',') {
            addValue();
        }
    }

    // parse a non-quoted field character
    function nqfParseChar() {
        if (escape) {
            value += curCh;
            escape = false;
        } else if (curCh === '\\') {
            escape = true;
        } else if (curCh === ',') {
            addValue();
        } else {
            value += curCh;
        }
    }

    function addValue() {
        value = value.trim();
        result.push(new String(value).valueOf());
        startOfField = true;
        value = "";
    }

    return result;
};

module.exports = CSVParser;