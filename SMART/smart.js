document.addEventListener("DOMContentLoaded", function () {
    function fetchSmartStatus() {
        const basePath = "/dev/";
        const drives = ["sda", "sdb", "sdc", "sdd", "sde"];
        drives.forEach(drive => {
            const fullPath = basePath + drive;
            cockpit.spawn(["smartctl", "-a", fullPath], { superuser: true })
                .stream(data => parseSmartOutput(data, drive))
                .catch(error => document.getElementById(fullPath + "-output").innerText = "Error fetching status: " + error);
        });
    }

    function parseSmartOutput(data, drive) {
        const outputElement = document.getElementById(drive + "-output");
        outputElement.innerText = data;
    }

    fetchSmartStatus();
    setInterval(fetchSmartStatus, 60000);
});