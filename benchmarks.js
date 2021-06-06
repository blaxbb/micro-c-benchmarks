let storeId = "141";

function Init() {
    var sid = document.getElementById("storeInfo")?.attributes["data-store"]
    if (sid != undefined) {
      storeId = sid;
    }

    SetupBenchmark(
        "Processor",
        "4294966995",
        "cpus.json",
        {
            SingleThreaded: "thread",
            MultiThreaded: "cpumark"
        },
        {
            SingleThreaded: "Single Threaded",
            MultiThreaded: "MultiThreaded"
        },
        2016,
        ["K", "F", "X", "H "]
    );

    // todo unlike CPUS, GPUS need to be consolidated by chipset...
    //
    SetupBenchmark(
        "GPU Chipset",
        "4294966937",
        "gpus.json",
        {
            GPUPerformance: "g3d"
        },
        {
            GPUPerformance: "GPU Performance",
        },
        2016,
        []
    );
}

function SetupBenchmark(nameSpec, category, filename, benchmarkFields, displayFields, minYear, importantCharacters) {
    GetCurrentName(nameSpec)
        .then(() => GetCachedResults(nameSpec))
        .then(data => {
            const cacheLife = 1000 * 60 * 60 * 12;
            if(data.hasOwnProperty(nameSpec) && new Date() - data[nameSpec].time < cacheLife) {
                SetupCachedBenchmark(data, nameSpec, displayFields, importantCharacters);
            }
            else {
                SetupUncachedBenchmark(nameSpec, category, filename, benchmarkFields, displayFields, minYear, importantCharacters);
            }
        }
    ).catch(error => {}); //error here should be because we are on a different product category page;;;
}

function SetupCachedBenchmark(data, nameSpec, displayFields, importantCharacters) {
    GetCurrentName(nameSpec)
        .then((productName) => {
            let items = data[nameSpec].items;
            return {
                item: FindMatch(productName, items, importantCharacters).item,
                allItems: items
            };
        }).then(data => {
            console.log(data);
            return {
                item: data.item,
                ...Object.fromEntries(
                    Object.entries(displayFields).map(([field, name]) => [field, FindSimilar(data.item, data.allItems, field)])
                )
            };
        }).then(data => Display(
            data.item,
            nameSpec,
            displayFields,
            Object.keys(displayFields).map(field => data[field]),
        )
    );
}

function SetupUncachedBenchmark(nameSpec, category, filename, benchmarkFields, displayFields, minYear, importantCharacters) {
    GetCurrentName(nameSpec)
    .then(productName =>
        Promise.all([LoadCategory(category), LoadBenchmarks(filename, minYear)])
            .then(data =>
                Promise.all([ConsolidateItems(data[0], data[1], nameSpec, benchmarkFields, importantCharacters)])
                    .then((data) => SetCacheResults(nameSpec, data[0]))
                    .then((data) => GetCachedResults(nameSpec))
                    .then(data => {
                        let items = data[nameSpec].items;
                        return {
                            item: FindMatch(productName, items, importantCharacters).item,
                            allItems: items
                        }
                    })
                    .then(data => {
                        return {
                            item: data.item,
                            ...Object.fromEntries(
                                Object.entries(displayFields).map(([field, name]) => [field, FindSimilar(data.item, data.allItems, field)])
                            )
                        };
                    })
                    .then(data => Display(
                            data.item,
                            nameSpec,
                            displayFields,
                            Object.keys(displayFields).map(field => data[field]),
                        )
                    )
            )
    );
}

function SetCacheResults(nameSpec, items) {
    var obj = {};
        obj[nameSpec] = {
            items: items,
            time: new Date()
        };
    return browser.storage.local.set(obj);
}

function GetCachedResults(nameSpec) {
    return browser.storage.local.get(nameSpec);
}

function PruneOldEntries(data, year) {
    return data.filter(entry => {
        var match = entry.date.match(/\d+/g);
        if(match == null) { return false; }
        return Number(match.join('')) > year
    })
}

