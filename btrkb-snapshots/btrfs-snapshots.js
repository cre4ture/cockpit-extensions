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
                    const groupedSnapshots = groupByDate(snapshots[target]);

                    const table = document.createElement("table");
                    table.style.tableLayout = "fixed"; // Ensure fixed table layout

                    const headerRow = document.createElement("tr");
                    headerRow.innerHTML = "<th>Year</th><th>Month</th><th>Date</th><th>Time</th>";
                    table.appendChild(headerRow);

                    for (const year in groupedSnapshots) {
                        const yearRowSpan = Object.values(groupedSnapshots[year]).reduce((acc, month) => acc + Object.keys(month).length, 0);
                        let yearCellAdded = false;

                        for (const month in groupedSnapshots[year]) {
                            const monthRowSpan = Object.keys(groupedSnapshots[year][month]).length;
                            let monthCellAdded = false;

                            for (const day in groupedSnapshots[year][month]) {
                                const dayRow = document.createElement("tr");

                                if (!yearCellAdded) {
                                    const yearCell = document.createElement("td");
                                    yearCell.rowSpan = yearRowSpan;
                                    yearCell.innerHTML = `<strong>${year}</strong>`;
                                    yearCell.style.verticalAlign = "top"; // Ensure text is aligned to the top
                                    dayRow.appendChild(yearCell);
                                    yearCellAdded = true;
                                }

                                if (!monthCellAdded) {
                                    const monthCell = document.createElement("td");
                                    monthCell.rowSpan = monthRowSpan;
                                    monthCell.innerHTML = `<strong>${month}</strong>`;
                                    monthCell.style.verticalAlign = "top"; // Ensure text is aligned to the top
                                    dayRow.appendChild(monthCell);
                                    monthCellAdded = true;
                                }

                                const dayCell = document.createElement("td");
                                dayCell.innerHTML = `<strong>${day}</strong>`;
                                dayCell.style.verticalAlign = "top"; // Ensure text is aligned to the top
                                dayRow.appendChild(dayCell);

                                const snapshotsCell = document.createElement("td");
                                snapshotsCell.style.whiteSpace = "nowrap"; // Ensure text does not wrap
                                snapshotsCell.style.overflow = "hidden"; // Hide overflow text
                                snapshotsCell.style.textOverflow = "ellipsis"; // Add ellipsis for overflow text
                                snapshotsCell.style.verticalAlign = "top"; // Ensure text is aligned to the top
                                groupedSnapshots[year][month][day].forEach(snap => {
                                    const snapItem = document.createElement("p");
                                    snapItem.textContent = snap;
                                    snapshotsCell.appendChild(snapItem);
                                });
                                dayRow.appendChild(snapshotsCell);
                                table.appendChild(dayRow);
                            }
                        }
                    }
                    snapshotBody.appendChild(table);
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

    function groupByDate(snapshots) {
        const grouped = {};
        snapshots.forEach(snapshot => {
            const [date, time] = snapshot.split(" ");
            const [year, month, day] = date.split("-");
            if (!grouped[year]) {
                grouped[year] = {};
            }
            if (!grouped[year][month]) {
                grouped[year][month] = {};
            }
            if (!grouped[year][month][day]) {
                grouped[year][month][day] = [];
            }
            grouped[year][month][day].push(time);
        });
        return grouped;
    }

    fetchSnapshots();
});
