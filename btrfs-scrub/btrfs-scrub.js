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
        outputElement.innerText = data;

        const match = data.match(/\((\d+(\.\d+)?)%\)/);
        if (match) {
            progressBar.value = parseFloat(match[1]);
        }

        if (data.includes("running")) {
            startButton.disabled = true;
        } else {
            startButton.disabled = false;
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
            .then(() => alert("Scrub started successfully"))
            .catch(error => alert("Error starting scrub: " + error));
    });
});
