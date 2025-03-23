document.addEventListener("DOMContentLoaded", function() {
    const snapshotList = document.getElementById("snapshot-list");
    const globalSnapshotCount = document.getElementById("global-snapshot-count");

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
                    const formattedTimestamp = formatTimestamp(timestamp);
                    const fullPath = `/mnt/diskdata/zzz_btrbk_snapshots/${name}.${timestamp}`;
                    snapshots[name].push({ formattedTimestamp, fullPath });
                });

                let globalTotalSnapshots = 0;

                for (const target in snapshots) {
                    const targetDiv = document.createElement("div");
                    targetDiv.className = "pf-v5-c-card";

                    const targetHeader = document.createElement("div");
                    targetHeader.className = "pf-v5-c-card__header";
                    targetHeader.innerHTML = `<h2>${target}</h2>`;
                    targetDiv.appendChild(targetHeader);

                    const snapshotBody = document.createElement("div");
                    snapshotBody.className = "pf-v5-c-card__body";
                    const groupedSnapshots = groupByDate(snapshots[target], target);

                    // Calculate total snapshots
                    const totalSnapshots = Object.values(groupedSnapshots).reduce((acc, year) => 
                        acc + Object.values(year).reduce((acc, month) => 
                            acc + Object.values(month).reduce((acc, day) => acc + day.length, 0), 0), 0);

                    globalTotalSnapshots += totalSnapshots;

                    // Add total snapshots count before the table
                    const totalSnapshotsDiv = document.createElement("div");
                    totalSnapshotsDiv.innerHTML = `<strong>Total Snapshots: ${totalSnapshots}</strong>`;
                    snapshotBody.appendChild(totalSnapshotsDiv);

                    const table = document.createElement("table");
                    table.style.tableLayout = "fixed"; // Ensure fixed table layout

                    const headerRow = document.createElement("tr");
                    headerRow.innerHTML = "<th>Year</th><th>Month</th><th>Date</th><th>Time</th><th>Path</th>";
                    table.appendChild(headerRow);

                    const years = Object.keys(groupedSnapshots).sort((a, b) => b - a); // Sort years in descending order
                    for (const year of years) {
                        const yearRowSpan = Object.values(groupedSnapshots[year]).reduce((acc, month) => acc + Object.values(month).reduce((acc, day) => acc + day.length, 0), 0);
                        let yearCellAdded = false;

                        const months = Object.keys(groupedSnapshots[year]).sort((a, b) => b - a); // Sort months in descending order
                        for (const month of months) {
                            const monthRowSpan = Object.values(groupedSnapshots[year][month]).reduce((acc, day) => acc + day.length, 0);
                            let monthCellAdded = false;

                            const days = Object.keys(groupedSnapshots[year][month]).sort((a, b) => b - a); // Sort days in descending order
                            for (const day of days) {
                                const dayRowSpan = groupedSnapshots[year][month][day].length;
                                let dayCellAdded = false;

                                groupedSnapshots[year][month][day].forEach(snap => {
                                    const dayRow = document.createElement("tr");

                                    if (!yearCellAdded) {
                                        const yearCell = document.createElement("td");
                                        yearCell.rowSpan = yearRowSpan;
                                        yearCell.innerHTML = `<strong>${year}</strong>`;
                                        appendCount(yearCell, yearRowSpan);
                                        yearCell.style.verticalAlign = "top"; // Ensure text is aligned to the top
                                        dayRow.appendChild(yearCell);
                                        yearCellAdded = true;
                                    }

                                    if (!monthCellAdded) {
                                        const monthCell = document.createElement("td");
                                        monthCell.rowSpan = monthRowSpan;
                                        monthCell.innerHTML = `<strong>${month}</strong>`;
                                        appendCount(monthCell, monthRowSpan);
                                        monthCell.style.verticalAlign = "top"; // Ensure text is aligned to the top
                                        dayRow.appendChild(monthCell);
                                        monthCellAdded = true;
                                    }

                                    if (!dayCellAdded) {
                                        const dayCell = document.createElement("td");
                                        dayCell.rowSpan = dayRowSpan;
                                        dayCell.innerHTML = `<strong>${day}</strong>`;
                                        appendCount(dayCell, dayRowSpan);
                                        dayCell.style.verticalAlign = "top"; // Ensure text is aligned to the top
                                        dayRow.appendChild(dayCell);
                                        dayCellAdded = true;
                                    }

                                    const snapshotsCell = document.createElement("td");
                                    snapshotsCell.style.whiteSpace = "nowrap"; // Ensure text does not wrap
                                    snapshotsCell.style.overflow = "hidden"; // Hide overflow text
                                    snapshotsCell.style.textOverflow = "ellipsis"; // Add ellipsis for overflow text
                                    snapshotsCell.style.verticalAlign = "top"; // Ensure text is aligned to the top
                                    const snapItem = document.createElement("p");
                                    snapItem.textContent = snap.time;
                                    snapshotsCell.appendChild(snapItem);
                                    dayRow.appendChild(snapshotsCell);

                                    // Add full path cell with tooltip
                                    const pathCell = document.createElement("td");
                                    pathCell.style.whiteSpace = "nowrap"; // Ensure text does not wrap
                                    pathCell.style.overflow = "hidden"; // Hide overflow text
                                    pathCell.style.textOverflow = "ellipsis"; // Add ellipsis for overflow text
                                    pathCell.style.verticalAlign = "top"; // Ensure text is aligned to the top
                                    const pathItem = document.createElement("p");
                                    pathItem.textContent = snap.fullPath;
                                    pathItem.title = snap.fullPath; // Add tooltip
                                    pathCell.appendChild(pathItem);
                                    dayRow.appendChild(pathCell);

                                    table.appendChild(dayRow);
                                });
                            }
                        }
                    }
                    snapshotBody.appendChild(table);
                    targetDiv.appendChild(snapshotBody);

                    snapshotList.appendChild(targetDiv);
                }

                // Update global snapshot count
                globalSnapshotCount.innerHTML = `<strong>Global Total Snapshots: ${globalTotalSnapshots}</strong>`;
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

    function groupByDate(snapshots, target) {
        const grouped = {};
        snapshots.forEach(snapshot => {
            const [date, time] = snapshot.formattedTimestamp.split(" ");
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
            grouped[year][month][day].push({ time, fullPath: snapshot.fullPath });
        });

        // Sort times in descending order
        for (const year in grouped) {
            for (const month in grouped[year]) {
                for (const day in grouped[year][month]) {
                    grouped[year][month][day].sort((a, b) => b.time.localeCompare(a.time));
                }
            }
        }

        return grouped;
    }

    function appendCount(cell, count) {
        if (count > 2) {
            cell.innerHTML += `<div class="snapshot-total">total:<br>${count}<div>`;
        }
    }

    fetchSnapshots();
});
