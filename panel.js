document.addEventListener("DOMContentLoaded", function() {
    const fileListDiv = document.getElementById("fileList");
    const downloadBtn = document.getElementById("download");
    const refreshBtn = document.getElementById("refresh");
    const fileCountSpan = document.getElementById("fileCount");
    const themeDropdown = document.querySelector(".theme-dropdown");
    const themeLinks = document.querySelectorAll(".theme-dropdown-content a");
    let files = {};

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

    chrome.devtools.network.onRequestFinished.addListener(request => {
        const url = request.request.url;
        if (!files[url]) {
            const urlObj = new URL(url);
            if (urlObj.protocol === "blob:" || urlObj.protocol === "data:") return;
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
                const firstUrl = new URL(urls[0]);
                mainUrl = firstUrl.hostname;
            }
        } catch (e) {
            console.error("Error getting main URL:", e);
        }

        const filePromises = Object.keys(files).map(async (url) => {
            try {
                const response = await fetch(url);
                if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
                const blob = await response.blob();
                const fileContent = await blob.arrayBuffer();
                const urlObj = new URL(url);
                let filePath = urlObj.hostname + urlObj.pathname;
                if (filePath.endsWith("/")) {
                    filePath += "index.html";
                }
                zip.file(decodeURIComponent(filePath), fileContent);
            } catch (e) {
                console.error("Error processing URL:", url, e);
            }
        });

        try {
            await Promise.all(filePromises);
            const zipContent = await zip.generateAsync({
                type: "blob"
            });
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
});
