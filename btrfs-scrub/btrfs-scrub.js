document.addEventListener("DOMContentLoaded", function () {
    let mountPoints = ["/mnt/diskdata"]; // Default value

    function parseFindmntOutput(data) {
        const lines = data.trim().split('\n');
        const mounts = [];
        
        for (const line of lines) {
            // Remove tree characters and extract mount point
            const cleanLine = line.replace(/[├─└│\s]/g, '');
            if (cleanLine && cleanLine.startsWith('/')) {
                mounts.push(cleanLine);
            }
        }
        
        return mounts.length > 0 ? mounts : ["/mnt/diskdata"];
    }

    function fetchMountPoints() {
        return cockpit.spawn(["findmnt", "-n", "-o", "TARGET", "-t", "btrfs"])
            .then(data => {
                mountPoints = parseFindmntOutput(data);
                updateMountPointInfo();
                createUIForMountPoints();
            })
            .catch(error => {
                console.error("Error determining mount points:", error);
                alert("Failed to determine mount points. Using default: " + mountPoints[0]);
                updateMountPointInfo();
                createUIForMountPoints();
            });
    }

    function updateMountPointInfo() {
        const infoElement = document.getElementById("mount-point-info");
        if (mountPoints.length === 1) {
            infoElement.innerText = `Mount Point: ${mountPoints[0]}`;
        } else {
            infoElement.innerText = `Found ${mountPoints.length} btrfs mount points: ${mountPoints.join(', ')}`;
        }
    }

    function createUIForMountPoints() {
        const gallery = document.querySelector(".pf-v6-l-gallery");
        // Clear existing cards (keep the mount point info)
        gallery.innerHTML = '';
        
        mountPoints.forEach((mountPoint, index) => {
            createMountPointCards(mountPoint, index);
        });
    }

    function createMountPointCards(mountPoint, index) {
        const gallery = document.querySelector(".pf-v6-l-gallery");
        
        // Create a row container for this mount point
        const rowContainer = document.createElement('div');
        rowContainer.className = 'pf-v6-l-gallery pf-m-gutter';
        rowContainer.style.width = '100%';
        rowContainer.style.marginBottom = '1rem';
        
        // Create scrub card
        const scrubCard = document.createElement('div');
        scrubCard.className = 'pf-v6-c-card';
        scrubCard.style.minWidth = '400px';
        scrubCard.style.flex = '1';
        scrubCard.style.marginRight = '1rem';
        scrubCard.innerHTML = `
            <div class="pf-v6-c-card__title">
                <div class="pf-v6-c-card__title-text">Scrub Status - ${mountPoint}</div>
            </div>
            <div class="pf-v6-c-card__body">
                <pre id="scrub-output-${index}" style="white-space: pre-wrap; word-wrap: break-word; overflow-wrap: break-word; max-width: 100%;">Fetching status...</pre>
                <progress id="scrub-progress-${index}" class="full-width-progress" value="0" max="100"></progress>
                <div class="pf-v6-c-card__actions">
                    <button id="start-scrub-button-${index}" class="pf-v6-c-button pf-m-primary">Start Scrub</button>
                    <button id="stop-scrub-button-${index}" class="pf-v6-c-button pf-m-secondary" disabled>Stop Scrub</button>
                    <button id="resume-scrub-button-${index}" class="pf-v6-c-button pf-m-secondary" disabled>Resume Scrub</button>
                </div>
            </div>
        `;
        
        // Create balance card
        const balanceCard = document.createElement('div');
        balanceCard.className = 'pf-v6-c-card';
        balanceCard.style.minWidth = '400px';
        balanceCard.style.flex = '1';
        balanceCard.innerHTML = `
            <div class="pf-v6-c-card__title">
                <div class="pf-v6-c-card__title-text">Balance Status - ${mountPoint}</div>
            </div>
            <div class="pf-v6-c-card__body">
                <pre id="balance-output-${index}" style="white-space: pre-wrap; word-wrap: break-word; overflow-wrap: break-word; max-width: 100%;">Fetching status...</pre>
                <progress id="balance-progress-${index}" class="full-width-progress" value="0" max="100"></progress>
            </div>
        `;
        
        // Add cards to the row container
        rowContainer.appendChild(scrubCard);
        rowContainer.appendChild(balanceCard);
        
        // Add the row container to the main gallery
        gallery.appendChild(rowContainer);
        
        // Add event listeners for this mount point
        setupEventListeners(mountPoint, index);
    }

    function setupEventListeners(mountPoint, index) {
        document.getElementById(`start-scrub-button-${index}`).addEventListener("click", function () {
            cockpit.spawn(["btrfs", "scrub", "start", mountPoint], { superuser: true })
                .then(() => {
                    alert(`Scrub started successfully for ${mountPoint}`);
                    fetchScrubStatus(mountPoint, index);
                })
                .catch(error => alert(`Error starting scrub for ${mountPoint}: ` + error));
        });

        document.getElementById(`stop-scrub-button-${index}`).addEventListener("click", function () {
            cockpit.spawn(["btrfs", "scrub", "cancel", mountPoint], { superuser: true })
                .then(() => {
                    alert(`Scrub stopped successfully for ${mountPoint}`);
                    fetchScrubStatus(mountPoint, index);
                })
                .catch(error => alert(`Error stopping scrub for ${mountPoint}: ` + error));
        });

        document.getElementById(`resume-scrub-button-${index}`).addEventListener("click", function () {
            cockpit.spawn(["btrfs", "scrub", "resume", mountPoint], { superuser: true })
                .then(() => {
                    alert(`Scrub resumed successfully for ${mountPoint}`);
                    fetchScrubStatus(mountPoint, index);
                })
                .catch(error => alert(`Error resuming scrub for ${mountPoint}: ` + error));
        });
    }

    function errorToJson(error) {
        const errorMessage = error.message || JSON.stringify(error, null, 2);
        return errorMessage;
    }

    function fetchScrubStatus(mountPoint, index) {
        cockpit.spawn(["btrfs", "scrub", "status", mountPoint], { superuser: true })
            .stream(data => parseScrubOutput(data, index))
            .catch(error => document.getElementById(`scrub-output-${index}`).innerText = "Error fetching status: " + errorToJson(error));
    }

    function fetchBalanceStatus(mountPoint, index) {
        cockpit.spawn(["btrfs", "balance", "status", "-v", mountPoint], { superuser: true })
            .stream(data => parseBalanceOutput(data, index))
            .catch(error => {
                if (error.exit_status != 1) { // ignore exit status 1 - seems to be normal during balance?
                    document.getElementById(`balance-output-${index}`).innerText += "Error fetching status: " + errorToJson(error);
                }
            });
    }

    function fetchAllStatuses() {
        mountPoints.forEach((mountPoint, index) => {
            fetchScrubStatus(mountPoint, index);
            fetchBalanceStatus(mountPoint, index);
        });
    }

    function parseScrubOutput(data, index) {
        const outputElement = document.getElementById(`scrub-output-${index}`);
        const progressBar = document.getElementById(`scrub-progress-${index}`);
        const startButton = document.getElementById(`start-scrub-button-${index}`);
        const stopButton = document.getElementById(`stop-scrub-button-${index}`);
        const resumeButton = document.getElementById(`resume-scrub-button-${index}`);
        outputElement.innerText = data;

        const match = data.match(/\((\d+(\.\d+)?)%\)/);
        if (match) {
            progressBar.value = parseFloat(match[1]);
        }

        if (data.includes("running")) {
            startButton.disabled = true;
            stopButton.disabled = false;
            resumeButton.disabled = true;
        } else if (data.includes("paused")
            || data.includes("aborted")
            || data.includes("interrupted")) {
            startButton.disabled = false;
            stopButton.disabled = true;
            resumeButton.disabled = false;
        } else {
            startButton.disabled = false;
            stopButton.disabled = true;
            resumeButton.disabled = true;
        }
    }

    function parseBalanceOutput(data, index) {
        const outputElement = document.getElementById(`balance-output-${index}`);
        const progressBar = document.getElementById(`balance-progress-${index}`);
        outputElement.innerText = data;

        const match = data.match(/(\d+(\.\d+)?)% left/);
        if (match) {
            progressBar.value = 100 - parseFloat(match[1]);
        }
    }

    fetchMountPoints().then(() => {
        fetchAllStatuses();
        setInterval(fetchAllStatuses, 10000);
    });
});
