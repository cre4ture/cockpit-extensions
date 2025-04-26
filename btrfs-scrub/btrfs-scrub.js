document.addEventListener("DOMContentLoaded", function () {
    let mountPoint = "/mnt/diskdata"; // Default value

    function fetchMountPoint() {
        return cockpit.spawn(["findmnt", "-n", "-o", "TARGET", "-t", "btrfs"])
            .then(data => {
                mountPoint = data.trim();
                document.getElementById("mount-point-info").innerText = `Mount Point: ${mountPoint}`;
            })
            .catch(error => {
                console.error("Error determining mount point:", error);
                alert("Failed to determine mount point. Using default: " + mountPoint);
                document.getElementById("mount-point-info").innerText = `Mount Point: ${mountPoint} (default)`;
            });
    }

    function errorToJson(error) {
        const errorMessage = error.message || JSON.stringify(error, null, 2);
        return errorMessage;
    }

    function fetchScrubStatus() {
        cockpit.spawn(["btrfs", "scrub", "status", mountPoint], { superuser: true })
            .stream(parseScrubOutput)
            .catch(error => document.getElementById("scrub-output").innerText = "Error fetching status: " + errorToJson(error));
    }

    function fetchBalanceStatus() {
        cockpit.spawn(["btrfs", "balance", "status", "-v", mountPoint], { superuser: true })
            .stream(parseBalanceOutput)
            .catch(error => {
                if (error.exit_status != 1) { // igore exit status 1 - seems to be normal  during balance?
                    document.getElementById("balance-output").innerText += "Error fetching status: " + errorToJson(error);
                }
            });
    }

    function parseScrubOutput(data) {
        const outputElement = document.getElementById("scrub-output");
        const progressBar = document.getElementById("scrub-progress");
        const startButton = document.getElementById("start-scrub-button");
        const stopButton = document.getElementById("stop-scrub-button");
        const resumeButton = document.getElementById("resume-scrub-button");
        outputElement.innerText = data;

        const match = data.match(/\((\d+(\.\d+)?)%\)/);
        if (match) {
            progressBar.value = parseFloat(match[1]);
        }

        if (data.includes("running")) {
            startButton.disabled = true;
            stopButton.disabled = false;
            resumeButton.disabled = true;
        } else if (data.includes("paused") || data.includes("aborted")) {
            startButton.disabled = false;
            stopButton.disabled = true;
            resumeButton.disabled = false;
        } else {
            startButton.disabled = false;
            stopButton.disabled = true;
            resumeButton.disabled = true;
        }
    }

    function parseBalanceOutput(data) {
        const outputElement = document.getElementById("balance-output");
        const progressBar = document.getElementById("balance-progress");
        outputElement.innerText = data;

        const match = data.match(/(\d+(\.\d+)?)% left/);
        if (match) {
            progressBar.value = 100 - parseFloat(match[1]);
        }
    }

    fetchMountPoint().then(() => {
        fetchScrubStatus();
        fetchBalanceStatus();
        setInterval(fetchScrubStatus, 10000);
        setInterval(fetchBalanceStatus, 10000);
    });

    document.getElementById("start-scrub-button").addEventListener("click", function () {
        cockpit.spawn(["btrfs", "scrub", "start", mountPoint], { superuser: true })
            .then(() => {
                alert("Scrub started successfully");
                fetchScrubStatus();
            })
            .catch(error => alert("Error starting scrub: " + error));
    });

    document.getElementById("stop-scrub-button").addEventListener("click", function () {
        cockpit.spawn(["btrfs", "scrub", "cancel", mountPoint], { superuser: true })
            .then(() => {
                alert("Scrub stopped successfully");
                fetchScrubStatus();
            })
            .catch(error => alert("Error stopping scrub: " + error));
    });

    document.getElementById("resume-scrub-button").addEventListener("click", function () {
        cockpit.spawn(["btrfs", "scrub", "resume", mountPoint], { superuser: true })
            .then(() => {
                alert("Scrub resumed successfully");
                fetchScrubStatus();
            })
            .catch(error => alert("Error resuming scrub: " + error));
    });
});
