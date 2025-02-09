document.addEventListener("DOMContentLoaded", function () {
    function fetchScrubStatus() {
        cockpit.spawn(["btrfs", "scrub", "status", "/mnt/diskdata"], { superuser: true })
            .stream(parseScrubOutput)
            .catch(error => document.getElementById("scrub-output").innerText = "Error fetching status: " + error);
    }

    function fetchBalanceStatus() {
        cockpit.spawn(["btrfs", "balance", "status", "-v", "/mnt/diskdata"], { superuser: true })
            .stream(parseBalanceOutput)
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

    fetchScrubStatus();
    fetchBalanceStatus();
    setInterval(fetchScrubStatus, 10000);
    setInterval(fetchBalanceStatus, 10000);

    document.getElementById("start-scrub-button").addEventListener("click", function () {
        cockpit.spawn(["btrfs", "scrub", "start", "/mnt/diskdata"], { superuser: true })
            .then(() => {
                alert("Scrub started successfully");
                fetchScrubStatus();
            })
            .catch(error => alert("Error starting scrub: " + error));
    });

    document.getElementById("stop-scrub-button").addEventListener("click", function () {
        cockpit.spawn(["btrfs", "scrub", "cancel", "/mnt/diskdata"], { superuser: true })
            .then(() => {
                alert("Scrub stopped successfully");
                fetchScrubStatus();
            })
            .catch(error => alert("Error stopping scrub: " + error));
    });

    document.getElementById("resume-scrub-button").addEventListener("click", function () {
        cockpit.spawn(["btrfs", "scrub", "resume", "/mnt/diskdata"], { superuser: true })
            .then(() => {
                alert("Scrub resumed successfully");
                fetchScrubStatus();
            })
            .catch(error => alert("Error resuming scrub: " + error));
    });
});