function PruneStringsToNumbers(arr)
{
    arr.forEach(element => {
        for(const [key, value] of Object.entries(element))
        {
            if(!isNaN(element[key]))
            {
                element[key] = +element[key];
            }
            else if(!isNaN(element[key].replace(/,/g, '')))
            {
                element[key] = +element[key].replace(/,/g, '');
            }
        }
    });
}

function GetCurrentName(nameSpec) {
    return new Promise((resolve, reject) => {
        var specs = [...document.getElementsByClassName("spec-body")];
        for(var i = 0; i < specs.length; i++)
        {
            var spec = specs[i];
            if(spec.children[0].innerText == nameSpec){
                resolve(spec.children[1].innerText);
            }
        }
        reject(`Spec ${nameSpec} not found`);
    });
}

function FindMatch(name, data, importantCharacters)
{
    const options = {
        includeScore: true,
        ignoreLocation: true,
        keys: ['name']
    };

    const fuse = new Fuse(data, options);
    var results = fuse.search(name);
    if(results.length > 0)
    {
        let hasChar = importantCharacters.map(t => name.includes(t));
        for(var i = 0; i < 5; i++)
        {
            var valid = importantCharacters.every((char, index) => results[i].item.name.includes(char) == hasChar[index]);
            if(valid) {
                return results[i];
            }
        }
        debugger;
    }
    console.log(`FAILED!!! ${name}`);

    return null;
}

function LoadCategory(category) {
    console.log(`LOAD ${category}`);
    return fetch(`https://microc.bbarrett.me/MicroCenterProxy/searchAll?storeId=${storeId}&categoryFilter=${category}`, {
        "credentials": "omit",
        "headers": {
            "Accept": "application/json",
            "Upgrade-Insecure-Requests": "1",
            "Pragma": "no-cache",
            "Cache-Control": "no-cache"
        },
        "method": "GET",
        "mode": "cors"
    })
        .then(response => response.json())
        .then(data => data.items);
    
}

function LoadBenchmarks(filename, minYear)
{
    console.log(`LOAD BENCHMARKS ${filename}`);
    var url = browser.runtime.getURL(filename);
    return fetch(url)
        .then(response => response.json())
        .then(data => {
            data.data = PruneOldEntries(data.data, minYear);
            PruneStringsToNumbers(data.data);
            return data.data;
        });
}

