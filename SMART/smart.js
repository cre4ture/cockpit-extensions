document.addEventListener("DOMContentLoaded", function () {
    function fetchSmartStatus() {
        cockpit.spawn(["lsblk", "-d", "-n", "-o", "NAME"], { superuser: true })
            .then(data => {
                const drives = data.trim().split("\n");
                const container = document.getElementById("drive-status-cards");
                container.innerHTML = ""; // Clear existing cards
                drives.forEach(drive => {
                    const card = document.createElement("div");
                    card.className = "pf-v5-c-card";
                    card.innerHTML = `
                        <div class="pf-v5-c-card__title">
                            <div id="${drive}-status" class="pf-v5-c-card__title-text">S.M.A.R.T. Status for /dev/${drive}</div>
                        </div>
                        <div class="pf-v5-c-card__body">
                            <div id="${drive}-output">Fetching status...</div>
                        </div>
                    `;
                    container.appendChild(card);

                    const fullPath = "/dev/" + drive;
                    let smartData = "";

                    cockpit.spawn(["smartctl", "-a", "-x", fullPath], { superuser: true })
                        .stream(data => {
                            smartData += data;
                        })
                        .catch(error => {
                            document.getElementById(drive + "-output").innerText = "Error fetching status: " + error;
                        })
                        .then(() => {
                            parseSmartOutput(smartData, drive);
                        });
                });
            })
            .catch(error => {
                console.error("Error fetching drive list: " + error);
            });
    }

    function printCapacity(value) {
        let parts = value.split("[");
        if (parts.length > 1) {
            return parts[1].replace("]", "");
        } else {
            return value;
        }
    }

    function parseSmartOutput(data, drive) {
        const outputElement = document.getElementById(drive + "-output");
        const lines = data.split("\n");
        let summary = {
            deviceModel: "Unknown",
            userCapacity: "Unknown",
            overallHealth: "Unknown",
            reallocatedSectors: "Unknown",
            pendingSectors: "Unknown",
            uncorrectableSectors: "Unknown",
            temperature: "Unknown",
            powerOnHours: "Unknown"
        };

        lines.forEach(line => {
            if (line.includes("Device Model:")) {
                summary.deviceModel = parseKeyColonValuePair(line).value;
            } else if (line.includes("User Capacity:")) {
                summary.userCapacity = printCapacity(parseKeyColonValuePair(line).value);
            } else if (line.includes("SMART overall-health self-assessment test result")) {
                summary.overallHealth = parseKeyColonValuePair(line).value;
            } else if (line.includes("Reallocated_Sector_Ct")) {
                summary.reallocatedSectors = parseSmartAttribute(line).evaluation();
            } else if (line.includes("Current_Pending_Sector")) {
                summary.pendingSectors = parseSmartAttribute(line).evaluation();
            } else if (line.includes("Offline_Uncorrectable")) {
                summary.uncorrectableSectors = parseSmartAttribute(line).evaluation();
            } else if (line.includes("Temperature_Celsius")) {
                summary.temperature = parseSmartAttribute(line).raw;
            } else if (line.includes("Power_On_Hours")) {
                summary.powerOnHours = parseSmartAttribute(line).hours();
            }
        });

        let overallHealthHtml = summary.overallHealth;
        if (summary.overallHealth === "PASSED") {
            overallHealthHtml = `<span class="status-passed">${summary.overallHealth}</span>`;
        }

        let formattedOutput = `
            <div>
                <table>
                    <tr><td><strong>Device Model:</strong></td><td>${summary.deviceModel}</td></tr>
                    <tr><td><strong>User Capacity:</strong></td><td>${summary.userCapacity}</td></tr>
                    <tr><td><strong>Overall Health:</strong></td><td>${overallHealthHtml}</td></tr>
                    <tr><td><strong>Sectors</strong></td><td></td></tr>
                    <tr><td><strong>- Reallocated:</strong></td><td>${summary.reallocatedSectors}</td></tr>
                    <tr><td><strong>- Pending:</strong></td><td>${summary.pendingSectors}</td></tr>
                    <tr><td><strong>- Uncorrectable:</strong></td><td>${summary.uncorrectableSectors}</td></tr>
                    <tr><td><strong>Temperature:</strong></td><td>${summary.temperature} °C</td></tr>
                    <tr><td><strong>Power-On:</strong></td><td>${summary.powerOnHours}</td></tr>
                </table>
                <button id="${drive}-toggle-button">Show Full Output</button>
            </div>
            <div id="${drive}-full-output" class="full-output">
                <pre>${data}</pre>
            </div>
        `;

        outputElement.innerHTML = formattedOutput;

        // Attach event listener to the button
        document.getElementById(`${drive}-toggle-button`).addEventListener("click", function () {
            toggleFullOutput(drive);
        });

        updateSmartStatus(drive, summary);
    }

    function parseKeyColonValuePair(line) {
        let parts = line.split(":");
        return {
            key: parts[0].trim(),
            value: parts[1].trim()
        };
    }

    function parseSmartAttribute(line) {
        const parts = line.trim().split(/\s+/);
        return {
            id: parts[0],
            name: parts[1],
            flags: parts[2],
            value: parts[3],
            worst: parts[4],
            thresh: parts[5],
            fail: parts[6],
            raw: parts[7],
            evaluation: function () {
                let ref = 100;
                if (this.thresh > 100)
                    ref = 200;
                let ref_range = ref - this.thresh;
                let value_range = Math.min(ref, this.value - this.thresh);
                let percent = Math.round((value_range / ref_range) * 100);
                return this.raw + " ok: " + percent + "% (" + this.value + ", " + this.worst + ", " + this.thresh + ")";
            },
            hours: function () {
                return this.raw + " hours, or<br>" + (this.raw / 24.0).toFixed(2)+ " days, or<br>" + (this.raw / 24.0 / 365.0).toFixed(2) + " years";
            }
        };
    }

    function toggleFullOutput(drive) {
        const fullOutputElement = document.getElementById(drive + "-full-output");
        if (fullOutputElement.classList.contains("full-output")) {
            fullOutputElement.classList.remove("full-output");
        } else {
            fullOutputElement.classList.add("full-output");
        }
    }

    function updateSmartStatus(device, summary) {
        const statusElement = document.getElementById(`${device}-status`);
        const outputElement = document.getElementById(`${device}-output`);
        
        if (summary.overallHealth === "PASSED") {
            statusElement.innerHTML = `<span class="status-passed">S.M.A.R.T. Status for ${device}</span>`;
        } else {
            statusElement.innerHTML = `S.M.A.R.T. Status for ${device}`;
        }
    }

    fetchSmartStatus();
    setInterval(fetchSmartStatus, 60000);
});