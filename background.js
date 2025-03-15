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
                if (url.endsWith('.jpg') || url.endsWith('.png') || url.endsWith('.jpeg')) {
                    return response.blob();  
                } else {
                    return response.text();  
                }
            })
            .then(blobOrText => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    if (blobOrText instanceof Blob) {
                        sendResponse({ content: reader.result, type: 'binary' });
                    } else {
                        sendResponse({ content: reader.result, type: 'text' });
                    }
                };

                if (blobOrText instanceof Blob) {
                    reader.readAsArrayBuffer(blobOrText);
                } else {
                    reader.readAsText(blobOrText);
                }
            })
            .catch(error => {
                console.error('Failed to fetch file:', error);
                sendResponse(null);
            });

        return true;
    }
});

chrome.runtime.onStartup.addListener( () => {
    console.log(`onStartup()`);
});