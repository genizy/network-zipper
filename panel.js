document.addEventListener("DOMContentLoaded", function () {
    const fileListDiv = document.getElementById("fileList");
    const downloadBtn = document.getElementById("download");
    const fileCountSpan = document.getElementById("fileCount");
    let files = {};

    chrome.devtools.network.onRequestFinished.addListener(request => {
        const url = request.request.url;
        if (!files[url]) {
            files[url] = request;
            fileListDiv.innerHTML += `<div>${url}</div>`;
            fileCountSpan.textContent = Object.keys(files).length;
        }
    });

    downloadBtn.addEventListener("click", async function () {
        const zip = new JSZip();
        let mainUrl = "network_zipper";
        console.log("Collected files:", files);

        try {
            const urls = Object.keys(files);
            if (urls.length > 0) {
                const firstUrl = new URL(urls[0]);
                mainUrl = firstUrl.hostname;
            }
        } catch (e) {
            console.error("Error getting main URL:", e);
        }

        const filePromises = Object.keys(files).map(url => {
            return new Promise((resolve, reject) => {
                let request = files[url];

                try {
                    const urlObj = new URL(url);
                    if (document.getElementById("ignoreBlob").checked && urlObj.protocol === "blob:") return resolve();
                    if (document.getElementById("ignoreData").checked && urlObj.protocol === "data:") return resolve();

                    request.getContent((content, encoding) => {
                        try {
                            if (encoding === "base64") {
                                content = Uint8Array.from(atob(content), c => c.charCodeAt(0));
                            } else {
                                content = new TextEncoder().encode(content);
                            }

                            let filePath = urlObj.hostname + urlObj.pathname;
                            zip.file(filePath.endsWith("/") ? filePath + "index.html" : filePath, content);
                            resolve();
                        } catch (e) {
                            console.error("Error processing content:", e);
                            resolve();
                        }
                    });
                } catch (e) {
                    console.error("Error processing URL:", url, e);
                    resolve();
                }
            });
        });

        try {
            await Promise.all(filePromises);

            const blob = await zip.generateAsync({ type: "blob" });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = `${mainUrl}.zip`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (e) {
            console.error("Error generating zip:", e);
        }
    });
});
