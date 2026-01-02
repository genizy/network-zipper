document.addEventListener("DOMContentLoaded", function () {
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
    let currentTabID;
	function logError(message, error) {
    	const time = new Date().toISOString();
    	errors.push(
        	`[${time}] ${message}\n${error?.stack || error || "Unknown error"}\n`
    	);
    	console.error(message, error);
	}

	function fixHeader(oldheaders) {
		const headers = new Headers();
    	if (!Array.isArray(oldheaders)) return headers;

    	for (const h of oldheaders) {
        	if (h.name && h.value) {
            	if (!/^(:authority|:method|:path|:scheme|content-length)$/i.test(h.name)) {
                	headers.append(h.name, h.value);
            	}
        	}
    	}
    	return headers;
	}

    chrome.tabs.query({
        active: true,
        currentWindow: true
    }, function (tabs) {
        currentTabID = tabs[0].id;
    });
    // Fetch and display the version from manifest.json
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
        chrome.tabs.reload(currentTabID);
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
                    	const urlResponse = await fetch(url, {
                        	headers: fixHeader(files[url].request.headers),
                        	method: files[url].request.method,
							body: files[url].request.method !== "GET" ? files[url].request.postData?.text : undefined,
                    	});
                        const content = await urlResponse.text();
                        fileContent = new TextEncoder().encode(content);
                        if (!urlResponse.ok) logError(`Fetch failed: ${urlResponse.status}`);
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
                    const response = await fetch(url, {
                        headers: fixHeader(files[url].request.headers),
                        method: files[url].request.method,
						body: files[url].request.method !== "GET" ? files[url].request.postData?.text : undefined,
                    });
                    const blob = await response.blob();
                    fileContent = await blob.arrayBuffer();
                    if (!response.ok) {
    					logError(`Fetch failed (${response.status}) for ${url}`, null);
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
            let tab = await chrome.tabs.get(currentTabID);
            const link = document.createElement("a");
            link.href = URL.createObjectURL(zipContent);
            link.download = `${tab.url.hostname ? tab.url.hostname : mainUrl}.zip`;
            document.body.appendChild(link);
            downloadStatus.textContent = `Sending download..`;
            link.click();
            document.body.removeChild(link);
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