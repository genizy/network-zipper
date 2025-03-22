document.addEventListener("DOMContentLoaded", function() {
    const fileListDiv = document.getElementById("fileList");
    const downloadBtn = document.getElementById("download");
    const refreshBtn = document.getElementById("refresh");
    const beautify = document.getElementById('beautify');
    const fileCountSpan = document.getElementById("fileCount");
    const themeDropdown = document.querySelector(".theme-dropdown");
    const themeLinks = document.querySelectorAll(".theme-dropdown-content a");
    const versionSpan = document.getElementById("version");
    const githubBtn = document.getElementById("github");
    const discordBtn = document.getElementById("discord");
    let files = {};

    // Fetch and display the version from manifest.json
    fetch(chrome.runtime.getURL('manifest.json'))
        .then(response => response.json())
        .then(manifest => {
            versionSpan.textContent = `v${manifest.version}`;
        });

    function setTheme(themeName) {
        document.body.className = themeName;
        localStorage.setItem('theme', themeName);
    }

    themeLinks.forEach(link => {
        link.addEventListener("click", function(event) {
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

    const textFileExtensions = [".html", ".htm", "css", "js", "json"];
    
    chrome.devtools.network.onRequestFinished.addListener(request => {
        const url = request.request.url;
        if (!files[url]) {
            const urlObj = new URL(url);
            if (urlObj.protocol !== "http:" && urlObj.protocol !== "https:") return;
            files[url] = request;
            fileListDiv.innerHTML += `<div>${url}</div>`;
            fileCountSpan.textContent = Object.keys(files).length;
        }
    });

    refreshBtn.addEventListener("click", async function() {
        chrome.tabs.query({active: true, currentWindow: true}, function (tabs) {
            chrome.tabs.reload(tabs[0].id);
        });
        files = {};
        fileListDiv.innerHTML = "";
    });

    downloadBtn.addEventListener("click", async function() {
        const zip = new JSZip();
        let mainUrl = "network_zipper";
        try {
            const urls = Object.keys(files);
            if (urls.length > 0) {
                mainUrl = new URL(urls[0]).hostname;
            }
        } catch (e) {
            console.error("Error getting main URL:", e);
        }

        const filePromises = Object.keys(files).map(async (url) => {
            try {
                const urlObj = new URL(url);
                let filePath = urlObj.hostname + urlObj.pathname;
                if (filePath.endsWith("/")) filePath += "index.html";
                if (!filePath.split("/").pop().includes(".")) filePath += ".html";
                const extension = filePath.split(".").pop();
                const isTextFile = textFileExtensions.includes(`.${extension}`);
                
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
                    
            
                    if (fileContent.length === 0) {
                        const response = await fetch(urlObj, {
                            headers: {
                                "Origin": urlObj.origin,
                                "Referrer": urlObj.href
                            },
                            method: "GET"
                        });
                        if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
                        const content = await response.text();
                        fileContent = new TextEncoder().encode(content);
                    }

                    if (beautify.checked) {
                        switch (extension) {
                            case 'html':
                                fileContent = html_beautify(response, { indent_size: 2 });
                                break;
                            case 'htm':
                                fileContent = html_beautify(response, { indent_size: 2 });
                                break;
                            case 'css':
                                fileContent = css_beautify(response, { indent_size: 2 });
                                break;
                            case 'js':
                                fileContent = js_beautify(response, { indent_size: 2 });
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
                        headers: {
                            "Origin": urlObj.origin,
                            "Referrer": urlObj.href
                        },
                        method: "GET"
                    });
                    if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
                    const blob = await response.blob();
                    fileContent = await blob.arrayBuffer();
                }
                zip.file(decodeURIComponent(filePath), fileContent);
            } catch (e) {
                console.error("Error processing URL:", url, e);
            }
        });

        try {
            await Promise.all(filePromises);
            const zipContent = await zip.generateAsync({ type: "blob" });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(zipContent);
            link.download = `${mainUrl}.zip`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (e) {
            console.error("Error generating zip:", e);
        }
    });

    githubBtn.addEventListener("click", function() {
        window.open("https://github.com/genizy/network-zipper", "_blank");
    });

    discordBtn.addEventListener("click", function() {
        window.open("https://discord.gg/NAFw4ykZ7n", "_blank");
    });

    fetch('https://raw.githubusercontent.com/genizy/network-zipper/main/manifest.json')
        .then(response => response.json())
        .then(latestManifest => {
            fetch(chrome.runtime.getURL('manifest.json'))
                .then(response => response.json())
                .then(currentManifest => {
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
