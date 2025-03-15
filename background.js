chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'fetchFile') {
        const { url } = message;

        fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/octet-stream',
            },
            mode: 'cors'
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Network response was not ok for ${url}`);
            }
            return response.arrayBuffer();
        })
        .then(arrayBuffer => {
            sendResponse({ content: arrayBuffer, type: 'binary' });
        })
        .catch(error => {
            console.error('Failed to fetch file:', error);
            sendResponse(null);
        });

        return true;
    }
});

chrome.runtime.onStartup.addListener(() => {
    console.log(`onStartup()`);
});