function Display(product, nameField, fields, collections) {

    document.querySelector("#product-details > ul > li:last-child")
        .insertAdjacentHTML('afterend', `<li class="accTab" role="tab"><a href="#tab-benchmarks" class="tabLink">Benchmarks</a></li>`);

    document.querySelector("#product-details > *:last-child")
        .insertAdjacentHTML('afterend', `
        <article id="tab-benchmarks" class="rounded" role="tabpanel" aria-hidden="true" style="display: none;">
            <div class="content-wrapper">
                <h2 class="icons">Benchmarks</h2>
            </div>
        </article>`);

    let getItemDisplay = function(other, field) {
        let cssClass = "";
        if(product[field] > other[field]) {
            cssClass = "benchmark-item-below";
        }
        else if(product[field] < other[field]) {
            cssClass = "benchmark-item-above";
        }
        else {
            cssClass = "benchmark-item-equal";
        }

        if(product[field] < other[field] && product.price > other.price)
        {
            cssClass += " benchmark-item-standout";
        }

        //regex trickery to force first component of path to match
        var url = other.url;
        var regex = /\/.*?\//
        var match = window.location.pathname.match(regex);
        url = url.replace(regex, match[0]);

        var element = document.createElement("a");
        element.className = `benchmark-item ${cssClass}`;
        element.setAttribute("href", url);
        element.setAttribute("title", other[field]);

        var imgEle = document.createElement("div");
        imgEle.className = "benchmark-item-picture";

        var img = document.createElement("img");
        img.src = other.pictureUrls[0];

        imgEle.append(img);
        element.append(imgEle);

        var fields = [
            ["benchmark-item-name", other.specs[nameField]],
            ["benchmark-item-price", other.price],
            ["benchmark-item-value", `${(((other[field] - product[field]) / product[field]) * 100).toFixed(1)}%`]
        ]
        
        for(let i = 0; i < fields.length; i++) {
            let cls = fields[i][0];
            let val = fields[i][1];

            var ele = document.createElement("div");
            ele.className = cls;
            ele.innerText = val;
            element.append(ele);
        }


        return element;
    }

    document.querySelector("#tab-benchmarks > div > *:last-child")
        .insertAdjacentHTML('afterend', `<div class="benchmark-info"></div>`);

    let index = 0;
    for(const [key, label] of Object.entries(fields)) {
        let div = document.createElement("div");
        let h3 = document.createElement("h3");
        h3.innerText = `${label} - ${product[key]}`;
        div.appendChild(h3);

        let items = collections[index].all.map(item => getItemDisplay(item, key));
        document.querySelector(".benchmark-info").append(div);
        for(let i = 0; i < items.length; i++) {
            let item = items[i];
            div.append(item);
        }

        index++;
    }


    document.querySelector("#tab-benchmarks > div > *:last-child")
        .insertAdjacentHTML('afterend',`
        <div class="benchmark-footer">
            <h3>Benchmark scores referenced from <a href="https://www.cpubenchmark.net/">PassMark.</a></h3>
        </div>
    `);
}

function ConsolidateItems(products, benchmarks, nameSpec, fields, importantCharacters)
{
    var results = {};
    return new Promise((resolve, reject) => {
        products.forEach((product, index) => {
            try {
                if(product.specs.hasOwnProperty(nameSpec)) {

                    var name = product.specs[nameSpec];
                    var match = FindMatch(name, benchmarks, importantCharacters);
                    for(var productField in fields)
                    {
                        var benchmarkField = fields[productField];
                        product[productField] = match.item[benchmarkField];
                    }
                    //product.DEBUG_DATE = match.item.date;

                    if(results.hasOwnProperty(name))
                    {
                        var existing = results[name];
                        if(existing.stock == 0) {
                            if(product.stock > 0 || product.price < existing.price)
                            {
                                results[name] = product;
                            }
                        }
                        else if(product.stock > 0 && product.price < existing.price)
                        {
                            results[name] = product;
                        }
                    }
                    else
                    {
                        results[name] = product;
                    }
                }
                if(index === products.length - 1) {
                    resolve(Object.values(results));
                }
            }
        catch(error)
        {
            console.log(error);
        }
        });
    });
}

function FindSimilar(item, collection, field) {
    var value = item[field];

    const maxItems = 5;

    var sorted = collection.sort((a,b) => a[field] - b[field]);
    var index = sorted.indexOf(item);

    var startBelow = index - maxItems;
    startBelow = startBelow >= 0 ? startBelow : 0;

    var endBelow = index;

    var startAbove = index + 1;
    startAbove = startAbove < sorted.length ? startAbove : sorted.length;
    var endAbove = index + maxItems + 1;
    endAbove = endAbove < sorted.length ? endAbove : sorted.length;


    var deltaPos = sorted.length - index;
    var deltaNeg = index;
    
    if((maxItems * 2) + 1 > sorted.length) {
        startBelow = 0;
        endAbove = sorted.length;
    }
    else if(deltaPos < maxItems) {
        startBelow -= maxItems - deltaPos + 1;
    }
    else if(deltaNeg < maxItems) {
        endAbove += maxItems - deltaNeg;
    }




    return {
        below: sorted.slice(startBelow, endBelow),
        above: sorted.slice(startAbove, endAbove),
        all: sorted.slice(startBelow, endAbove).reverse()
    };
}

(function(){
    console.log("READY");

    Init();
})();