chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'fetchFile') {
        const { url } = message;
        let textFileExtensions;
        fetch("https://raw.githubusercontent.com/sindresorhus/text-extensions/refs/heads/main/text-extensions.json").then(response => response.json()).then(json => {
            textFileExtensions = json;
        });
        
        let filePath = url.hostname + url.pathname;
        if (filePath.endsWith("/")) filePath += "index.html";
        if (!filePath.split("/").pop().includes(".")) filePath += ".html";
        const extension = filePath.split(".").pop();
        const isTextFile = textFileExtensions.includes(`${extension}`);

        if (isTextFile) {
            chrome.devtools.inspectedWindow.eval(
                `fetch(${JSON.stringify(url)}).then(res => res.text()).then(data => data)`,
                (result, isException) => {
                    if (isException) {
                        console.error('Error fetching file:', isException);
                        sendResponse(null);
                    } else {
                        sendResponse({ content: result, type: 'text' });
                    }
                }
            );
        } else {
            fetch(url, {
                method: 'GET',
                headers: { 'Accept': 'application/octet-stream' },
                mode: 'cors'
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Network response was not ok: ${response.statusText}`);
                }
                return response.arrayBuffer();
            })
            .then(arrayBuffer => sendResponse({ content: arrayBuffer, type: 'binary' }))
            .catch(error => {
                console.error('Failed to fetch binary file:', error);
                sendResponse(null);
            });
        }

        return true;
    }
});

chrome.runtime.onStartup.addListener(() => {
    console.log(`onStartup()`);
});
