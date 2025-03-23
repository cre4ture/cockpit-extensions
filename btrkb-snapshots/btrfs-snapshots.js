document.addEventListener("DOMContentLoaded", function() {
    const snapshotList = document.getElementById("snapshot-list");

    // Function to fetch and display snapshots
    function fetchSnapshots() {
        cockpit.spawn(["ls", "/mnt/diskdata/zzz_btrbk_snapshots"], { superuser: true })
            .then(data => {
                const snapshotDirs = data.trim().split("\n");
                const snapshots = {};

                snapshotDirs.forEach(dir => {
                    const [name, timestamp] = dir.split(".");
                    if (!snapshots[name]) {
                        snapshots[name] = [];
                    }
                    snapshots[name].push(formatTimestamp(timestamp));
                });

                for (const target in snapshots) {
                    const targetDiv = document.createElement("div");
                    targetDiv.className = "pf-v5-c-card";

                    const targetHeader = document.createElement("div");
                    targetHeader.className = "pf-v5-c-card__header";
                    targetHeader.innerHTML = `<h2>${target}</h2>`;
                    targetDiv.appendChild(targetHeader);

                    const snapshotBody = document.createElement("div");
                    snapshotBody.className = "pf-v5-c-card__body";
                    snapshots[target].reverse().forEach(snap => { // Reverse the order
                        const snapItem = document.createElement("p");
                        snapItem.textContent = snap;
                        snapshotBody.appendChild(snapItem);
                    });
                    targetDiv.appendChild(snapshotBody);

                    snapshotList.appendChild(targetDiv);
                }
            })
            .catch(error => {
                console.error("Error fetching snapshots: " + error);
            });
    }

    function formatTimestamp(timestamp) {
        const year = timestamp.substring(0, 4);
        const month = timestamp.substring(4, 6);
        const day = timestamp.substring(6, 8);
        const hour = timestamp.substring(9, 11);
        const minute = timestamp.substring(11, 13);
        return `${year}-${month}-${day} ${hour}:${minute}`;
    }

    fetchSnapshots();
});
