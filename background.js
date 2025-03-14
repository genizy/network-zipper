chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'fetchFile') {
        const { url } = message;

        // Attempt to fetch the file using the background script (CORS should not block this)
        fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/octet-stream',  // Accept binary data
            },
            mode: 'cors'  // Make sure CORS is allowed
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Network response was not ok for ${url}`);
                }
                // Check if the response is a binary resource
                if (url.endsWith('.jpg') || url.endsWith('.png') || url.endsWith('.jpeg')) {
                    return response.blob();  // For image or binary data
                } else {
                    return response.text();  // For text-based content like HTML, JS, etc.
                }
            })
            .then(blobOrText => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    if (blobOrText instanceof Blob) {
                        // Convert Blob to ArrayBuffer (binary data)
                        sendResponse({ content: reader.result, type: 'binary' });
                    } else {
                        // Handle text content
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

        // Ensure the message channel stays open while the fetch is in progress
        return true;
    }
});

chrome.runtime.onStartup.addListener( () => {
    console.log(`onStartup()`);
});