document.addEventListener("DOMContentLoaded", function () {
    function fetchScrubStatus() {
        cockpit.spawn(["btrfs", "scrub", "status", "/mnt/diskdata"], { superuser: true })
            .stream(parseOutput)
            .catch(error => document.getElementById("scrub-output").innerText = "Error fetching status: " + error);
    }

    function parseOutput(data) {
        const outputElement = document.getElementById("scrub-output");
        const progressBar = document.getElementById("scrub-progress");
        outputElement.innerText = data;

        const match = data.match(/\((\d+\.\d+)%\)/);
        if (match) {
            progressBar.value = parseFloat(match[1]);
        }
    }

    fetchScrubStatus();
    setInterval(fetchScrubStatus, 10000);
});
